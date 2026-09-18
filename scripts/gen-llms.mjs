#!/usr/bin/env node --experimental-strip-types
// Optional multilingual discovery index generated from the semantic registry.
// It is not an indexing directive or an AI-ranking mechanism; canonical HTML,
// robots.txt and the sitemap remain authoritative.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs')
const { PAGES, LOCALES, ORIGIN, pagePath, sourceFile, localesOf } = await import(
  join(DOCS, '.vitepress', 'registry.ts')
)

/**
 * One section per tree, headed by the name the language calls itself. Keyed by every language the
 * registry KNOWS (`KNOWN_LOCALES`), so a tree the manifest declares tomorrow already has its
 * section copy; `locales.test.ts` fails when a known language is missing here.
 */
export const COPY = {
  ru: {
    label: 'Русский',
    summary: 'Материалы о заданиях на контент, участии, проверке просмотров и выплатах на DareBay.',
    hubs: { about: 'О проекте', earnings: 'Заработок', brands: 'Брендам', help: 'Помощь', legal: 'Юридические документы' },
  },
  uk: {
    label: 'Українська',
    summary: 'Матеріали про завдання на контент, участь, перевірку переглядів і виплати на DareBay.',
    hubs: { about: 'Про проєкт', earnings: 'Заробіток', brands: 'Брендам', help: 'Допомога', legal: 'Юридичні документи' },
  },
  en: {
    label: 'English',
    summary: 'Guides to content tasks, participation, validated views and payouts on DareBay.',
    hubs: { about: 'About', earnings: 'Earnings', brands: 'For brands', help: 'Help', legal: 'Legal' },
  },
  ar: {
    label: 'العربية',
    summary: 'أدلة حول مهام المحتوى والمشاركة والتحقق من المشاهدات والدفع على DareBay.',
    hubs: { about: 'عن المشروع', earnings: 'الربح', brands: 'للعلامات التجارية', help: 'المساعدة', legal: 'الوثائق القانونية' },
  },
}
const HUB_ORDER = ['about', 'earnings', 'brands', 'help', 'legal']

const field = (raw, name) => {
  const match = raw.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : ''
}

/** The whole file, one section per DECLARED tree in the registry's order. */
export const renderLlms = () => {
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

    for (const hub of HUB_ORDER) {
      const entries = PAGES.filter((entry) => entry.hub === hub && localesOf(entry).includes(locale))
      if (!entries.length) continue
      output.push(`### ${copy.hubs[hub]}`, '')

      const rows = entries.map((entry) => {
        const source = sourceFile(entry, locale)
        const raw = source && existsSync(join(DOCS, source)) ? readFileSync(join(DOCS, source), 'utf8') : ''
        return {
          isIndex: entry.slugs[locale] === '',
          title: field(raw, 'title') || entry.id,
          description: field(raw, 'description'),
          url: ORIGIN + pagePath(entry, locale),
        }
      })
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
