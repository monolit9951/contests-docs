import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import liveManifest from '../content-pages.json' with { type: 'json' }
import {
    APP_ROUTES,
    CONTENT_ROOT_FILES,
    HUBS,
    KNOWN_LOCALES,
    LOCALES,
    PAGES,
    ROOT_LOCALE,
    alternateLocalesOf,
    appLocaleOf,
    appPathFor,
    createRegistry,
    hreflangCluster,
    hubIndexPath,
    localeOfSourcePath,
    localesOf,
    missingSources,
    pagePath,
    parseContentManifest,
    redirectMap,
    redirectTarget,
    sourceFile,
    textDirectionOf,
    xDefaultLocaleOf,
    type HubId,
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
        //
        // The example used to be `ar`. Arabic is now a KNOWN language that the
        // manifest may declare (wave 3 does), so it would stop being an example
        // of an unknown key the day it ships; `fr` is unknown to the build. A
        // known language the manifest has not declared is refused the same way —
        // see "accepts an Arabic slug only on a manifest that declares the tree".
        expect(() => parsed([{ ...EN_ONLY, slugs: { fr: 'x' } }])).toThrow(/unknown key "fr"/)
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

    it('covers the three trees that have moved addresses, so the guard cannot pass vacuously', () => {
        // Russian, Ukrainian and English are the trees whose addresses were ever retired. A tree
        // that opens later (Arabic) starts with nothing to redirect, so "every declared tree" would
        // turn this guard red the day a new language ships — without any redirect being wrong.
        const covered = new Set(Object.keys(map).map(localeOfPath))
        for (const language of ['ru', 'uk', 'en'] as const) expect(covered.has(language)).toBe(true)
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
        // Not vacuous: every hub has its index in the root tree, and every tree has its home, the
        // earnings hub. The count is NOT hubs × locales: a tree may open with one section (Arabic
        // starts with earnings alone), and a hub with no index in a language has no file name to
        // retire there.
        for (const hub of Object.keys(HUBS) as HubId[]) expect(hubs).toContain(hubIndexPath(hub, ROOT_LOCALE.language))
        for (const axis of LOCALES) expect(hubs).toContain(hubIndexPath('earnings', axis.language))
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

// The old `/docs/` tree had its own sitemap. robots.txt stopped naming it on
// 2026-08-04, but crawlers keep sitemap addresses: GPTBot asked for it on 14 of
// the 15 days of the 2026-09-18 nginx baseline and got a 404 each time. Asserted
// against the SHIPPED redirects.conf for the same reason as the hub rule above.
describe('retired docs sitemap', () => {
    const conf = readFileSync(new URL('../../redirects.conf', import.meta.url), 'utf8')

    it('hops once onto the sitemap that replaced it, which this container still serves', () => {
        expect(redirectMap()['/docs/sitemap.xml']).toBe('/sitemap-content.xml')
        expect(CONTENT_ROOT_FILES).toContain('/sitemap-content.xml')
        expect(conf).toContain('location = /docs/sitemap.xml { return 301 /sitemap-content.xml$is_args$args; }')
    })

    it('gets no .html twin: a file was only ever served under its own name', () => {
        expect(conf).not.toContain('location = /docs/sitemap.xml.html')
        // Page addresses keep theirs.
        expect(conf).toContain('location = /docs/faq/fees.html {')
    })
})

// ---------------------------------------------------------------------------
// A tree the live manifest has not declared yet: Arabic.
//
// Everything a new tree needs is prepared in code before its first page ships
// (its shape in `LOCALE_SHAPES`, its interface copy, its right-to-left layout),
// and declaring it in docs/content-pages.json is the whole switch. These tests
// hold the registry half of that promise on an in-memory manifest that declares
// `ar` — the live instance cannot, because in the live manifest Arabic has no
// address yet. Axes, hub segments and the translated entries are read from the
// live manifest, so the fixture cannot drift from production topology.
// ---------------------------------------------------------------------------

const AR_AXIS = { prefix: '/ar', vitepressKey: 'ar' }
/** Arabic hub segments: the English ones, under `/ar` (Latin slugs, no transliteration). */
const arabicHubs = Object.fromEntries(
    Object.entries(liveManifest.hubs).map(([hub, segments]) => [hub, { ...segments, ar: segments.en }]),
)
const withArabic = (pages: unknown[]) => ({
    ...manifestWith(pages),
    locales: { ...liveManifest.locales, ar: AR_AXIS },
    hubs: arabicHubs,
})
/** The same manifest with the Arabic tree NOT declared, whatever the live one says by then. */
const withoutArabic = (pages: unknown[]) => {
    const { ar: _axis, ...locales } = liveManifest.locales as Record<string, unknown>
    const hubs = Object.fromEntries(
        Object.entries(liveManifest.hubs).map(([hub, segments]) => {
            const { ar: _segment, ...rest } = segments as Record<string, string>
            return [hub, rest]
        }),
    )
    return { ...manifestWith(pages), locales, hubs }
}
/** A live entry without its Arabic slug, for a manifest that does not declare the tree. */
const untranslated = (id: string) => {
    const entry = PAGES.find((page) => page.id === id)
    if (!entry) throw new Error(`fixture: ${id} is not in the live manifest`)
    const { ar: _arabic, ...slugs } = entry.slugs
    return { ...entry, slugs }
}
/** A live entry with an Arabic slug added — the shape of a wave-3 translation. */
const translated = (id: string, arabicSlug?: string) => {
    const entry = PAGES.find((page) => page.id === id)
    if (!entry) throw new Error(`fixture: ${id} is not in the live manifest`)
    return { ...entry, slugs: { ...entry.slugs, ar: arabicSlug ?? entry.slugs.en } }
}

const AR_ONLY = {
    id: 'earnings-clipping-in-the-gulf',
    hub: 'earnings',
    slugs: { ar: 'clipping-in-the-gulf' },
    retired: ['/ar/earnings/gulf-clipping'],
}
const EN_AND_AR = {
    id: 'clipping-platforms-egypt-mena',
    hub: 'earnings',
    slugs: {
        en: 'clipping-platforms-that-pay-in-egypt-and-arab-countries',
        ar: 'clipping-platforms-that-pay-in-egypt-and-arab-countries',
    },
}

describe('registry: the Arabic tree, declared', () => {
    // The About hub keeps no Arabic index: the Arabic fact card lives in a section that has not
    // opened in Arabic, exactly the wave-3 shape.
    const aboutHub = PAGES.find((page) => page.id === 'about-hub')
    const arabic = createRegistry(
        withArabic([translated('earnings-hub', ''), aboutHub, translated('darebay-at-a-glance'), AR_ONLY, EN_AND_AR]),
    )
    const byId = (id: string) => arabic.PAGES.find((page) => page.id === id)!
    const glance = byId('darebay-at-a-glance')
    const arOnly = byId(AR_ONLY.id)
    const egypt = byId(EN_AND_AR.id)
    const abs = (path: string) => `https://darebay.com${path}`

    it('appends Arabic after the existing trees, right to left, with its own prefix and directory', () => {
        expect(arabic.LOCALES.map((axis) => axis.language)).toEqual(['ru', 'uk', 'en', 'ar'])
        expect(arabic.LOCALES.at(-1)).toEqual({ language: 'ar', prefix: '/ar', vitepressKey: 'ar', dir: 'rtl' })
        expect(arabic.ROOT_LOCALE.language).toBe('ru')
        for (const axis of arabic.LOCALES.slice(0, 3)) expect(axis.dir).toBe('ltr')
    })

    it('gives a translated page its Arabic address, source file and a symmetric cluster', () => {
        expect(arabic.pagePath(glance, 'ar')).toBe('/ar/about/darebay-at-a-glance')
        expect(arabic.sourceFile(glance, 'ar')).toBe('ar/about/darebay-at-a-glance.md')
        const cluster = [
            { hreflang: 'ru', href: abs('/o-proekte/darebay-v-tsifrakh') },
            { hreflang: 'uk', href: abs('/ua/pro-proekt/darebay-u-tsyfrakh') },
            { hreflang: 'en', href: abs('/en/about/darebay-at-a-glance') },
            { hreflang: 'ar', href: abs('/ar/about/darebay-at-a-glance') },
            // x-default stays English: the Arabic version does not move it.
            { hreflang: 'x-default', href: abs('/en/about/darebay-at-a-glance') },
        ]
        // One cluster per page, printed identically on every version of it — the English page now
        // names the Arabic one, and the Arabic one names the English one back.
        expect(arabic.hreflangCluster(glance)).toEqual(cluster)
        expect(arabic.alternateLocalesOf(glance, 'ar')).toEqual(['ru', 'uk', 'en'])
        expect(arabic.alternateLocalesOf(glance, 'en')).toEqual(['ru', 'uk', 'ar'])
    })

    it('makes an Arabic-only page its own canonical and its own x-default', () => {
        const self = abs('/ar/earnings/clipping-in-the-gulf')
        expect(arabic.localesOf(arOnly)).toEqual(['ar'])
        expect(arabic.xDefaultLocaleOf(arOnly)).toBe('ar')
        expect(arabic.hreflangCluster(arOnly)).toEqual([
            { hreflang: 'ar', href: self },
            { hreflang: 'x-default', href: self },
        ])
        expect(arabic.alternateLocalesOf(arOnly, 'ar')).toEqual([])
        for (const language of ['ru', 'uk', 'en'] as const) expect(arabic.pagePath(arOnly, language)).toBeNull()
    })

    it('points x-default of an English and Arabic page at the English version', () => {
        expect(arabic.xDefaultLocaleOf(egypt)).toBe('en')
        expect(arabic.hreflangCluster(egypt)).toEqual([
            { hreflang: 'en', href: abs('/en/earnings/clipping-platforms-that-pay-in-egypt-and-arab-countries') },
            { hreflang: 'ar', href: abs('/ar/earnings/clipping-platforms-that-pay-in-egypt-and-arab-countries') },
            { hreflang: 'x-default', href: abs('/en/earnings/clipping-platforms-that-pay-in-egypt-and-arab-countries') },
        ])
    })

    it('routes only the Arabic hubs that have pages, and none before the tree is declared', () => {
        expect(arabic.CONTENT_SEGMENTS.filter((segment) => segment.startsWith('ar/'))).toEqual([
            'ar/earnings',
            'ar/about',
        ])
        const dark = createRegistry(withoutArabic([untranslated('earnings-hub')]))
        expect(dark.CONTENT_SEGMENTS.some((segment) => segment.startsWith('ar/'))).toBe(false)
    })

    it('offers a section only where its index exists in the language', () => {
        expect(arabic.hubIndexPath('earnings', 'ar')).toBe('/ar/earnings/')
        expect(arabic.hubIndexPath('about', 'ar')).toBeNull()
        expect(arabic.hubIndexPath('about', 'en')).toBe('/en/about/')
    })

    it('keeps retired Arabic addresses in Arabic, and lands a foreign one on the page itself', () => {
        expect(arabic.redirectTarget(arOnly, '/ar/earnings/gulf-clipping')).toBe('/ar/earnings/clipping-in-the-gulf')
        // No Russian version and no English one: x-default is the Arabic page.
        expect(arabic.redirectTarget(arOnly, '/zarabotok/staryy-adres')).toBe('/ar/earnings/clipping-in-the-gulf')
        expect(arabic.redirectMap()['/ar/earnings/gulf-clipping']).toBe('/ar/earnings/clipping-in-the-gulf')
    })

    it('rescues a link to an untranslated Arabic sibling onto the Arabic hub, where there is one', () => {
        expect(arabic.resolveLocalizedLink('/ar/earnings/how-much-clipping-pays#rates')).toBe('/ar/earnings/#rates')
        // No Arabic About index: left as written, so the dead-link check still catches it.
        expect(arabic.resolveLocalizedLink('/ar/about/is-darebay-legit')).toBe('/ar/about/is-darebay-legit')
        expect(arabic.resolveLocalizedLink('/ar/about/darebay-at-a-glance')).toBe('/ar/about/darebay-at-a-glance')
    })
})

describe('registry: product links from the Arabic tree lead into the English application', () => {
    const arabic = createRegistry(withArabic([translated('earnings-hub', '')]))

    it('names English as the application tree of an Arabic reader, and each tree its own otherwise', () => {
        expect(appLocaleOf('ar')).toBe('en')
        for (const language of ['ru', 'uk', 'en'] as const) expect(appLocaleOf(language)).toBe(language)
        expect(appPathFor('ar', 'tasks')).toBe('/en/tasks')
        expect(appPathFor('ar', 'for-business')).toBe('/en/for-business')
        expect(appPathFor('ar', '')).toBe('/en')
        expect(appPathFor('ru', '')).toBe('/')
        expect(appPathFor('uk', 'tasks')).toBe('/ua/tasks')
    })

    it('rewrites an application link written under /ar onto the English route, anchor and query kept', () => {
        expect(arabic.appLinkTarget('/ar/tasks')).toBe('/en/tasks')
        expect(arabic.appLinkTarget('/ar/earn/clips?from=docs#top')).toBe('/en/earn/clips?from=docs#top')
        expect(arabic.resolveLocalizedLink('/ar/tasks')).toBe('/en/tasks')
        expect(arabic.resolveLocalizedLink('/ar/for-business#launch')).toBe('/en/for-business#launch')
    })

    it('leaves every other link alone', () => {
        // Already an application address, in a tree the application serves.
        expect(arabic.appLinkTarget('/en/tasks')).toBeNull()
        expect(arabic.appLinkTarget('/ua/tasks')).toBeNull()
        expect(arabic.resolveLocalizedLink('/en/tasks')).toBe('/en/tasks')
        // An Arabic content address, and something that is neither.
        expect(arabic.appLinkTarget('/ar/earnings/')).toBeNull()
        expect(arabic.appLinkTarget('/ar/nothing-here')).toBeNull()
        expect(arabic.appLinkTarget('https://darebay.com/ar/tasks')).toBeNull()
    })

    it('adds no application routes: the dead-link allowance stays the three application trees', () => {
        const dark = createRegistry(withoutArabic([untranslated('earnings-hub')]))
        expect(arabic.APP_ROUTES).toEqual(dark.APP_ROUTES)
        expect(APP_ROUTES).toEqual(dark.APP_ROUTES)
        expect(APP_ROUTES.some((route) => route.startsWith('/ar/'))).toBe(false)
    })

    it('has nothing to rewrite while the tree is not declared', () => {
        const dark = createRegistry(withoutArabic([untranslated('earnings-hub')]))
        expect(dark.appLinkTarget('/ar/tasks')).toBeNull()
        expect(dark.resolveLocalizedLink('/ar/tasks')).toBe('/ar/tasks')
    })
})

describe('registry: declaring a tree is validated before anything is derived', () => {
    it('knows Arabic without the live manifest declaring it', () => {
        expect(KNOWN_LOCALES).toEqual(['ru', 'uk', 'en', 'ar'])
        expect(textDirectionOf('ar')).toBe('rtl')
        expect(localeOfSourcePath('ar/earnings/x.md')).toBe('ar')
        expect(localeOfSourcePath('arabic/x.md')).toBe('ru')
    })

    it('holds the Arabic axis to its stable shape', () => {
        expect(() => parseContentManifest({ ...withArabic([]), pages: [EN_ONLY], locales: { ...liveManifest.locales, ar: { prefix: '/arabic', vitepressKey: 'ar' } } })).toThrow(
            /manifest\.locales\.ar violates the stable locale axis/,
        )
    })

    it('requires an Arabic hub segment for every hub once the tree is declared, and refuses one before', () => {
        const withoutSegment = { ...withArabic([EN_ONLY]), hubs: { ...arabicHubs, help: withoutArabic([]).hubs.help } }
        expect(() => parseContentManifest(withoutSegment)).toThrow(/manifest\.hubs\.help is missing "ar"/)
        expect(() => parseContentManifest({ ...withoutArabic([EN_ONLY]), hubs: arabicHubs })).toThrow(/unknown key "ar"/)
    })

    it('never lets the manifest drop a live tree or declare an unknown one', () => {
        const { uk: _dropped, ...withoutUkrainian } = liveManifest.locales
        expect(() => parseContentManifest({ ...manifestWith([EN_ONLY]), locales: withoutUkrainian })).toThrow(/missing "uk"/)
        expect(() =>
            parseContentManifest({ ...manifestWith([EN_ONLY]), locales: { ...liveManifest.locales, fr: { prefix: '/fr', vitepressKey: 'fr' } } }),
        ).toThrow(/unknown key "fr"/)
    })

    it('accepts an Arabic slug only on a manifest that declares the tree', () => {
        expect(() => parseContentManifest(withArabic([AR_ONLY]))).not.toThrow()
        expect(() => parseContentManifest(withoutArabic([AR_ONLY]))).toThrow(/unknown key "ar"/)
    })
})
