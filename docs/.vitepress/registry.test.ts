import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import liveManifest from '../content-pages.json' with { type: 'json' }
import {
    HUBS,
    LOCALES,
    PAGES,
    ROOT_LOCALE,
    alternateLocalesOf,
    hreflangCluster,
    localesOf,
    missingSources,
    pagePath,
    parseContentManifest,
    redirectMap,
    redirectTarget,
    sourceFile,
    xDefaultLocaleOf,
    type Locale,
    type RegistryEntry,
} from './registry'

// A retired address must land the reader in the language they arrived in.
//
// WHY THIS EXISTS. Until the 2026-08 consolidation every `retired` entry was
// Russian (`/docs/ru/…`), so mapping all of them onto the RU canonical was
// invisibly correct. Collapsing six pages across all three locales added UA and
// EN addresses to the same lists, and the old one-line implementation 301'd
// `/ua/zarobitok/skilky-platiat-novachku` onto the RUSSIAN survivor. It shipped
// and was caught only by probing the live site after deploy.
//
// A cross-language redirect is worse than a 404: the reader silently loses their
// language, and the wrong page ends up answering for that locale.

const localeOfPath = (path: string): Locale => {
    for (const axis of LOCALES) {
        if (axis.prefix && (path === axis.prefix || path.startsWith(`${axis.prefix}/`))) return axis.language
    }
    return ROOT_LOCALE.language
}

// ---------------------------------------------------------------------------
// A semantic page declares the locales it HAS — at least one, and no particular
// one.
//
// WHAT CHANGED AND WHY. Until 2026-09-18 `check-registry.mjs` carried a
// `missing-root-locale` rule: every entry needed a `ru` slug, on the theory that
// the root canonical is where a page's identity lives. The founder retired that
// rule, because the pages now being written — "who pays clippers in India, in
// Pakistan, in Nigeria" — have no Russian-speaking audience, and a Russian twin
// of such a page is text written for nobody: a doorway, produced to satisfy a
// gate. That rule had no test of its own; these are its replacement, and they
// state the invariant that survived it — AT LEAST ONE locale, every declared one
// backed by a file — rather than naming a language.
//
// The rejections are exercised on in-memory manifests: a rejected entry cannot
// by definition be found in the live one. The locale axes and hub segments come
// from the real manifest so the fixtures cannot drift from production topology.
// ---------------------------------------------------------------------------

const manifestWith = (pages: unknown[]) => ({
    schemaVersion: liveManifest.schemaVersion,
    origin: liveManifest.origin,
    locales: liveManifest.locales,
    hubs: liveManifest.hubs,
    pages,
})

const EN_ONLY = {
    id: 'earnings-who-pays-clippers-in-india',
    hub: 'earnings',
    slugs: { en: 'who-pays-clippers-in-india' },
    retired: ['/en/earnings/india-clipping-rates'],
}

/** The fixture entries, after the schema gate has accepted them. */
const parsed = (pages: unknown[]): readonly RegistryEntry[] => parseContentManifest(manifestWith(pages)).pages

describe('registry: locale declaration', () => {
    it('accepts a page that declares English only', () => {
        const [entry] = parsed([EN_ONLY])
        expect(localesOf(entry)).toEqual(['en'])
        expect(pagePath(entry, 'en')).toBe('/en/earnings/who-pays-clippers-in-india')
        expect(sourceFile(entry, 'en')).toBe('en/earnings/who-pays-clippers-in-india.md')
        // No address, no file and no hreflang entry in a language it does not have.
        for (const language of ['ru', 'uk'] as const) {
            expect(pagePath(entry, language)).toBeNull()
            expect(sourceFile(entry, language)).toBeNull()
        }
    })

    it('rejects a page that declares no locale at all', () => {
        expect(() => parsed([{ ...EN_ONLY, slugs: {} }])).toThrow(/declares no locale/)
    })

    it('rejects a locale outside the declared axes', () => {
        // The axis for a language is what gives it a prefix, a directory and an
        // hreflang value. A slug under an unknown key has none of the three.
        expect(() => parsed([{ ...EN_ONLY, slugs: { ar: 'x' } }])).toThrow(/unknown key "ar"/)
    })

    it('reports a declared locale that has no source file', () => {
        const [entry] = parsed([{ id: 'x', hub: 'earnings', slugs: { ru: 'a', en: 'b' } }])
        const onDisk = new Set(['zarabotok/a.md', 'en/earnings/b.md'])
        expect(missingSources(entry, onDisk)).toEqual([])
        expect(missingSources(entry, new Set(['zarabotok/a.md']))).toEqual(['en'])
        expect(missingSources(entry, new Set())).toEqual(['ru', 'en'])
    })
})

