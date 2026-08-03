#!/usr/bin/env node --experimental-strip-types
//
// Registry integrity gate.
//
// The registry (docs/.vitepress/registry.ts) is the single source of truth for
// every content URL, so a mistake in it is a mistake in every derived artifact
// at once: the sitemap, the hreflang cluster, the nginx location list and the
// 301 map. This script is what makes that safe to rely on. It runs in CI and
// before the migration cutover.
//
// It deliberately checks the registry against the FILE TREE, not against
// itself: a registry that is internally consistent but has drifted from the
// pages on disk is exactly the failure that produces sitemaps full of 404s.
//
// Usage:
//   node --experimental-strip-types scripts/check-registry.mjs [--pre|--post]
//
//   --pre   (default before the move) expect files at their RETIRED paths,
//           i.e. the `docs/ru/<zone>/<slug>.md` layout.
//   --post  expect files at the paths the registry declares.

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DOCS = join(HERE, '..', 'docs')

const {
    PAGES,
    HUBS,
    LOCALES,
    ROOT_LOCALE,
    ORPHAN_REDIRECTS,
    ALREADY_REDIRECTING,
    pagePath,
    sourceFile,
    localesOf,
    redirectMap,
} = await import(join(DOCS, '.vitepress', 'registry.ts'))

const mode = process.argv.includes('--post') ? 'post' : 'pre'

const failures = []
const fail = (check, detail) => failures.push(`${check}: ${detail}`)

// ---------------------------------------------------------------------------
// 1. Identity is unique.
// ---------------------------------------------------------------------------
{
    const seen = new Map()
    for (const entry of PAGES) {
        if (seen.has(entry.id)) fail('duplicate-id', entry.id)
        seen.set(entry.id, entry)
    }
}

// ---------------------------------------------------------------------------
// 2. No two pages claim the same address in the same locale.
//    This is the check that catches a hub index and a leaf both resolving to
//    `/pomoshch/`, which would make one of them unreachable.
// ---------------------------------------------------------------------------
{
    const seen = new Map()
    for (const entry of PAGES) {
        for (const lang of localesOf(entry)) {
            const path = pagePath(entry, lang)
            const key = `${lang} ${path}`
            if (seen.has(key)) fail('duplicate-url', `${path} (${lang}) claimed by ${seen.get(key)} and ${entry.id}`)
            seen.set(key, entry.id)
        }
    }
}

// ---------------------------------------------------------------------------
// 3. Slug hygiene: lowercase latin, digits and hyphens. Nothing else ever.
// ---------------------------------------------------------------------------
for (const entry of PAGES) {
    for (const [lang, slug] of Object.entries(entry.slugs)) {
        if (slug !== '' && !/^[a-z0-9-]+$/.test(slug)) fail('bad-slug', `${entry.id} [${lang}] "${slug}"`)
    }
}

// ---------------------------------------------------------------------------
// 4. Every retired address is claimed exactly once, and never by two pages.
//    A retired path with two targets is a coin flip at redirect time.
// ---------------------------------------------------------------------------
{
    const seen = new Map()
    for (const entry of PAGES) {
        for (const old of entry.retired ?? []) {
            if (seen.has(old)) fail('duplicate-retired', `${old} claimed by ${seen.get(old)} and ${entry.id}`)
            seen.set(old, entry.id)
        }
    }
    for (const old of Object.keys(ORPHAN_REDIRECTS)) {
        if (seen.has(old)) fail('duplicate-retired', `${old} is both an orphan redirect and retired by ${seen.get(old)}`)
    }
}

// ---------------------------------------------------------------------------
// 5. No redirect points at itself or at another redirect source.
//    Either would be a loop or a chain — and a chain is precisely what this
//    migration exists to avoid, since the July EN redirects already added one.
// ---------------------------------------------------------------------------
{
    const map = redirectMap()
    const sources = new Set(Object.keys(map))
    for (const [from, to] of Object.entries(map)) {
        if (from === to) fail('self-redirect', from)
        if (sources.has(to)) fail('redirect-chain', `${from} -> ${to}, and ${to} redirects onward`)
    }
}

