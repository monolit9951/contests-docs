#!/usr/bin/env node --experimental-strip-types
// Anti-doorway/scaled-content gate for the multilingual DareBay content tree.
//
// This file is the executable source of truth. It lives with the public corpus
// it validates; the fleet invokes this copy from each contests-docs worktree.
// There is deliberately no second implementation in darebay-seo-fleet.
//
// A "page" in the caps is a semantic id from docs/content-pages.json, not a
// translated file. Adding EN and UK versions of one article must not spend three
// slots or trip the total cap. Body similarity is compared within one locale and
// never against another translation of the same semantic page.
//
// Правила против смыслового дублирования (paraphrase, faq-echo, heading-echo) судят страницу
// целиком, а не диффом: у дублирования нет «изменённых строк», оно свойство всего текста рядом с
// соседями. Поэтому правка одной цифры на легаси-странице отдавала бы под гейт весь её старый
// текст. Для этих трёх правил включён храповик (см. runLint): нарушение сверяется с тем, что то же
// правило находило на базовой ревизии, и валит сборку, только если изменение его внесло или
// расширило. Унаследованное печатается отдельной секцией долга — глотать его молча нельзя.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  HUBS,
  PAGES,
  pagePath,
  sourceFile,
  localesOf,
} from '../docs/.vitepress/registry.ts'

export const CAP_NEW_PER_WAVE = 8
export const CAP_TOTAL = 60

// Пороги ниже откалиброваны по живому корпусу на origin/release (120 страниц, 669 пар внутри
// «хаб + локаль»), а не выбраны априори. Замер (полная матрица — в PR):
//
//   метрика  pairs  med    p90    p95    p99    max
//   j5        669   0.005  0.057  0.074  0.126  0.161   (earnings/en how-much-clipping-pays ↔ streamer-clip-rates)
//   j3        669   0.016  0.104  0.125  0.188  0.222   (та же пара)
//   j2        669   0.042  0.171  0.198  0.249  0.312   (та же пара)
//
// Прежний DUP_THRESHOLD = 0.8 стоял в пять раз выше потолка корпуса: ни одна пара из 669 не могла
// его достичь ни при каком содержании раздела. Гейт выдавал разрешение, а не проверял.

/** Копипаста: пятисловные шинглы. Потолок корпуса 0.161; порог ~2x потолка — достижим для
 * страницы, дословно переиспользующей чужие абзацы, и недостижим для честной правки. */
export const DUP_THRESHOLD = 0.3

/** Пересказ: трёхсловные шинглы. Пять слов ловят только копипасту; на пересказе они слепы
 * (весь дорвейный раздел /zarabotok/ жил при j5 <= 0.133). Триграммы дают лучшее разделение,
 * чем биграммы: max/p90 = 2.1 против 1.8 у j2, потому что биграммы в тематическом корпусе
 * забиты неизбежной доменной лексикой («за 1000», «1000 просмотров»). Порог 0.16 лежит между
 * p95 (0.125) и p99 (0.188): выше всего, что производят здоровые хабы, ниже дорвейного кластера. */
export const PARAPHRASE_THRESHOLD = 0.16

/** «Почти одинаковый» заголовок: Жаккар по словам, обрезанным до 4 символов (грубый стеммер,
 * одинаково работающий для ru/uk/en словоизменения). На живом корпусе при 0.6 склеиваются
 * только настоящие парафразы («нужны ли подписчики» / «нужна ли аудитория или подписчики»);
 * первое ложное склеивание появляется на 0.5. */
export const QUESTION_SIMILARITY = 0.6

/** Один и тот же вопрос FAQ на стольких страницах одного хаба = дублирование интента.
 * Три — потому что при этом значении правило молчит на здоровой части корпуса (хаб help,
 * 42 страницы в трёх локалях, и хаб about, 21 страница — ноль срабатываний) и загорается
 * ровно на разделах, которые аудит признал дорвейными. Два было бы шумом: пара страниц
 * вправе делить вопрос. */
export const FAQ_ECHO_LIMIT = 3

/** То же для H2. Считаются только содержательные секции: сквозные блоки вёрстки
 * («Куда дальше», «Итог», «Страницы раздела») исключены — они есть почти на каждой странице
 * по требованию домашнего стиля и ничего не говорят об интенте. */
export const HEADING_ECHO_LIMIT = 3

