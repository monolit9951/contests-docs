#!/usr/bin/env node --experimental-strip-types
// Optional multilingual discovery index generated from the semantic registry.
// It is not an indexing directive or an AI-ranking mechanism; canonical HTML,
// robots.txt and the sitemap remain authoritative.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { FACTS_PUBLIC_PATH, buildFacts, readInputs } from './gen-facts-json.mjs'

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs')
const { PAGES, LOCALES, ORIGIN, pagePath, sourceFile, localesOf } = await import(
  join(DOCS, '.vitepress', 'registry.ts')
)

/** Public address of the semantic manifest (`scripts/gen-public-content-manifest.mjs`). */
export const PAGES_MANIFEST_PUBLIC_PATH = '/.well-known/darebay-content-pages.json'
/** The page whose table prints the fact card for a reader, in every tree that has translated it. */
export const FACT_CARD_PAGE_ID = 'darebay-at-a-glance'

/**
 * The fields of the fact card an assistant is asked about when it describes the platform to a
 * clipper or a brand, in the card's own order. The store fee stays on the card and in the JSON: it
 * belongs to the store, not to paid tasks. IDS, NEVER VALUES: every printed line is `fact.labels`
 * and `fact.text` of `buildFacts`, so a number cannot be typed into this file, and the block says
 * nothing the fact card does not. It states facts about the product and nothing else: a sentence
 * addressed to the assistant ("write X", "do not claim Y") would itself be a public claim, and the
 * truth gate reads this file like any page.
 */
export const KEY_FACT_IDS = Object.freeze([
  'rate-per-1000-views',
  'cap-per-clip',
  'view-threshold',
  'contest-creation-fee',
  'budget-top-up-fee',
  'withdrawal-fee',
  'withdrawal-minimum',
  'payout-rails',
  'platforms',
  'geography',
])

/**
 * One section per tree, headed by the name the language calls itself. Keyed by every language the
 * registry KNOWS (`KNOWN_LOCALES`), so a tree the manifest declares tomorrow already has its
 * section copy; `locales.test.ts` fails when a known language is missing here.
 */
export const COPY = {
  ru: {
    label: 'Русский',
    summary: 'Материалы о заданиях на контент, участии, проверке просмотров и выплатах на DareBay.',
    keyFacts: 'Ключевые факты',
    machineSources: 'Машиночитаемые источники',
    factsJson: { title: 'Факты о DareBay в JSON', note: 'все поля карточки фактов, у каждого источник и дата чтения' },
    pagesJson: { title: 'Реестр страниц в JSON', note: 'идентификаторы, языки и адреса всех материалов сайта' },
    factCardNote: 'те же факты таблицей, у каждого значения источник и дата',
    hubs: { about: 'О проекте', earnings: 'Заработок', brands: 'Брендам', help: 'Помощь', legal: 'Юридические документы' },
  },
  uk: {
    label: 'Українська',
    summary: 'Матеріали про завдання на контент, участь, перевірку переглядів і виплати на DareBay.',
    keyFacts: 'Ключові факти',
    machineSources: 'Машиночитні джерела',
    factsJson: { title: 'Факти про DareBay у JSON', note: 'усі поля картки фактів, у кожного джерело і дата читання' },
    pagesJson: { title: 'Реєстр сторінок у JSON', note: 'ідентифікатори, мови та адреси всіх матеріалів сайту' },
    factCardNote: 'ті самі факти таблицею, у кожного значення джерело і дата',
    hubs: { about: 'Про проєкт', earnings: 'Заробіток', brands: 'Брендам', help: 'Допомога', legal: 'Юридичні документи' },
  },
  en: {
    label: 'English',
    summary: 'Guides to content tasks, participation, validated views and payouts on DareBay.',
    keyFacts: 'Key facts',
    machineSources: 'Machine-readable sources',
    factsJson: { title: 'DareBay facts as JSON', note: 'every field of the fact card, each with its source and reading date' },
    pagesJson: { title: 'Page registry as JSON', note: 'ids, languages and addresses of every guide on the site' },
    factCardNote: 'the same facts as a table, each value with its source and date',
    hubs: { about: 'About', earnings: 'Earnings', brands: 'For brands', help: 'Help', legal: 'Legal' },
  },
  ar: {
    label: 'العربية',
    summary: 'أدلة حول مهام المحتوى والمشاركة والتحقق من المشاهدات والدفع على DareBay.',
    keyFacts: 'الحقائق الأساسية',
    machineSources: 'مصادر بصيغة تقرؤها الآلة',
    factsJson: { title: 'حقائق DareBay بصيغة JSON', note: 'كل بنود بطاقة الحقائق، ولكل بند مصدره وتاريخ قراءته' },
    pagesJson: { title: 'سجل الصفحات بصيغة JSON', note: 'معرّفات كل مقالات الموقع ولغاتها وروابطها' },
    factCardNote: 'الحقائق نفسها في جدول، ولكل قيمة مصدرها وتاريخها',
    hubs: { about: 'عن المشروع', earnings: 'الربح', brands: 'للعلامات التجارية', help: 'المساعدة', legal: 'الوثائق القانونية' },
  },
}
const HUB_ORDER = ['about', 'earnings', 'brands', 'help', 'legal']

