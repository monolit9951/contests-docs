#!/usr/bin/env node --experimental-strip-types
//
// Prints the address table as markdown, derived from the registry.
//
// The table is a review artifact for a human — the founder approves the move by
// reading it — but it must never become a SECOND source of truth that drifts
// from the registry. So it is generated, never written: regenerate instead of
// editing, and a stale copy is a diff away from being caught.
//
//   node --experimental-strip-types scripts/print-addresses.mjs > ADDRESSES.md

import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const { PAGES, HUBS, ORPHAN_REDIRECTS, pagePath, localesOf, redirectMap, xDefaultLocaleOf } = await import(
    join(HERE, '..', 'docs', '.vitepress', 'registry.ts')
)

const HUB_TITLES = {
    earnings: 'Заработок',
    brands: 'Брендам',
    help: 'Помощь',
    about: 'О проекте',
    legal: 'Правовое',
}

// Why each orphan redirect has no page of its own. Keyed by address, so a new
// orphan without a reason stops this script instead of silently dropping out of
// the table the founder reads.
const ORPHAN_REASONS = {
    '/docs/ru/kak-rabotaet/':
        'дублировал лендинг приложения «Как это работает», который переведён на три языка и остаётся в SPA',
    '/docs/sitemap.xml':
        'сайтмап старого дерева `/docs/`; с 04.08.2026 его заменил `/sitemap-content.xml`, а GPTBot продолжал запрашивать старый адрес и получал 404',
}

const out = []
out.push('# Таблица адресов контента')
out.push('')
out.push('> ⚙️ **Сгенерировано** из `docs/.vitepress/registry.ts`. Руками не править —')
out.push('> `node --experimental-strip-types scripts/print-addresses.mjs > ADDRESSES.md`.')
out.push('')

const total = PAGES.length
const urls = PAGES.reduce((n, e) => n + localesOf(e).length, 0)
const redirects = Object.keys(redirectMap()).length
out.push(`Страниц: **${total}** · адресов: **${urls}** · редиректов со старых адресов: **${redirects}**`)
out.push('')
out.push('Страница объявляет только те языки, на которых она действительно существует: той,')
out.push('которой нет на языке, в сайтмапе этой локали и в hreflang нет вообще. Русская версия')
out.push('не обязательна — страница про чужой рынок бывает только английской (решение фаундера')
out.push('18.09.2026). В колонке «Стало» — адрес в корневой локали, а у страницы без русской')
out.push('версии её x-default.')
out.push('')

for (const hubId of Object.keys(HUBS)) {
    const pages = PAGES.filter((p) => p.hub === hubId)
    if (!pages.length) continue
    out.push(`## ${HUB_TITLES[hubId] ?? hubId} — \`/${HUBS[hubId].ru}/\``)
    out.push('')
    out.push('| Было | Стало | id |')
    out.push('|---|---|---|')
    for (const page of pages) {
        const to = pagePath(page, 'ru') ?? pagePath(page, xDefaultLocaleOf(page))
        const from = (page.retired ?? []).map((r) => `\`${r}\``).join('<br>') || '— *(новая)*'
        out.push(`| ${from} | \`${to}\` | \`${page.id}\` |`)
    }
    out.push('')
}

const orphans = Object.entries(ORPHAN_REDIRECTS)
if (orphans.length) {
    out.push('## Адреса, которые не переезжают')
    out.push('')
    out.push('Адрес остаётся живым 301-редиректом, но своей страницы или файла у него больше нет.')
    out.push('')
    out.push('| Было | Ведёт на | Почему |')
    out.push('|---|---|---|')
    for (const [from, to] of orphans) {
        const why = ORPHAN_REASONS[from]
        if (!why) throw new Error(`print-addresses: no reason recorded for orphan redirect ${from}`)
        out.push(`| \`${from}\` | \`${to}\` | ${why} |`)
    }
    out.push('')
}

console.log(out.join('\n'))
