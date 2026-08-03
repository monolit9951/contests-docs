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

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
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
    APP_ROUTES,
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
// 6b. Frontmatter actually parses.
//
// The JSON-LD in `head` lives inside a SINGLE-QUOTED YAML scalar, and the only
// escape YAML offers there is doubling the quote. One apostrophe in an English
// sentence ("the streamer's source material") therefore breaks the whole
// document — and because the scalar is a single 2000-character line, it is
// invisible on review. It cost a full build outage during the 2026-08
// translation pass, which is why it is a gate and not a note.
//
// A narrow parser rather than a YAML dependency: the failure mode is unbalanced
// quoting inside a single-quoted scalar, and that is exactly what this counts.
// ---------------------------------------------------------------------------
{
    const walk = (dir, acc = []) => {
        if (!existsSync(dir)) return acc
        for (const name of readdirSync(dir)) {
            if (name.startsWith('.') || name === 'public') continue
            const full = join(dir, name)
            if (statSync(full).isDirectory()) walk(full, acc)
            else if (name.endsWith('.md')) acc.push(full)
        }
        return acc
    }

    for (const file of walk(DOCS)) {
        const raw = readFileSync(file, 'utf8')
        const front = raw.match(/^---\n([\s\S]*?)\n---/)
        if (!front) continue

        for (const [i, line] of front[1].split('\n').entries()) {
            const trimmed = line.trim()
            // A value that opens with a single quote must close with one, and
            // every apostrophe between them must be doubled. Counting quotes is
            // enough to catch the real mistake: an odd number means one of them
            // was meant as an apostrophe.
            if (!/^-?\s*'/.test(trimmed)) continue
            const quotes = (trimmed.match(/'/g) ?? []).length
            if (quotes % 2 !== 0) {
                fail(
                    'unquoted-apostrophe',
                    `docs/${relative(DOCS, file)}:${i + 2} — апостроф внутри одинарных кавычек YAML, удвой его ('')`
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 6c. Every internal link resolves to a page that exists in that locale.
//
// `resolveLocalizedLink` rescues a link to an untranslated sibling by sending it
// to the hub — deliberately, so an incremental translation never ships a 404.
// But that same rescue hides a TYPO: a misspelled slug also lands on the hub and
// looks fine. The 2026-08 translation pass produced exactly that — a Ukrainian
// page linking to `/ua/brendam/kak-sozdat-konkurs-…`, the Russian slug under a
// Ukrainian prefix, which resolved to the brands hub and looked correct.
//
// So the rescue stays, and this gate draws the line it cannot: a link whose
// SECTION exists in that locale but whose SLUG matches no page there is a
// mistake, not a missing translation.
// ---------------------------------------------------------------------------
{
    const walk = (dir, acc = []) => {
        if (!existsSync(dir)) return acc
        for (const name of readdirSync(dir)) {
            if (name.startsWith('.') || name === 'public') continue
            const full = join(dir, name)
            if (statSync(full).isDirectory()) walk(full, acc)
            else if (name.endsWith('.md')) acc.push(full)
        }
        return acc
    }

    const live = new Set()
    for (const entry of PAGES) {
        for (const lang of localesOf(entry)) live.add(pagePath(entry, lang))
    }
    const appRoutes = new Set(APP_ROUTES)

    // The hub root of every locale — a link there is the legitimate fallback.
    const hubRoots = new Set(
        PAGES.filter((e) => localesOf(e).some((l) => e.slugs[l] === '')).flatMap((e) =>
            localesOf(e).filter((l) => e.slugs[l] === '').map((l) => pagePath(e, l))
        )
    )

    for (const file of walk(DOCS)) {
        const raw = readFileSync(file, 'utf8')
        for (const [, href] of raw.matchAll(/\]\((\/[^)#\s]*)/g)) {
            if (live.has(href) || hubRoots.has(href) || appRoutes.has(href)) continue
            // `/legal/*` is shared across locales by design.
            if (href.startsWith('/legal/')) continue
            fail('dead-internal-link', `docs/${relative(DOCS, file)} -> ${href}`)
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
