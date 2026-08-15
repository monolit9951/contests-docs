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

export function runLint({
  corpusDir,
  changedFiles,
  root = process.cwd(),
  addedFiles = null,
  enforceWaveCap = true,
}) {
  const violations = []
  const fail = (rule, file, message) => violations.push({ rule, file, msg: message })

  if (!corpusDir) return { fatal: 'missing --corpus', violations }
  const corpusRoot = resolve(root, corpusDir)
  if (!existsSync(corpusRoot)) return { fatal: `--corpus not found: ${corpusDir}`, violations }
  const corpusFiles = listMarkdown(corpusRoot)
  if (!corpusFiles.length) return { fatal: `--corpus empty: ${corpusDir}`, violations }

  const urlMap = new Map()
  const corpusPages = []
  const semanticSeoIds = new Set()
  const semanticFiles = new Map()

  for (const file of corpusFiles) {
    const rel = normalPath(relative(root, file))
    const info = pathInfo(rel)
    const parsed = parseFront(readFileSync(file, 'utf8'))
    if (info.isPage) {
      const paths = urlMap.get(info.url) ?? []
      paths.push(rel)
      urlMap.set(info.url, paths)
      const semanticPaths = semanticFiles.get(info.semanticId) ?? []
      semanticPaths.push(rel)
      semanticFiles.set(info.semanticId, semanticPaths)
      if (parsed.seo) semanticSeoIds.add(info.semanticId)
    }
    corpusPages.push({
      rel,
      info,
      parsed,
      hub: hubOf(info),
      shingles: shingles(parsed.body),
      shingles3: shingles(parsed.body, 3),
      headings: headingProfile(parsed.body),
    })
  }

  // Индексы эха строятся один раз по корпусу: правило хабовое, и пересчитывать его на каждый
  // изменённый файл значит платить квадратом за один и тот же ответ.
  const contentPages = corpusPages.filter((page) => page.info.isPage)
  const faqIndex = buildEchoIndex(contentPages, 'faq')
  const h2Index = buildEchoIndex(contentPages, 'h2')

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

    // Другая страница той же локали. Переводы одного semantic id — не дубликаты друг друга.
    const peers = corpusPages.filter(
      (candidate) =>
        candidate.info.isPage &&
        candidate.rel !== changed &&
        candidate.info.locale === info.locale &&
        candidate.info.semanticId !== info.semanticId
    )
    const hub = hubOf(info)

    const currentShingles = shingles(parsed.body)
    const currentShingles3 = shingles(parsed.body, 3)
    let worst = { file: null, similarity: 0 }
    let worstParaphrase = { file: null, similarity: 0 }
    for (const candidate of peers) {
      const similarity = jaccard(currentShingles, candidate.shingles)
      if (similarity > worst.similarity) worst = { file: candidate.rel, similarity }
      const paraphrase = jaccard(currentShingles3, candidate.shingles3)
      if (paraphrase > worstParaphrase.similarity) {
        worstParaphrase = { file: candidate.rel, similarity: paraphrase }
      }
    }
    if (worst.similarity > DUP_THRESHOLD) {
      fail(
        'duplicate',
        changed,
        `near-duplicate of ${worst.file} in ${info.locale} (jaccard=${worst.similarity.toFixed(2)} > ${DUP_THRESHOLD})`
      )
    }
    if (worstParaphrase.similarity > PARAPHRASE_THRESHOLD) {
      fail(
        'paraphrase',
        changed,
        `retells ${worstParaphrase.file} in ${info.locale} ` +
          `(jaccard3=${worstParaphrase.similarity.toFixed(3)} > ${PARAPHRASE_THRESHOLD})`
      )
    }

    const current = { rel: changed, info, hub, headings: headingProfile(parsed.body) }
    const faqEchoes = pageEchoes(faqIndex, current, 'faq')
      .filter((row) => row.echo >= FAQ_ECHO_LIMIT)
    if (faqEchoes.length) {
      const [top] = faqEchoes
      fail(
        'faq-echo',
        changed,
        `FAQ question "${top.text}" is answered on ${top.echo} pages of hub "${hub}" ` +
          `(>= ${FAQ_ECHO_LIMIT}): ${listFiles(top.others)}` +
          (faqEchoes.length > 1 ? `; ${faqEchoes.length} questions of this page repeat the hub` : '')
      )
    }

    const h2Echoes = pageEchoes(h2Index, current, 'h2')
      .filter((row) => row.echo >= HEADING_ECHO_LIMIT)
    if (h2Echoes.length) {
      const [top] = h2Echoes
      fail(
        'heading-echo',
        changed,
        `H2 "${top.text}" is repeated on ${top.echo} pages of hub "${hub}" ` +
          `(>= ${HEADING_ECHO_LIMIT}): ${listFiles(top.others)}` +
          (h2Echoes.length > 1 ? `; ${h2Echoes.length} sections of this page repeat the hub` : '')
      )
    }

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

function main() {
  const args = parseArgs(process.argv.slice(2))
  const root = args.root ? resolve(args.root) : process.cwd()
  if (!args.corpus) {
    console.error('FATAL: --corpus <dir> is required')
    process.exit(2)
  }

  let changed
  let added
  try {
    const base = resolveBase(args, root)
    changed = resolveChanged(args, root, base)
    added = resolveAdded(root, base)
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
  })
  if (result.fatal) {
    console.error(`FATAL: ${result.fatal}`)
    process.exit(2)
  }
  if (result.violations.length) {
    console.error(`anti-doorway-lint: ${result.violations.length} violation(s):`)
    for (const violation of result.violations) {
      console.error(`  [${violation.rule}] ${violation.file}: ${violation.msg}`)
    }
    process.exit(1)
  }

  const skipped = result.skipped
  console.log(
    'anti-doorway-lint: OK ' +
      `(changed=${result.stats.changed} inspected=${result.inspected} ` +
      `deleted=${skipped.deleted} nonpage=${skipped.nonpage} otherzone=${skipped.otherzone} ` +
      `semantic_inspected=${result.stats.semanticInspected} semantic_new=${result.stats.semanticNew} ` +
      `semantic_total=${result.stats.semanticTotal})`
  )
}

if (import.meta.url === `file://${process.argv[1]}`) main()
