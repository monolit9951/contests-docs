#!/usr/bin/env node --experimental-strip-types
//
// Generates redirects.conf — every retired address, one permanent hop onto its
// current one — from the registry.
//
// Hand-writing this list is how you get chains. The eight rules added on
// 2026-07-25 (EN tree removal) pointed at `/docs/ru/...`, and this migration
// moves those same pages again: layering new rules on top would have produced
// `EN → RU-old → new`, two or three hops where one belongs. Generating from the
// registry means every source resolves to its FINAL target by construction, and
// `check-registry.mjs` proves no target is itself a source.
//
// The map holds more than the recorded `retired` lists: `redirectMap()` also
// derives the legacy SPELLINGS of those addresses (the /docs-stripped twins such
// as `/faq/fees`, the `/ru/...` alias of every root-tree address, `<dir>index`
// file names). The host routes their prefixes here (`LEGACY_ROUTE_PREFIXES`), so
// each of them is answered by this file in one hop.
//
// Every emitted `location =` argument is unique: two spellings may produce the
// same address (the bare form of `/ru/zarabotok/` and the source `/ru/zarabotok`),
// which is written once, and the generator throws if the two would disagree on
// the target or if an emitted address is a live page. A duplicate exact location
// is also a hard nginx error, so this keeps the container bootable.
//
//   node --experimental-strip-types scripts/gen-nginx-redirects.mjs

import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const { redirectMap, PAGES, localesOf, pagePath } = await import(join(HERE, '..', 'docs', '.vitepress', 'registry.ts'))

const map = redirectMap()
const lines = []
const live = new Set(PAGES.flatMap((entry) => localesOf(entry).map((language) => pagePath(entry, language))))
const emitted = new Map()
const emit = (from, to) => {
    const known = emitted.get(from)
    if (known !== undefined) {
        if (known !== to) throw new Error(`gen-nginx-redirects: ${from} would redirect to both ${known} and ${to}`)
        return
    }
    if (live.has(from)) throw new Error(`gen-nginx-redirects: ${from} is a live page, not a redirect source`)
    emitted.set(from, to)
    lines.push(`location = ${from} { return 301 ${to}$is_args$args; }`)
}

lines.push('# ⚙️ GENERATED — do not edit.')
lines.push('#   node --experimental-strip-types scripts/gen-nginx-redirects.mjs')
lines.push('#')
lines.push('# Every address the content site used to answer on, mapped onto the address it')
lines.push('# answers on now, plus the hub file names that were never addresses at all.')
lines.push('# Includes the legacy spellings the registry derives: /docs-stripped twins')
lines.push('# (/faq/fees), the /ru alias of the root tree (/ru/o-proekte) and <dir>index names.')
lines.push('# Source of truth: docs/.vitepress/registry.ts.')
lines.push('#')
lines.push('# These rules are PERMANENT. A 301 costs one line and holds an old address for')
lines.push('# years; deleting one turns an indexed url into a 404 and throws away whatever')
lines.push('# authority it still carried. Nothing here is ever removed, only added to.')
lines.push('')

// Longest first so `/docs/ru/faq/crypto` is matched before `/docs/ru/faq/`.
// nginx picks the longest matching prefix among `^~` locations regardless of
// file order, but `=` exact matches win outright — and exact is what every one
// of these is, which removes the ordering question entirely.
// A file address such as `/docs/sitemap.xml` was only ever served under its own
// name, unlike a page, so it gets no `.html` twin below.
const FILE_ADDRESS = /\.[A-Za-z0-9]+$/
for (const from of Object.keys(map).sort((a, b) => b.length - a.length)) {
    const to = map[from]
    emit(from, to)
    // VitePress with cleanUrls answered on both `/foo` and `/foo.html`, and the
    // old EN tree was linked with the extension in places, so both forms are
    // live addresses that must land somewhere.
    if (!from.endsWith('/')) {
        if (!FILE_ADDRESS.test(from)) {
            emit(`${from}.html`, to)
            // The trailing-slash spelling of a leaf. Without it the container's
            // @slash_* handler looks for `<leaf>.html` on disk, finds none for a
            // retired address and answers 404; and once the host routes
            // `/ru/<hub>/` here, `/ru/<hub>/<leaf>/` (two hops onto a 200 through
            // the application's /ru strip until now) would turn into exactly that
            // 404. A `<dir>index` file name keeps no slash form, like the hubs'
            // own `<hub>/index/` below.
            if (!from.endsWith('/index')) emit(`${from}/`, to)
        }
    }
    // The bare form of a directory address was reachable too (nginx's try_files
    // `$uri/` would have found the directory), so it redirects rather than 404s.
    else if (from !== '/docs/') emit(from.slice(0, -1), to)
}

// `/<hub>/index` is a file name, not an address. VitePress writes each hub to
// `<hub>/index.html`, and the container's `try_files $uri $uri/ $uri.html`
// fallback answered the extensionless file name with 200 and a canonical
// pointing back at the hub — a reachable, indexable duplicate of every hub in
// every locale. One exact permanent hop retires each of them.
//
// `=` is what keeps the two neighbouring spellings exactly as they are: nginx
// matches an exact location only against the whole URI, so `/<hub>/index.html`
// still falls to the clean-url regex in nginx.conf (301 onto the hub) and
// `/<hub>/index/` still ends in a real 404 — the trailing-slash handler skips
// `/index/` deliberately, because a file name with a slash was never an address.
//
// Derived from the hub pages themselves (slug ''), not from the hub segments:
// a redirect may only be emitted where the target hub page actually exists, or
// the hop would land on a 404.
lines.push('')
for (const hub of PAGES.flatMap((entry) =>
    localesOf(entry)
        .filter((language) => entry.slugs[language] === '')
        .map((language) => pagePath(entry, language))
).sort()) {
    emit(`${hub}index`, hub)
}

// Unknown addresses under the retired prefix intentionally fall through to a
// real 404. Redirecting arbitrary `/docs/*` garbage to a section index is a
// soft-404 signal: it wastes crawl budget and makes the target look unrelated.
// Only addresses with a known one-to-one replacement earn a permanent move.
lines.push('')
// Bare `/docs` used to 301 onto `/docs/`, which served the manifesto — so it
// lands where `/docs/` lands, in ONE hop rather than two.
emit('/docs', map['/docs/'] ?? '/o-proekte/')
lines.push('')

const target = join(HERE, '..', 'redirects.conf')
writeFileSync(target, `${lines.join('\n')}\n`)
console.log(`redirects.conf: ${Object.keys(map).length} адресов, ${lines.filter((l) => l.startsWith('location')).length} правил`)
