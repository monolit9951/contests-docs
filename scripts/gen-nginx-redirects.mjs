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
//   node --experimental-strip-types scripts/gen-nginx-redirects.mjs

import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const { redirectMap } = await import(join(HERE, '..', 'docs', '.vitepress', 'registry.ts'))

const map = redirectMap()
const lines = []

lines.push('# ⚙️ GENERATED — do not edit.')
lines.push('#   node --experimental-strip-types scripts/gen-nginx-redirects.mjs')
lines.push('#')
lines.push('# Every address the content site used to answer on, mapped onto the address it')
lines.push('# answers on now. Source of truth: docs/.vitepress/registry.ts.')
lines.push('#')
lines.push('# These rules are PERMANENT. A 301 costs one line and holds an old address for')
lines.push('# years; deleting one turns an indexed url into a 404 and throws away whatever')
lines.push('# authority it still carried. Nothing here is ever removed, only added to.')
lines.push('')

// Longest first so `/docs/ru/faq/crypto` is matched before `/docs/ru/faq/`.
// nginx picks the longest matching prefix among `^~` locations regardless of
// file order, but `=` exact matches win outright — and exact is what every one
// of these is, which removes the ordering question entirely.
for (const from of Object.keys(map).sort((a, b) => b.length - a.length)) {
    const to = map[from]
    lines.push(`location = ${from} { return 301 ${to}$is_args$args; }`)
    // VitePress with cleanUrls answered on both `/foo` and `/foo.html`, and the
    // old EN tree was linked with the extension in places, so both forms are
    // live addresses that must land somewhere.
    if (!from.endsWith('/')) lines.push(`location = ${from}.html { return 301 ${to}$is_args$args; }`)
    // A trailing-slash variant of a leaf address was reachable too (nginx's
    // try_files `$uri/` would have found the directory), so it redirects rather
    // than 404s.
    else if (from !== '/docs/') lines.push(`location = ${from.slice(0, -1)} { return 301 ${to}$is_args$args; }`)
}

// Unknown addresses under the retired prefix intentionally fall through to a
// real 404. Redirecting arbitrary `/docs/*` garbage to a section index is a
// soft-404 signal: it wastes crawl budget and makes the target look unrelated.
// Only addresses with a known one-to-one replacement earn a permanent move.
lines.push('')
// Bare `/docs` used to 301 onto `/docs/`, which served the manifesto — so it
// lands where `/docs/` lands, in ONE hop rather than two.
lines.push(`location = /docs { return 301 ${map['/docs/'] ?? '/o-proekte/'}$is_args$args; }`)
lines.push('')

const target = join(HERE, '..', 'redirects.conf')
writeFileSync(target, `${lines.join('\n')}\n`)
console.log(`redirects.conf: ${Object.keys(map).length} адресов, ${lines.filter((l) => l.startsWith('location')).length} правил`)