const FLEET_HUBS = new Set(['earnings', 'brands', 'help', 'about'])
const CONTENT_PATHS = [
  /^docs\/(zarabotok|brendam|pomoshch|o-proekte)\//,
  /^docs\/ua\/(zarobitok|brendam|dopomoha|pro-proekt)\//,
  /^docs\/en\/(earnings|for-brands|help|about)\//,
]

const REDIRECT_PATTERNS = [
  /http-equiv\s*=\s*["']?\s*refresh/i,
  /<meta[^>]+refresh/i,
  /window\.location/i,
  /location\.(href|replace|assign)/i,
  /(^|\n)\s*redirect\s*:\s*[\/"']/i,
  /(^|\n)\s*Redirect\s+30[12]\b/i,
]

const normalPath = (path) => path.replace(/\\/g, '/').replace(/^\.\//, '')
const isPotentialContentPath = (path) => CONTENT_PATHS.some((pattern) => pattern.test(normalPath(path)))

/** Локализованный сегмент пути -> канонический хаб: `zarabotok`, `zarobitok` и `earnings` — один
 * хаб, и сравнивать FAQ надо внутри него, а не внутри каталога. Выводится из манифеста, а не
 * прописан руками, чтобы переименование сегмента не разошлось с гейтом. */
const hubBySegment = new Map()
for (const [hub, localized] of Object.entries(HUBS)) {
  for (const segment of Object.values(localized)) hubBySegment.set(segment, hub)
}

const registryBySource = new Map()
const sourcesBySemanticId = new Map()
for (const entry of PAGES) {
  for (const locale of localesOf(entry)) {
    const source = `docs/${sourceFile(entry, locale)}`
    const info = {
      entry,
      locale,
      semanticId: entry.id,
      source,
      url: pagePath(entry, locale),
      isHub: entry.slugs[locale] === '',
      validZone: FLEET_HUBS.has(entry.hub),
    }
    registryBySource.set(source, info)
    const siblings = sourcesBySemanticId.get(entry.id) ?? []
    siblings.push(source)
    sourcesBySemanticId.set(entry.id, siblings)
  }
}

function listMarkdown(dir) {
  const out = []
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name)
      const stat = statSync(path)
      if (stat.isDirectory()) walk(path)
      else if (name.endsWith('.md')) out.push(path)
    }
  }
  if (existsSync(dir)) walk(dir)
  return out
}

function parseFront(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/)
  const frontmatter = match ? match[1] : ''
  const body = match ? text.slice(match[0].length) : text
  const seo = /(^|\n)\s*seo:\s*true\b/.test(frontmatter)
  const provenance = frontmatter.match(
    /provenance\s*:\s*\{[^}]*snapshot_date\s*:\s*["']?(\d{4}-\d{2}-\d{2})/
  )
  return {
    body,
    seo,
    hasProvenance: Boolean(provenance),
  }
}

/** Resolve a source path through the semantic manifest, with a strict fallback
 * for a new file that has not yet been registered. */
export function pathInfo(path) {
  const norm = normalPath(path)
  const registered = registryBySource.get(norm)
  if (registered) {
    const slug = registered.isHub ? 'index' : norm.slice(norm.lastIndexOf('/') + 1, -3)
    return {
      isPage: true,
      norm,
      zone: registered.entry.hub,
      slug,
      validZone: registered.validZone,
      validSlug: slug === 'index' || /^[a-z0-9-]+$/.test(slug),
      url: registered.url,
      locale: registered.locale,
      semanticId: registered.semanticId,
      isHub: registered.isHub,
      registered: true,
    }
  }

  const match = norm.match(/^docs\/(?:(ua|en)\/)?([^/]+)\/([^/]+)\.md$/)
  if (!match) return { isPage: false, norm }
  const [, prefix, zone, slug] = match
  const locale = prefix === 'ua' ? 'uk' : prefix === 'en' ? 'en' : 'ru'
  const validZone = isPotentialContentPath(norm)
  const publicPrefix = prefix ? `/${prefix}` : ''
  return {
    isPage: true,
    norm,
    zone,
    slug,
    validZone,
    validSlug: slug === 'index' || /^[a-z0-9-]+$/.test(slug),
    url: slug === 'index' ? `${publicPrefix}/${zone}/` : `${publicPrefix}/${zone}/${slug}`,
    locale,
    semanticId: `unregistered:${norm}`,
    isHub: slug === 'index',
    registered: false,
  }
}

