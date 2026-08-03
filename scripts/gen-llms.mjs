#!/usr/bin/env node --experimental-strip-types
//
// Generates docs/public/llms.txt from the registry.
//
// WHY IT MATTERS MORE THAN IT LOOKS. Over 21.03–03.08 the assistant crawlers hit
// this domain 7 826 times against YandexBot's 598 — OpenAI 3 987, ClaudeBot
// 3 452, Perplexity 240 — and the only thing they can read is this static
// content, because they do not run JavaScript and the app is a SPA. llms.txt is
// the one file that tells them what is here in one request.
//
// The hand-written version listed six zone indexes, every one of them at an
// address this migration retires, and not a single article. Generated from the
// registry it lists every page with the page's own description, and it cannot
// go stale.
//
//   node --experimental-strip-types scripts/gen-llms.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DOCS = join(HERE, '..', 'docs')

const { PAGES, HUBS, ORIGIN, ROOT_LOCALE, pagePath, sourceFile, localesOf } = await import(
    join(DOCS, '.vitepress', 'registry.ts')
)

const HUB_TITLES = {
    about: 'О проекте',
    earnings: 'Заработок',
    brands: 'Брендам',
    help: 'Помощь',
    legal: 'Юридические документы',
}
const ORDER = ['about', 'earnings', 'brands', 'help', 'legal']

const field = (raw, name) => {
    const m = raw.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
}

const lang = ROOT_LOCALE.language
const out = []

out.push('# DareBay')
out.push('')
out.push(
    '> Платформа, где люди и бренды публикуют задания на контент, авторы снимают свои ролики ' +
        'и получают награду по реально набранным просмотрам. Награду заказчик вносит заранее, ' +
        'и до конца задания она заблокирована на площадке, поэтому ни одной из сторон не нужно ' +
        'верить другой на слово. Два равных входа: веб (darebay.com) и Telegram.'
)
out.push('')

for (const hubId of ORDER) {
    const entries = PAGES.filter((e) => e.hub === hubId && localesOf(e).includes(lang))
    if (!entries.length) continue

    out.push(`## ${HUB_TITLES[hubId] ?? hubId}`)
    out.push('')

    const rows = entries.map((entry) => {
        const file = join(DOCS, sourceFile(entry, lang))
        const raw = existsSync(file) ? readFileSync(file, 'utf8') : ''
        return {
            isIndex: entry.slugs[lang] === '',
            title: field(raw, 'title') || entry.id,
            description: field(raw, 'description'),
            url: ORIGIN + pagePath(entry, lang),
        }
    })

    // Index first — it is the page that describes the section — then alphabetical.
    rows.sort((a, b) => (a.isIndex ? -1 : b.isIndex ? 1 : a.title.localeCompare(b.title, 'ru')))

    for (const row of rows) {
        out.push(row.description ? `- [${row.title}](${row.url}): ${row.description}` : `- [${row.title}](${row.url})`)
    }
    out.push('')
}

const target = join(DOCS, 'public', 'llms.txt')
writeFileSync(target, `${out.join('\n').trimEnd()}\n`)
console.log(`llms.txt: ${PAGES.filter((e) => localesOf(e).includes(lang)).length} страниц`)