// ---------------------------------------------------------------------------
// 6. Coverage against the file tree — nothing lost, nothing invented.
// ---------------------------------------------------------------------------
{
    const walk = (dir, acc = []) => {
        if (!existsSync(dir)) return acc
        for (const name of readdirSync(dir)) {
            if (name.startsWith('.') || name === 'public') continue
            const full = join(dir, name)
            if (statSync(full).isDirectory()) walk(full, acc)
            else if (name.endsWith('.md')) acc.push(relative(DOCS, full))
        }
        return acc
    }

    const onDisk = new Set(walk(DOCS))

    if (mode === 'post') {
        // Every declared page has its file, and every file is declared.
        const declared = new Set()
        for (const entry of PAGES) {
            for (const lang of localesOf(entry)) {
                const file = sourceFile(entry, lang)
                declared.add(file)
                if (!onDisk.has(file)) fail('missing-file', `${entry.id} [${lang}] expects docs/${file}`)
            }
        }
        for (const file of onDisk) {
            if (!declared.has(file)) fail('unregistered-file', `docs/${file} is in no registry entry`)
        }
    } else {
        // Before the move: every retired address must correspond to a file that
        // exists today. A typo here becomes a 404 the moment nginx starts
        // trusting the map.
        // `/docs/` itself strips to the empty string, so the index candidate is
        // bare `index.md` and there is no `.md` sibling to try. Building the
        // paths by joining segments instead of by concatenation keeps that case
        // from producing a leading slash and silently matching nothing.
        const asFile = (publicPath) => {
            const bare = publicPath.replace(/^\/docs\/?/, '').replace(/\/$/, '')
            const index = bare ? `${bare}/index.md` : 'index.md'
            return bare ? [index, `${bare}.md`] : [index]
        }
        const alreadyRedirecting = new Set(ALREADY_REDIRECTING)
        for (const entry of PAGES) {
            for (const old of entry.retired ?? []) {
                if (!old.startsWith('/docs')) continue
                // An address that already answers with a 301 has no file by
                // definition — that is not drift, it is the July EN removal.
                if (alreadyRedirecting.has(old)) continue
                const candidates = asFile(old)
                if (!candidates.some((c) => onDisk.has(c))) {
                    fail('retired-not-on-disk', `${entry.id}: ${old} matches no file (tried ${candidates.join(', ')})`)
                }
            }
        }
        // Every already-redirecting address must be claimed by some page, or
        // the migration would drop an existing 301 on the floor.
        {
            const claimed = new Set(PAGES.flatMap((e) => e.retired ?? []))
            for (const old of ALREADY_REDIRECTING) {
                if (!claimed.has(old) && !(old in ORPHAN_REDIRECTS)) {
                    fail('existing-redirect-dropped', `${old} redirects today but no page claims it`)
                }
            }
        }
        // And every file on disk must be reachable from some retired address,
        // or it is a page the migration would silently drop.
        const covered = new Set()
        for (const entry of PAGES) {
            for (const old of entry.retired ?? []) {
                for (const c of asFile(old)) if (onDisk.has(c)) covered.add(c)
            }
        }
        for (const old of Object.keys(ORPHAN_REDIRECTS)) {
            for (const c of asFile(old)) if (onDisk.has(c)) covered.add(c)
        }
        for (const file of onDisk) {
            if (!covered.has(file)) fail('page-would-be-dropped', `docs/${file} has no retired address in the registry`)
        }
    }
}

// ---------------------------------------------------------------------------
// 7. Hub segments do not collide — with each other, or with a route the SPA
//    owns. The root namespace is closed and hand-curated precisely so this
//    check can be exhaustive rather than best-effort.
// ---------------------------------------------------------------------------
{
    // Routes the application answers on, from src/app/routers/appRouter.tsx in
    // contests-frontend plus the locale prefixes. Kept here rather than
    // imported because the two repos build independently.
    const SPA_SEGMENTS = new Set([
        'ua', 'en', 'ru', 'pl',
        'feed', 'lenta', 'strichka',
        'contests', 'zadaniya', 'zavdannya', 'tasks',
        'store', 'magazin', 'kramnytsia',
        'topusers', 'reyting', 'reitynh', 'top',
        'how-it-works', 'kak-eto-rabotaet', 'yak-tse-pratsiuie',
        'business', 'dlya-biznesa', 'for-business',
        'u', 'profile', 'cabinet', 'portal', 'chat', 'join',
        'contestscreate', 'choosewinner', 'coinmanagementcenter',
        'api', 'assets', 'admin', 'oauth2', 'ws', 'images-bucket',
    ])

    const seen = new Map()
    for (const [hubId, byLocale] of Object.entries(HUBS)) {
        for (const [lang, segment] of Object.entries(byLocale)) {
            const prefix = LOCALES.find((l) => l.language === lang).prefix
            const full = prefix ? `${prefix.slice(1)}/${segment}` : segment
            if (seen.has(full) && seen.get(full) !== hubId) {
                fail('hub-collision', `"${full}" used by both ${seen.get(full)} and ${hubId}`)
            }
            seen.set(full, hubId)
            // Only the root locale can collide with an SPA top-level segment:
            // under /ua and /en the prefix already separates the namespaces.
            if (!prefix && SPA_SEGMENTS.has(segment)) {
                fail('hub-shadows-app-route', `hub "${segment}" (${hubId}) collides with an application route`)
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 8. Root locale must be the unprefixed one, and it must be first.
//    This is rule 1 of the registry header, mechanised: in July an EN tree took
//    the short addresses and Google served English sitelinks under a Russian
//    brand query. A test is cheaper than repeating that.
// ---------------------------------------------------------------------------
{
    if (ROOT_LOCALE.prefix !== '') fail('root-locale-prefixed', `root locale "${ROOT_LOCALE.language}" has prefix "${ROOT_LOCALE.prefix}"`)
    if (LOCALES[0].language !== ROOT_LOCALE.language) fail('root-locale-not-first', LOCALES[0].language)
    for (const locale of LOCALES.slice(1)) {
        if (!locale.prefix) fail('non-root-locale-unprefixed', locale.language)
    }
}

// ---------------------------------------------------------------------------

const pages = PAGES.length
const urls = PAGES.reduce((n, e) => n + localesOf(e).length, 0)
const redirects = Object.keys(redirectMap()).length

if (failures.length) {
    console.error(`\n✗ реестр не прошёл проверку (${mode}): ${failures.length}\n`)
    for (const f of failures) console.error(`  ${f}`)
    process.exit(1)
}

console.log(`✓ реестр цел (${mode}): ${pages} страниц, ${urls} URL, ${redirects} редиректов, 0 замечаний`)