describe('registry: a page that exists in one language', () => {
    const [enOnly] = parsed([EN_ONLY])
    // The six ru-only pages in the live manifest are the shape an EN-only page
    // has to match. Read from the manifest, not restated, so the comparison
    // cannot go stale when one of them is finally translated.
    const ruOnly = PAGES.find((entry) => localesOf(entry).length === 1 && localesOf(entry)[0] === 'ru')

    it('is its own canonical and its own x-default, exactly like the ru-only pages', () => {
        expect(ruOnly, 'no single-locale page left to compare against').toBeDefined()
        for (const entry of [enOnly, ruOnly!]) {
            const [language] = localesOf(entry)
            const self = `https://darebay.com${pagePath(entry, language)}`
            expect(xDefaultLocaleOf(entry)).toBe(language)
            expect(hreflangCluster(entry)).toEqual([
                { hreflang: language, href: self },
                { hreflang: 'x-default', href: self },
            ])
        }
    })

    it('offers no language switcher, because there is nothing to switch to', () => {
        // `localeLinks` in config.ts and `og:locale:alternate` are both this call.
        expect(alternateLocalesOf(enOnly, 'en')).toEqual([])
        expect(alternateLocalesOf(ruOnly!, 'ru')).toEqual([])
    })

    it('contributes exactly one URL, to its own locale', () => {
        // The sitemap (via VitePress), llms.txt and the dist gates all enumerate
        // `pagePath(entry, locale)` over `localesOf(entry)`; this is that set.
        const urls = LOCALES.map((axis) => [axis.language, pagePath(enOnly, axis.language)] as const)
        expect(urls.filter(([, path]) => path !== null)).toEqual([
            ['en', '/en/earnings/who-pays-clippers-in-india'],
        ])
    })

    it('still redirects its retired addresses instead of dropping them', () => {
        // The old implementation looked up the RU canonical first and skipped the
        // whole entry when there was none — every retired address of a page
        // without a Russian version silently became a 404.
        expect(redirectTarget(enOnly, '/en/earnings/india-clipping-rates')).toBe(
            '/en/earnings/who-pays-clippers-in-india',
        )
        // A retired address in a language this page does not have lands on its
        // x-default: a live page beats a dead address.
        expect(redirectTarget(enOnly, '/zarabotok/staryy-adres')).toBe('/en/earnings/who-pays-clippers-in-india')
    })
})