function bodyWords(body) {
  return body
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Шинглы длиной `size`. Пять слов — детектор копипасты, три — детектор пересказа. */
function shingles(body, size = 5) {
  const words = bodyWords(body)
  const set = new Set()
  for (let i = 0; i + size <= words.length; i += 1) set.add(words.slice(i, i + size).join(' '))
  return set
}

function jaccard(left, right) {
  if (left.size === 0 && right.size === 0) return 0
  let intersection = 0
  for (const value of left) if (right.has(value)) intersection += 1
  return intersection / (left.size + right.size - intersection)
}

/** H2, которым домашний стиль обязывает закрывать почти каждую страницу. Это вёрстка, а не
 * содержание: «Куда дальше» стоит на 13 из 15 страниц /zarabotok/ и на стольких же в /ua/ и /en/.
 * Считать их дублированием — значит заливать гейт шумом ровно там, где всё здорово. */
const BOILERPLATE_H2 = new Set([
  'куда дальше', 'куди далі', 'where to next',
  'страницы раздела', 'сторінки розділу', 'pages in this section',
  'итог', 'підсумок', 'the bottom line', 'in short',
])

/** H2, открывающий блок FAQ. Вопросы внутри него разбираются отдельным правилом. */
const FAQ_H2 = new Set([
  'часто задаваемые вопросы', 'частые вопросы', 'вопросы и ответы',
  'часті питання', 'часті запитання', 'питання і відповіді',
  'frequently asked questions', 'common questions', 'faq',
])

/** Нижний регистр, снятая разметка, ё=е, без пунктуации и лишних пробелов. */
export function normalizeHeading(text) {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|[*_`~]/g, ' ')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Ключ для сравнения «почти одинаковых» заголовков: слова, обрезанные до 4 символов. Обрезка
 * снимает словоизменение («нужны»/«нужна», «приходят»/«приходит», «counted»/«counting») без
 * словаря и одинаково ведёт себя во всех трёх локалях. */
function headingKey(normalized) {
  return new Set(normalized.split(' ').filter(Boolean).map((word) => word.slice(0, 4)))
}

function headingsSimilar(left, right) {
  return jaccard(left, right) >= QUESTION_SIMILARITY
}

/** Содержательные H2 страницы и вопросы её FAQ (H3 внутри секции FAQ).
 * Блоки кода пропускаются: `#` в примере — не заголовок. */
export function sectionHeadings(body) {
  const h2 = []
  const faq = []
  let insideFaq = false
  let insideFence = false
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      insideFence = !insideFence
      continue
    }
    if (insideFence) continue
    const level2 = line.match(/^##\s+(.+?)\s*$/)
    if (level2) {
      const normalized = normalizeHeading(level2[1])
      insideFaq = FAQ_H2.has(normalized)
      if (!insideFaq && normalized && !BOILERPLATE_H2.has(normalized)) h2.push(normalized)
      continue
    }
    if (/^#\s+/.test(line)) {
      insideFaq = false
      continue
    }
    const level3 = line.match(/^###\s+(.+?)\s*$/)
    if (level3 && insideFaq) {
      const normalized = normalizeHeading(level3[1])
      if (normalized) faq.push(normalized)
    }
  }
  const unique = (list) => [...new Set(list)]
  return { h2: unique(h2), faq: unique(faq) }
}

/** Канонический хаб страницы. Для зарегистрированной берётся из манифеста, для новой —
 * из сегмента пути через тот же манифест, чтобы новая страница сравнивалась со своими
 * соседями, а не оказалась одна в собственной группе. */
export function hubOf(info) {
  return hubBySegment.get(info.zone) ?? info.zone
}

function headingProfile(body) {
  const { h2, faq } = sectionHeadings(body)
  return {
    h2,
    faq,
    h2Keys: h2.map(headingKey),
    faqKeys: faq.map(headingKey),
  }
}

/** Индекс эха по хабу: для каждой формулировки, реально написанной на какой-то странице хаба,
 * список страниц, где есть похожая.
 *
 * Считается «звездой» вокруг настоящей формулировки, а не транзитивным замыканием. Замыкание
 * склеивает далёкие тексты через цепочку посредников и выдаёт кластеры, которых никто не писал.
 * Но и звезда только вокруг собственного заголовка страницы была бы хуже: из трёх страниц,
 * где вопрос задан тремя способами, эхо из трёх увидела бы лишь та, чья формулировка оказалась
 * посередине, а две крайние прошли бы гейт. Поэтому якорем служит любая формулировка хаба:
 * страница попадает в звезду, если похожа на конкретный написанный кем-то заголовок. */
function buildEchoIndex(pages, field) {
  const byGroup = new Map()
  for (const page of pages) {
    const groupKey = `${page.hub} ${page.info.locale}`
    const group = byGroup.get(groupKey) ?? []
    group.push(page)
    byGroup.set(groupKey, group)
  }

  const index = new Map()
  for (const [groupKey, group] of byGroup) {
    const anchors = []
    for (const page of group) {
      const texts = page.headings[field]
      const keys = page.headings[`${field}Keys`]
      for (let i = 0; i < texts.length; i += 1) {
        const members = []
        for (const other of group) {
          if (other.headings[`${field}Keys`].some((candidate) => headingsSimilar(keys[i], candidate))) {
            members.push(other)
          }
        }
        anchors.push({ text: texts[i], key: keys[i], members })
      }
    }
    index.set(groupKey, { anchors, group })
  }
  return index
}

/** Для каждого заголовка страницы — самая широкая звезда, в которую он попадает.
 * Переводы того же semantic id эхом не считаются: это одна страница, а не две. */
function pageEchoes(index, page, field) {
  const { anchors = [], group = [] } = index.get(`${page.hub} ${page.info.locale}`) ?? {}
  const own = page.headings[field]
  const ownKeys = page.headings[`${field}Keys`]
  const rows = []
  for (let i = 0; i < own.length; i += 1) {
    // Собственная формулировка страницы — тоже якорь: в индексе её может не быть, если
    // проверяемый файл лежит вне каталога корпуса.
    const self = {
      text: own[i],
      key: ownKeys[i],
      members: group.filter((member) =>
        member.headings[`${field}Keys`].some((candidate) => headingsSimilar(ownKeys[i], candidate))
      ),
    }
    let best = null
    for (const anchor of [self, ...anchors]) {
      if (!headingsSimilar(ownKeys[i], anchor.key)) continue
      const others = anchor.members.filter(
        (member) => member.info.semanticId !== page.info.semanticId && member.rel !== page.rel
      )
      if (!best || others.length > best.length) best = others
    }
    if (best && best.length) {
      // Порядок обхода корпуса задан readdirSync и по платформам не совпадает: сортировка
      // делает текст нарушения воспроизводимым, иначе один и тот же корпус даёт разные логи.
      rows.push({
        text: own[i],
        // Ключ храповика: по нему формулировка сопоставляется со своей же версией на базе тем
        // самым сравнением «почти одинаковых», которым работает правило. Иначе исправленная
        // на странице опечатка в вопросе превращала бы старый долг в новое нарушение.
        key: ownKeys[i],
        echo: best.length + 1,
        others: best.map((member) => member.rel).sort(),
      })
    }
  }
  return rows.sort((left, right) => right.echo - left.echo || left.text.localeCompare(right.text))
}

/** Список файлов в сообщении о нарушении: полностью до четырёх, дальше — с хвостом-счётчиком,
 * чтобы строка лога оставалась читаемой. */
function listFiles(files) {
  if (files.length <= 4) return files.join(', ')
  return `${files.slice(0, 4).join(', ')} and ${files.length - 4} more`
}

/** Снимок корпуса: страницы с посчитанными шинглами/заголовками и индексы эха по хабам.
 * Строится и для рабочего дерева, и для базовой ревизии одним кодом — иначе храповик сравнивал
 * бы результаты двух разных реализаций правила и врал бы в обе стороны. */
function buildCorpus(entries) {
  const pages = entries.map(({ rel, text }) => {
    const info = pathInfo(rel)
    const parsed = parseFront(text)
    return {
      rel,
      info,
      parsed,
      hub: hubOf(info),
      shingles: shingles(parsed.body),
      shingles3: shingles(parsed.body, 3),
      headings: headingProfile(parsed.body),
    }
  })
  // Индексы эха строятся один раз на корпус: правило хабовое, и пересчитывать его на каждый
  // изменённый файл значит платить квадратом за один и тот же ответ.
  const contentPages = pages.filter((page) => page.info.isPage)
  return {
    pages,
    contentPages,
    faqIndex: buildEchoIndex(contentPages, 'faq'),
    h2Index: buildEchoIndex(contentPages, 'h2'),
  }
}

const NO_FINDINGS = { duplicate: { file: null, similarity: 0 }, paraphrase: [], faq: [], h2: [] }

/** Все зацепки дублирования для одной страницы внутри данного корпуса.
 *
 * paraphrase возвращается списком партнёров, а не худшим: храповику нужна личность пары. Худший
 * партнёр — величина неустойчивая (правка одной цифры меняет порядок соседей на третьем знаке), и
 * храповик по нему объявлял бы новым нарушением перестановку в хвосте. По списку пар вопрос ставится
 * ровно так, как надо: появилась ли у страницы пара, которой на базе не было. */
function pageFindings(corpus, page) {
  const currentShingles = shingles(page.body)
  const currentShingles3 = shingles(page.body, 3)
  let duplicate = { file: null, similarity: 0 }
  const paraphrase = []
  for (const candidate of corpus.contentPages) {
    // Другая страница той же локали. Переводы одного semantic id — не дубликаты друг друга.
    if (candidate.rel === page.rel) continue
    if (candidate.info.locale !== page.info.locale) continue
    if (candidate.info.semanticId === page.info.semanticId) continue
    const similarity = jaccard(currentShingles, candidate.shingles)
    if (similarity > duplicate.similarity) duplicate = { file: candidate.rel, similarity }
    const retell = jaccard(currentShingles3, candidate.shingles3)
    if (retell > PARAPHRASE_THRESHOLD) paraphrase.push({ file: candidate.rel, similarity: retell })
  }
  paraphrase.sort((left, right) => right.similarity - left.similarity || left.file.localeCompare(right.file))

  const current = { rel: page.rel, info: page.info, hub: page.hub, headings: headingProfile(page.body) }
  return {
    duplicate,
    paraphrase,
    faq: pageEchoes(corpus.faqIndex, current, 'faq').filter((row) => row.echo >= FAQ_ECHO_LIMIT),
    h2: pageEchoes(corpus.h2Index, current, 'h2').filter((row) => row.echo >= HEADING_ECHO_LIMIT),
  }
}

/** Та же зацепка была на базе? Для paraphrase тождество пары — путь партнёра; для эха — сама
 * формулировка, сопоставленная тем же «почти одинаковым» сравнением, что и внутри правила. */
function sameFinding(rule, finding, older) {
  if (rule === 'paraphrase') return finding.file === older.file
  return headingsSimilar(finding.key, older.key)
}

/** Разделить зацепки на внесённые этим изменением и унаследованные от базы.
 * `baseline === null` — храповик выключен: строгий режим, всё считается новым. */
function splitAgainstBaseline(rule, findings, baselineFindings) {
  if (!baselineFindings) return { fresh: findings, known: [] }
  const older =
    rule === 'paraphrase' ? baselineFindings.paraphrase
      : rule === 'faq-echo' ? baselineFindings.faq
      : baselineFindings.h2
  const fresh = []
  const known = []
  for (const finding of findings) {
    if (older.some((candidate) => sameFinding(rule, finding, candidate))) known.push(finding)
    else fresh.push(finding)
  }
  return { fresh, known }
}

const paraphraseMessage = (rows, locale) =>
  `retells ${rows[0].file} in ${locale} (jaccard3=${rows[0].similarity.toFixed(3)} > ${PARAPHRASE_THRESHOLD})` +
  (rows.length > 1 ? `; ${rows.length} pages of this locale are retold by this page` : '')

const faqEchoMessage = (rows, hub) =>
  `FAQ question "${rows[0].text}" is answered on ${rows[0].echo} pages of hub "${hub}" ` +
  `(>= ${FAQ_ECHO_LIMIT}): ${listFiles(rows[0].others)}` +
  (rows.length > 1 ? `; ${rows.length} questions of this page repeat the hub` : '')

const headingEchoMessage = (rows, hub) =>
  `H2 "${rows[0].text}" is repeated on ${rows[0].echo} pages of hub "${hub}" ` +
  `(>= ${HEADING_ECHO_LIMIT}): ${listFiles(rows[0].others)}` +
  (rows.length > 1 ? `; ${rows.length} sections of this page repeat the hub` : '')

/**
 * @param baseline Содержимое корпуса на базовой ревизии: Map<путь, текст файла>. Включает храповик
 *   для правил paraphrase/faq-echo/heading-echo. `null` — базы нет, храповик выключен, правила
 *   работают строго (fail-closed: недоступность базы не должна ослаблять гейт).
 */
export function runLint({
  corpusDir,
  changedFiles,
  root = process.cwd(),
  addedFiles = null,
  enforceWaveCap = true,
  baseline = null,
}) {
  const violations = []
  const inherited = []
  const fail = (rule, file, message) => violations.push({ rule, file, msg: message })
  const debt = (rule, file, message) => inherited.push({ rule, file, msg: message })
  const ratchet = { enabled: Boolean(baseline), basePages: baseline ? baseline.size : 0 }

  if (!corpusDir) return { fatal: 'missing --corpus', violations, inherited, ratchet }
  const corpusRoot = resolve(root, corpusDir)
  if (!existsSync(corpusRoot)) return { fatal: `--corpus not found: ${corpusDir}`, violations, inherited, ratchet }
  const corpusFiles = listMarkdown(corpusRoot)
  if (!corpusFiles.length) return { fatal: `--corpus empty: ${corpusDir}`, violations, inherited, ratchet }

  const corpus = buildCorpus(
    corpusFiles.map((file) => ({ rel: normalPath(relative(root, file)), text: readFileSync(file, 'utf8') }))
  )

  const urlMap = new Map()
  const semanticSeoIds = new Set()
  const semanticFiles = new Map()
  for (const page of corpus.pages) {
    if (!page.info.isPage) continue
    const paths = urlMap.get(page.info.url) ?? []
    paths.push(page.rel)
    urlMap.set(page.info.url, paths)
    const semanticPaths = semanticFiles.get(page.info.semanticId) ?? []
    semanticPaths.push(page.rel)
    semanticFiles.set(page.info.semanticId, semanticPaths)
    if (page.parsed.seo) semanticSeoIds.add(page.info.semanticId)
  }

  // Базовый корпус собирается лениво и один раз: он нужен, только если храповик включён и до него
  // дошла хоть одна гейтируемая страница.
  let baseCorpus = null
  const baselineFindings = (rel, info, hub) => {
    if (!baseline) return null
    const text = baseline.get(rel)
    // Страницы не было на базе — сравнивать не с чем, любое её нарушение внесено этим изменением.
    if (text === undefined) return NO_FINDINGS
    if (!baseCorpus) {
      baseCorpus = buildCorpus([...baseline].map(([path, content]) => ({ rel: path, text: content })))
    }
    return pageFindings(baseCorpus, { rel, info, hub, body: parseFront(text).body })
  }

  const inspectedSemanticIds = new Set()
  const newSemanticIds = new Set()
  let inspected = 0
  const skipped = { deleted: 0, nonpage: 0, otherzone: 0 }

  for (const changed of changedFiles.map(normalPath)) {
    const info = pathInfo(changed)
    const gated = isPotentialContentPath(changed)
    if (!info.isPage) {
      if (gated) fail('path', changed, 'content path must be docs/<locale?>/<hub>/<slug>.md with exactly one slug segment')
      else skipped.nonpage += 1
      continue
    }
    if (!info.validZone) {
      if (gated) fail('path', changed, `zone "${info.zone}" is not a fleet content hub`)
      else skipped.otherzone += 1
      continue
    }

    const absolute = resolve(root, changed)
    if (!existsSync(absolute)) {
      skipped.deleted += 1
      continue
    }

    const text = readFileSync(absolute, 'utf8')
    const parsed = parseFront(text)
    for (const pattern of REDIRECT_PATTERNS) {
      if (pattern.test(text)) {
        fail('redirect', changed, `doorway redirect pattern matched: ${pattern}`)
        break
      }
    }

    if (!info.validSlug) fail('path', changed, `slug "${info.slug}" must match ^[a-z0-9-]+$`)
    if (!info.registered) {
      fail('registry', changed, 'page is absent from docs/content-pages.json')
    }

    const others = (urlMap.get(info.url) ?? []).filter((path) => resolve(root, path) !== absolute)
    if (others.length) fail('uniqueness', changed, `URL ${info.url} collides with ${others.join(', ')}`)

    if (!info.isHub && !parsed.hasProvenance) {
      fail('provenance', changed, 'missing frontmatter provenance.snapshot_date')
    }

    const isAdded = addedFiles === null || addedFiles.has(changed)
    if (parsed.seo && isAdded) {
      const siblings = semanticFiles.get(info.semanticId) ?? []
      const existedBefore = addedFiles !== null && siblings.some((path) => !addedFiles.has(path))
      if (!existedBefore) newSemanticIds.add(info.semanticId)
    }

    const hub = hubOf(info)
    const findings = pageFindings(corpus, { rel: changed, info, hub, body: parsed.body })
    // Дословная копипаста храповиком не покрывается: порог 0.30 недостижим для честной правки,
    // и «оно и раньше было скопировано» — не оправдание для страницы, которую волна трогает.
    if (findings.duplicate.similarity > DUP_THRESHOLD) {
      fail(
        'duplicate',
        changed,
        `near-duplicate of ${findings.duplicate.file} in ${info.locale} ` +
          `(jaccard=${findings.duplicate.similarity.toFixed(2)} > ${DUP_THRESHOLD})`
      )
    }

    const older = baselineFindings(changed, info, hub)
    const paraphrase = splitAgainstBaseline('paraphrase', findings.paraphrase, older)
    if (paraphrase.fresh.length) fail('paraphrase', changed, paraphraseMessage(paraphrase.fresh, info.locale))
    if (paraphrase.known.length) debt('paraphrase', changed, paraphraseMessage(paraphrase.known, info.locale))

    const faqEcho = splitAgainstBaseline('faq-echo', findings.faq, older)
    if (faqEcho.fresh.length) fail('faq-echo', changed, faqEchoMessage(faqEcho.fresh, hub))
    if (faqEcho.known.length) debt('faq-echo', changed, faqEchoMessage(faqEcho.known, hub))

    const headingEcho = splitAgainstBaseline('heading-echo', findings.h2, older)
    if (headingEcho.fresh.length) fail('heading-echo', changed, headingEchoMessage(headingEcho.fresh, hub))
    if (headingEcho.known.length) debt('heading-echo', changed, headingEchoMessage(headingEcho.known, hub))

    inspected += 1
    inspectedSemanticIds.add(info.semanticId)
  }

  if (enforceWaveCap && newSemanticIds.size > CAP_NEW_PER_WAVE) {
    fail('cap', '(branch)', `${newSemanticIds.size} new semantic SEO pages > ${CAP_NEW_PER_WAVE} per wave`)
  }
  if (semanticSeoIds.size > CAP_TOTAL) {
    fail('cap', '(corpus)', `${semanticSeoIds.size} semantic SEO pages > ${CAP_TOTAL}`)
  }

  return {
    fatal: null,
    violations,
    inherited,
    ratchet: { ...ratchet, fresh: violations.length, known: inherited.length },
    inspected,
    skipped,
    stats: {
      changed: changedFiles.length,
      semanticInspected: inspectedSemanticIds.size,
      semanticNew: newSemanticIds.size,
      semanticTotal: semanticSeoIds.size,
    },
  }
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--corpus') args.corpus = argv[++i]
    else if (argv[i] === '--base') args.base = argv[++i]
    else if (argv[i] === '--changed') args.changed = argv[++i]
    else if (argv[i] === '--root') args.root = argv[++i]
    else if (argv[i] === '--skip-wave-cap') args.skipWaveCap = true
  }
  return args
}

function refExists(root, ref) {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}^{commit}`], { cwd: root, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function resolveBase(args, root) {
  if (args.changed !== undefined) return null
  const requested = args.base || 'origin/develop'
  if (refExists(root, requested)) return requested
  if (refExists(root, 'origin/develop')) return 'origin/develop'
  throw new Error(`base ref unreachable: ${requested} (and origin/develop)`)
}

function gitDiffPaths(root, base, diffFilter = null) {
  const args = ['diff', '--name-only']
  if (diffFilter) args.push(`--diff-filter=${diffFilter}`)
  args.push(`${base}...HEAD`, '--', 'docs')
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map((path) => path.trim())
    .filter(Boolean)
}

function resolveChanged(args, root, base) {
  if (args.changed !== undefined) {
    return args.changed.split(',').map((path) => path.trim()).filter(Boolean)
  }
  return gitDiffPaths(root, base).filter((path) => path.endsWith('.md') && isPotentialContentPath(path))
}

function resolveAdded(root, base) {
  if (!base) return null
  return new Set(gitDiffPaths(root, base, 'A'))
}

/** Корпус базовой ревизии целиком (не только изменённые файлы): правила эха и пересказа хабовые,
 * и «было ли это нарушение раньше» отвечается только против всех соседей той же ревизии. */
const GIT_BUFFER = 512 * 1024 * 1024

function readBaseBlobs(root, base, paths) {
  const input = `${paths.map((path) => `${base}:${path}`).join('\n')}\n`
  // Один процесс на весь корпус вместо `git show` на файл. Ответ разбирается по байтам: размер в
  // заголовке батча байтовый, а корпус — кириллица, и посимвольная нарезка рассинхронизировала бы
  // поток на первой же странице.
  const out = execFileSync('git', ['cat-file', '--batch'], { cwd: root, input, maxBuffer: GIT_BUFFER })
  const files = new Map()
  let offset = 0
  for (const path of paths) {
    const eol = out.indexOf(0x0a, offset)
    if (eol < 0) break
    const header = out.toString('utf8', offset, eol)
    offset = eol + 1
    // «<oid> missing» — тела за строкой нет, поток остаётся синхронным.
    const match = header.match(/^\S+ blob (\d+)$/)
    if (!match) continue
    const size = Number(match[1])
    files.set(path, out.toString('utf8', offset, offset + size))
    offset += size + 1
  }
  return files
}

/** Слепок корпуса на базовой ревизии для храповика. Недоступность базы — не повод ослабить гейт:
 * возвращается `map: null` с причиной, вызывающая сторона обязана сказать это вслух и судить строго. */
function loadBaseline(root, base, corpusDir) {
  if (!base) return { map: null, ref: null, reason: 'no base revision (--changed given explicitly)' }
  try {
    const listing = execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', base, '--', corpusDir], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: GIT_BUFFER,
    })
    const paths = listing.split('\0').map((path) => path.trim()).filter((path) => path.endsWith('.md'))
    return { map: paths.length ? readBaseBlobs(root, base, paths) : new Map(), ref: base, reason: null }
  } catch (error) {
    return { map: null, ref: base, reason: `baseline unreadable at ${base}: ${error.message}` }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const root = args.root ? resolve(args.root) : process.cwd()
  if (!args.corpus) {
    console.error('FATAL: --corpus <dir> is required')
    process.exit(2)
  }

  let changed
  let added
  let baseline
  try {
    const base = resolveBase(args, root)
    changed = resolveChanged(args, root, base)
    added = resolveAdded(root, base)
    baseline = loadBaseline(root, base, args.corpus)
  } catch (error) {
    console.error(`FATAL: cannot resolve changed files: ${error.message}`)
    process.exit(2)
  }

  const result = runLint({
    corpusDir: args.corpus,
    changedFiles: changed,
    root,
    addedFiles: added,
    enforceWaveCap: !args.skipWaveCap,
    baseline: baseline.map,
  })
  if (result.fatal) {
    console.error(`FATAL: ${result.fatal}`)
    process.exit(2)
  }

  const ratchet = result.ratchet.enabled
    ? `ratchet=on base=${baseline.ref} base_pages=${result.ratchet.basePages} ` +
      `new=${result.ratchet.fresh} inherited=${result.ratchet.known}`
    : `ratchet=off strict=on new=${result.ratchet.fresh}`

  if (!result.ratchet.enabled) {
    console.error(
      `anti-doorway-lint: RATCHET OFF — ${baseline.reason}. ` +
        'paraphrase/faq-echo/heading-echo judge the full text of every changed page, ' +
        'including duplication that predates this change.'
    )
  }
  // Долг печатается всегда, в том числе на зелёной сборке: гейт, который молчит об известном
  // дублировании, ничего не гейтит — он просто переносит его в невидимую часть корпуса.
  if (result.inherited.length) {
    console.error(
      `anti-doorway-lint: ${result.inherited.length} KNOWN DEBT item(s) — ` +
        `this duplication already existed at ${baseline.ref} and does NOT fail the build:`
    )
    for (const item of result.inherited) {
      console.error(`  [debt:${item.rule}] ${item.file}: ${item.msg}`)
    }
  }
  if (result.violations.length) {
    console.error(`anti-doorway-lint: ${result.violations.length} violation(s) introduced by this change:`)
    for (const violation of result.violations) {
      console.error(`  [${violation.rule}] ${violation.file}: ${violation.msg}`)
    }
    console.error(`anti-doorway-lint: ${ratchet}`)
    process.exit(1)
  }

  const skipped = result.skipped
  console.log(
    'anti-doorway-lint: OK ' +
      `(changed=${result.stats.changed} inspected=${result.inspected} ` +
      `deleted=${skipped.deleted} nonpage=${skipped.nonpage} otherzone=${skipped.otherzone} ` +
      `semantic_inspected=${result.stats.semanticInspected} semantic_new=${result.stats.semanticNew} ` +
      `semantic_total=${result.stats.semanticTotal} ${ratchet})`
  )
}

if (import.meta.url === `file://${process.argv[1]}`) main()
