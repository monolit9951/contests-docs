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
const { PAGES, HUBS, ORPHAN_REDIRECTS, pagePath, localesOf, redirectMap } = await import(
    join(HERE, '..', 'docs', '.vitepress', 'registry.ts')
)

const HUB_TITLES = {
    earnings: 'Заработок',
    brands: 'Брендам',
    help: 'Помощь',
    about: 'О проекте',
    legal: 'Правовое',
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
out.push('Контент сегодня русский, поэтому у страниц объявлена только локаль `ru`: страница,')
out.push('которой нет на языке, в сайтмап этой локали и в hreflang не попадает вообще. Украинские')
out.push('и английские адреса появятся здесь по мере перевода, постранично.')
out.push('')

for (const hubId of Object.keys(HUBS)) {
    const pages = PAGES.filter((p) => p.hub === hubId)
    if (!pages.length) continue
    out.push(`## ${HUB_TITLES[hubId] ?? hubId} — \`/${HUBS[hubId].ru}/\``)
    out.push('')
    out.push('| Было | Стало | id |')
    out.push('|---|---|---|')
    for (const page of pages) {
        const to = pagePath(page, 'ru')
        const from = (page.retired ?? []).map((r) => `\`${r}\``).join('<br>') || '— *(новая)*'
        out.push(`| ${from} | \`${to}\` | \`${page.id}\` |`)
    }
    out.push('')
}

const orphans = Object.entries(ORPHAN_REDIRECTS)
if (orphans.length) {
    out.push('## Страницы, которые не переезжают')
    out.push('')
    out.push('Адрес остаётся живым 301-редиректом, но своей страницы у него больше нет.')
    out.push('')
    out.push('| Было | Ведёт на | Почему |')
    out.push('|---|---|---|')
    out.push(
        `| \`/docs/ru/kak-rabotaet/\` | \`${ORPHAN_REDIRECTS['/docs/ru/kak-rabotaet/']}\` | дублировал лендинг приложения «Как это работает», который переведён на три языка и остаётся в SPA |`
    )
    out.push('')
}

console.log(out.join('\n'))