describe('redirectMap locale integrity', () => {
    const map = redirectMap()

    it('never sends a reader across languages', () => {
        // The ONE legal crossing: the survivor has no page in the source language
        // at all, so its x-default version is the only live address there is.
        //
        // That used to read "the root canonical", which was the same sentence
        // while every page had a Russian version. Since 2026-09-18 a survivor may
        // be EN-only, and then the only address it has is the English one — so the
        // rule is stated against `xDefaultLocaleOf`, which is what `redirectTarget`
        // actually falls back to.
        const illegal = Object.entries(map)
            .filter(([from, to]) => localeOfPath(from) !== localeOfPath(to))
            .filter(([from, to]) => {
                const survivor = PAGES.find((entry) =>
                    LOCALES.some((axis) => pagePath(entry, axis.language) === to),
                )
                if (!survivor) return true
                const language = localeOfPath(from)
                if (pagePath(survivor, language) !== null) return true
                return to !== pagePath(survivor, xDefaultLocaleOf(survivor))
            })
            .map(([from, to]) => `${from} -> ${to}`)

        expect(illegal).toEqual([])
    })

    it('keeps every localized retired address inside its own hub tree', () => {
        for (const [from, to] of Object.entries(map)) {
            const language = localeOfPath(from)
            if (language === ROOT_LOCALE.language) continue
            const axis = LOCALES.find((candidate) => candidate.language === language)
            expect(axis, `unknown locale for ${from}`).toBeDefined()
            // A UA address may only resolve to a UA address, or leave its tree
            // for the one address a survivor without Ukrainian still has.
            const survivor = PAGES.find((entry) => LOCALES.some((a) => pagePath(entry, a.language) === to))
            expect(
                to.startsWith(`${axis!.prefix}/`) ||
                    (survivor !== undefined && to === pagePath(survivor, xDefaultLocaleOf(survivor))),
                `${from} -> ${to} escapes its locale tree`,
            ).toBe(true)
        }
    })

    it('resolves the collapsed earnings pages within each locale', () => {
        // Regression guard with the exact addresses that shipped wrong.
        const cases: Array<[string, string]> = [
            ['/ua/zarobitok/skilky-platiat-novachku', '/ua/zarobitok/skilky-mozhna-zarobyty-na-narizkakh'],
            ['/ua/zarobitok/porih-perehliadiv-dlia-vyplaty', '/ua/zarobitok/yak-pratsiuie-oplata-za-perehliady'],
            ['/en/earnings/view-threshold', '/en/earnings/how-pay-per-view-works'],
            ['/en/earnings/beginner-rates', '/en/earnings/how-much-clipping-pays'],
            ['/zarabotok/skolko-platyat-novichku', '/zarabotok/skolko-mozhno-zarabotat-na-narezkah'],
        ]
        for (const [from, expected] of cases) expect(map[from]).toBe(expected)
    })

    it('points every target at a live address, never at another redirect', () => {
        const sources = new Set(Object.keys(map))
        for (const [from, to] of Object.entries(map)) {
            expect(sources.has(to), `${from} -> ${to} chains onward`).toBe(false)
        }
    })

    it('covers all three locales, so the guard cannot pass vacuously', () => {
        const covered = new Set(Object.keys(map).map(localeOfPath))
        for (const axis of LOCALES) expect(covered.has(axis.language)).toBe(true)
        expect(Object.keys(HUBS).length).toBeGreaterThan(0)
    })
})

// `/<hub>/index` is the file VitePress writes the hub to, not an address the
// site ever meant to answer. The container's `try_files $uri $uri/ $uri.html`
// fallback resolved the extensionless file name anyway and served the hub with
// 200 plus a canonical pointing at `/<hub>/` — fifteen crawlable duplicates,
// one per hub per locale, all discovered on the live site rather than here.
//
// A redirect is a public contract, so the rule is asserted against the SHIPPED
// redirects.conf: the failure this has to catch is a registry that grew a hub
// and an artifact nobody regenerated, and importing the generator's own source
// would hide exactly that.
describe('hub index duplicates', () => {
    const conf = readFileSync(new URL('../../redirects.conf', import.meta.url), 'utf8')
    const hubs = PAGES.flatMap((entry) =>
        LOCALES.filter((axis) => entry.slugs[axis.language] === '').map((axis) => pagePath(entry, axis.language)!),
    )

    it('retires the file name of every hub in every locale', () => {
        expect(hubs.length).toBe(Object.keys(HUBS).length * LOCALES.length)
        for (const hub of hubs) {
            expect(conf).toContain(`location = ${hub}index { return 301 ${hub}$is_args$args; }`)
        }
    })

    it('leaves the neighbouring spellings alone', () => {
        // `/<hub>/index.html` is answered by the clean-url regex in nginx.conf and
        // `/<hub>/index/` is a deliberate 404. An exact `=` rule for either one here
        // would take that decision away from the file that documents it.
        for (const hub of hubs) {
            expect(conf).not.toContain(`location = ${hub}index.html`)
            expect(conf).not.toContain(`location = ${hub}index/`)
        }
    })

    it('hops onto a hub that exists, never onto a 404', () => {
        const live = new Set(
            PAGES.flatMap((entry) => LOCALES.map((axis) => pagePath(entry, axis.language)).filter(Boolean)),
        )
        const emitted = [...conf.matchAll(/location = (\S+)index \{ return 301 (\S+)\$is_args/g)]
        expect(emitted.length).toBe(hubs.length)
        for (const [, source, target] of emitted) {
            expect(source).toBe(target)
            expect(live.has(target), `${target} is not a live address`).toBe(true)
        }
    })
})