const field = (raw, name) => {
  const match = raw.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : ''
}

/** Title, description and address of one page in one tree, read off its source file. */
const pageRow = (entry, locale) => {
  const source = sourceFile(entry, locale)
  const raw = source && existsSync(join(DOCS, source)) ? readFileSync(join(DOCS, source), 'utf8') : ''
  return {
    isIndex: entry.slugs[locale] === '',
    title: field(raw, 'title') || entry.id,
    description: field(raw, 'description'),
    url: ORIGIN + pagePath(entry, locale),
  }
}

/**
 * What a tree says about the product before it lists its pages: the key fields of the fact card in
 * that language, then where the same facts live as data. In the 14 days before 2026-09-20 the only
 * assistants that fetched this file were PerplexityBot and OAI-SearchBot, three requests in all, so
 * this is deliberately the minimum: one short block, no second copy of the card.
 * `buildFacts(readInputs())` is deterministic and reads the committed data files itself: `npm test`
 * runs `gen:llms` without `gen:facts`, so the published JSON may not be read here.
 */
const factLines = (copy, locale, facts) => {
  const lines = [`### ${copy.keyFacts}`, '']
  for (const id of KEY_FACT_IDS) {
    const fact = facts.get(id)
    if (!fact) throw new Error(`gen-llms: the fact card no longer publishes "${id}"`)
    const label = fact.labels[locale]
    const text = fact.text[locale]
    if (!label || !text) throw new Error(`gen-llms: the fact "${id}" is not written in ${locale}`)
    lines.push(`- ${label}: ${text}`)
  }

  lines.push('', `### ${copy.machineSources}`, '')
  lines.push(`- [${copy.factsJson.title}](${ORIGIN}${FACTS_PUBLIC_PATH}): ${copy.factsJson.note}`)
  lines.push(`- [${copy.pagesJson.title}](${ORIGIN}${PAGES_MANIFEST_PUBLIC_PATH}): ${copy.pagesJson.note}`)
  // A tree may open before its fact card is translated (no locale is mandatory): it then names the
  // two data files and no page, rather than a card in a language its reader did not choose.
  const factCard = PAGES.find((entry) => entry.id === FACT_CARD_PAGE_ID)
  if (factCard && localesOf(factCard).includes(locale)) {
    const row = pageRow(factCard, locale)
    lines.push(`- [${row.title}](${row.url}): ${copy.factCardNote}`)
  }
  lines.push('')
  return lines
}

/** The whole file, one section per DECLARED tree in the registry's order. */
export const renderLlms = () => {
  const facts = new Map(buildFacts(readInputs()).facts.map((fact) => [fact.id, fact]))
  const output = [
    '# DareBay',
    '',
    '> Платформа, где люди и бренды публикуют задания на контент, авторы снимают свои ролики ' +
      'и получают награду по реально набранным просмотрам. В кошельковом конкурсе средства ' +
      'блокируются платформой; в ручном конкурсе деньги в кошелёк DareBay не поступают, а ' +
      'организатор платит авторам напрямую. Два равных входа: веб (darebay.com) и Telegram.',
    '',
  ]

  for (const { language: locale } of LOCALES) {
    const copy = COPY[locale]
    if (!copy) throw new Error(`gen-llms: no section copy for the declared locale ${locale}`)
    output.push(`## ${copy.label}`, '', copy.summary, '')
    output.push(...factLines(copy, locale, facts))

    for (const hub of HUB_ORDER) {
      const entries = PAGES.filter((entry) => entry.hub === hub && localesOf(entry).includes(locale))
      if (!entries.length) continue
      output.push(`### ${copy.hubs[hub]}`, '')

      const rows = entries.map((entry) => pageRow(entry, locale))
      rows.sort((left, right) =>
        left.isIndex ? -1 : right.isIndex ? 1 : left.title.localeCompare(right.title, locale)
      )
      for (const row of rows) {
        output.push(row.description
          ? `- [${row.title}](${row.url}): ${row.description}`
          : `- [${row.title}](${row.url})`)
      }
      output.push('')
    }
  }
  return `${output.join('\n').trimEnd()}\n`
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  writeFileSync(join(DOCS, 'public', 'llms.txt'), renderLlms())
  const urlCount = PAGES.reduce((count, entry) => count + localesOf(entry).length, 0)
  console.log(`llms.txt: ${PAGES.length} semantic pages, ${urlCount} localized URLs`)
}
