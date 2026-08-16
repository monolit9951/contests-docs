import contentManifest from '../content-pages.json' with { type: 'json' }

// The content registry — the single source of truth for every content URL.
//
// WHY THIS EXISTS. Until the 2026-08 migration a page's identity WAS its file
// path: `docs/ru/zarabotok/foo.md` served `/docs/ru/zarabotok/foo`, and the
// Ukrainian sibling of a page was assumed to be the same path under a `/ua`
// prefix. That assumption dies the moment a slug is translated — `zarabotok`
// becomes `zarobitok`, and nothing in the URL tells you the two are the same
// document any more. An hreflang cluster derived from a shared path then goes
// silently asymmetric, and Google discards an asymmetric cluster whole.
//
// So identity moves into `docs/content-pages.json`. A page is an `id`; its
// address in each locale is data. Keeping the manifest outside `.vitepress`
// lets the content producer add a page without receiving permission to edit
// build configuration.
// Everything else is DERIVED from this file and never hand-written:
//
//   * the public URL of a page in any locale        (pageUrl)
//   * the hreflang cluster                          (hreflangCluster)
//   * the content sitemap and canonical HTML hreflang
//   * the nginx `location` list (which prefixes the content container serves)
//   * the 301 map from every retired address        (redirectMap)
//
// TWO RULES THAT ARE NOT NEGOTIABLE.
//
//  1. RUSSIAN LIVES AT THE ROOT, every other language behind a prefix. In July
//     an EN tree sat on the SHORT urls while RU sat a level deeper; Google
//     indexed the English pages and served English sitelinks under a Russian
//     brand query, and the tree had to be removed on 2026-07-25. Never again.
//  2. A PAGE DECLARES ONLY THE LOCALES IT ACTUALLY HAS. `hreflangCluster`
//     lists exactly those. This is what makes partial translation safe: no empty
//     locale tree and no fallback-language text under a translated address.

export type Locale = 'ru' | 'uk' | 'en'
export type HubId = 'earnings' | 'brands' | 'help' | 'about' | 'legal'

export interface LocaleAxis {
    /** i18next / hreflang / <html lang> code. */
    readonly language: Locale
    /** URL prefix WITHOUT a trailing slash. '' for the locale served at the root. */
    readonly prefix: string
    /** VitePress locale key: 'root' for the unprefixed one, else the dir name. */
    readonly vitepressKey: string
}

export interface RegistryEntry {
    /** Stable identity. Never changes, never appears in a URL. */
    readonly id: string
    readonly hub: HubId
    /**
     * Slug per locale. A hub's index page uses '' — it lives at the hub root.
     * A locale absent here means the page does not exist in that language, and
     * it will not appear in that locale's sitemap or in any hreflang cluster.
     */
    readonly slugs: Partial<Record<Locale, string>>
    /**
     * Public paths this page used to answer on, absolute and origin-less.
     * Every one becomes a single-hop 301 onto the page's current RU address.
     * Entries are never deleted: a 301 costs nothing and holds the old address
     * for years.
     */
    readonly retired?: readonly string[]
}

interface ContentManifest {
    readonly schemaVersion: 1
    readonly origin: string
    readonly locales: Readonly<Record<Locale, Omit<LocaleAxis, 'language'>>>
    readonly hubs: Readonly<Record<HubId, Readonly<Record<Locale, string>>>>
    readonly pages: readonly RegistryEntry[]
}

const LOCALE_ORDER: readonly Locale[] = ['ru', 'uk', 'en']
const HUB_ORDER: readonly HubId[] = ['earnings', 'brands', 'help', 'about', 'legal']
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
const assertKeys = (value: Record<string, unknown>, required: readonly string[], optional: readonly string[], label: string) => {
    const allowed = new Set([...required, ...optional])
    for (const key of required) if (!(key in value)) throw new Error(`registry: ${label} is missing "${key}"`)
    for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`registry: ${label} has unknown key "${key}"`)
}
const assertString = (value: unknown, label: string): asserts value is string => {
    if (typeof value !== 'string') throw new Error(`registry: ${label} must be a string`)
}

/** Fail closed before any sitemap, redirect or public manifest is derived. */
const parseManifest = (input: unknown): ContentManifest => {
    if (!isRecord(input)) throw new Error('registry: docs/content-pages.json must be an object')
    assertKeys(input, ['schemaVersion', 'origin', 'locales', 'hubs', 'pages'], [], 'manifest')
    if (input.schemaVersion !== 1) {
        throw new Error(`registry: unsupported docs/content-pages.json schemaVersion ${String(input.schemaVersion)}`)
    }
    if (input.origin !== 'https://darebay.com') throw new Error('registry: manifest origin must be https://darebay.com')

    if (!isRecord(input.locales)) throw new Error('registry: manifest.locales must be an object')
    assertKeys(input.locales, LOCALE_ORDER, [], 'manifest.locales')
    const expectedAxes = {
        ru: { prefix: '', vitepressKey: 'root' },
        uk: { prefix: '/ua', vitepressKey: 'ua' },
        en: { prefix: '/en', vitepressKey: 'en' },
    } as const
    for (const locale of LOCALE_ORDER) {
        const axis = input.locales[locale]
        if (!isRecord(axis)) throw new Error(`registry: manifest.locales.${locale} must be an object`)
        assertKeys(axis, ['prefix', 'vitepressKey'], [], `manifest.locales.${locale}`)
        if (axis.prefix !== expectedAxes[locale].prefix || axis.vitepressKey !== expectedAxes[locale].vitepressKey) {
            throw new Error(`registry: manifest.locales.${locale} violates the stable locale axis`)
        }
    }

    if (!isRecord(input.hubs)) throw new Error('registry: manifest.hubs must be an object')
    assertKeys(input.hubs, HUB_ORDER, [], 'manifest.hubs')
    for (const hub of HUB_ORDER) {
        const localized = input.hubs[hub]
        if (!isRecord(localized)) throw new Error(`registry: manifest.hubs.${hub} must be an object`)
        assertKeys(localized, LOCALE_ORDER, [], `manifest.hubs.${hub}`)
        for (const locale of LOCALE_ORDER) {
            assertString(localized[locale], `manifest.hubs.${hub}.${locale}`)
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(localized[locale])) {
                throw new Error(`registry: invalid hub slug manifest.hubs.${hub}.${locale}`)
            }
        }
    }

    if (!Array.isArray(input.pages) || input.pages.length === 0) {
        throw new Error('registry: manifest.pages must be a non-empty array')
    }
    for (const [index, page] of input.pages.entries()) {
        const label = `manifest.pages[${index}]`
        if (!isRecord(page)) throw new Error(`registry: ${label} must be an object`)
        assertKeys(page, ['id', 'hub', 'slugs'], ['retired'], label)
        assertString(page.id, `${label}.id`)
        assertString(page.hub, `${label}.hub`)
        if (!HUB_ORDER.includes(page.hub as HubId)) throw new Error(`registry: ${label}.hub is unknown`)
        if (!isRecord(page.slugs)) throw new Error(`registry: ${label}.slugs must be an object`)
        assertKeys(page.slugs, [], LOCALE_ORDER, `${label}.slugs`)
        if (!Object.keys(page.slugs).length) throw new Error(`registry: ${label}.slugs must not be empty`)
        for (const [locale, slug] of Object.entries(page.slugs)) {
            assertString(slug, `${label}.slugs.${locale}`)
            if (slug !== '' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
                throw new Error(`registry: invalid page slug ${label}.slugs.${locale}`)
            }
        }
        if (page.retired !== undefined) {
            if (!Array.isArray(page.retired)) throw new Error(`registry: ${label}.retired must be an array`)
            for (const [retiredIndex, path] of page.retired.entries()) {
                assertString(path, `${label}.retired[${retiredIndex}]`)
                // This value is emitted as an nginx exact-location argument.
                // Limit it to unreserved URL characters, slashes and valid
                // percent escapes; nginx-significant `$`, `;`, quotes and
                // parentheses must never enter generated configuration.
                if (!/^\/(?:[-A-Za-z0-9._~/]|%[0-9A-Fa-f]{2})*$/.test(path) || path.includes('//')) {
                    throw new Error(`registry: invalid retired path ${label}.retired[${retiredIndex}]`)
                }
            }
        }
    }
    return input as unknown as ContentManifest
}

const manifest = parseManifest(contentManifest)

// `/ua` and not `/uk`: `uk` is the LANGUAGE code (ISO 639-1) and the only value
// hreflang accepts, but a Ukrainian reader parses `/uk/` as United Kingdom. The
// URL segment talks to a human, the hreflang value talks to a crawler.
export const LOCALES: readonly LocaleAxis[] = LOCALE_ORDER.map((language) => ({
    language,
    ...manifest.locales[language],
}))

export const ROOT_LOCALE = LOCALES[0]
export const ORIGIN = manifest.origin

/** Top-level sections, including every locale segment needed to resolve URLs. */
export const HUBS: Readonly<Record<HubId, Readonly<Record<Locale, string>>>> = manifest.hubs

// ---------------------------------------------------------------------------
// The pages.
//
// Sorted by hub, index page first. `retired` carries the pre-migration address
// of every page; the four-level `/docs/ru/<zone>/<slug>` shape is gone, and two
// of those levels never carried meaning.
//
// Slugs that were English (`create-your-first-contest`, `submit-a-work`, …) are
// leftovers of the EN tree removed in July: Russian pages wearing English
// addresses. They are translated here, which is the whole point of the rule.
// ---------------------------------------------------------------------------

export const CONTENT_MANIFEST_SCHEMA_VERSION = manifest.schemaVersion
export const PAGES = manifest.pages

/**
 * Retired addresses whose page did not survive the migration, mapped onto the
 * page that replaced them. Kept apart from `PAGES` because there is no entry
 * they belong to — but they must still single-hop, not 404.
 */
export const ORPHAN_REDIRECTS: Readonly<Record<string, string>> = {
    // The old `kak-rabotaet` index duplicated the app's own explainer, which
    // has since been split by audience: `/how-it-works` retired into `/earn` on
    // 2026-08-07. Points at the app's CURRENT address — naming a retired one
    // would make this a two-hop chain, caught by gate 1 of scripts/url-gates.mjs.
    '/docs/ru/kak-rabotaet/': '/earn',
}

/**
 * Retired addresses that have NO file behind them because they are already
 * answered by a 301 today — the eight rules added on 2026-07-25 when the EN
 * tree was removed, plus `/docs/ru/` which was folded into `/docs/`.
 *
 * They are listed so the integrity check can tell "this address legitimately
 * has no page" apart from "someone mistyped a path", and so that the migration
 * rewrites them onto their FINAL target instead of stacking a second hop on an
 * existing redirect.
 */
export const ALREADY_REDIRECTING: readonly string[] = [
    // The seventeen English addresses removed on 2026-07-25. They were answered
    // by one prefix rule (`/docs/(getting-started|faq|legal)(/.*)?` -> the RU
    // counterpart), so none of them has a file — and each is now listed on the
    // page that actually replaced it rather than swept into a section index.
    // Sending seventeen indexed addresses to a hub is one hop, but it is one hop
    // to the wrong page, and Google treats that as a soft-404 more often than as
    // a move.
    '/docs/faq/',
    '/docs/faq/choosing-winners',
    '/docs/faq/crypto',
    '/docs/faq/fake-submissions',
    '/docs/faq/fees',
    '/docs/faq/illegal-content',
    '/docs/faq/no-submissions',
    '/docs/faq/withdraw',
    '/docs/getting-started/',
    '/docs/getting-started/create-your-first-contest',
    '/docs/getting-started/prizes-and-payouts',
    '/docs/getting-started/submit-a-work',
    '/docs/getting-started/verification-and-trust',
    '/docs/getting-started/watch-vote-win',
    '/docs/legal/',
    '/docs/legal/privacy',
    '/docs/legal/terms',
    '/docs/ru/',
]

// ---------------------------------------------------------------------------
// Derivations. Nothing below is ever hand-maintained.
// ---------------------------------------------------------------------------

export const localeAxis = (language: Locale): LocaleAxis => {
    const axis = LOCALES.find((l) => l.language === language)
    if (!axis) throw new Error(`registry: unknown locale ${language}`)
    return axis
}

/** Locales a page actually exists in, in LOCALES order. */
export const localesOf = (entry: RegistryEntry): Locale[] =>
    LOCALES.map((l) => l.language).filter((lang) => entry.slugs[lang] !== undefined)

/**
 * Public path of a page in one locale, or null when the page has no version in
 * it. Hub indexes keep their trailing slash; leaf pages have none. One form per
 * address, always — two forms answering 200 is a duplicate on every page.
 */
export const pagePath = (entry: RegistryEntry, language: Locale): string | null => {
    const slug = entry.slugs[language]
    if (slug === undefined) return null
    const { prefix } = localeAxis(language)
    const hub = HUBS[entry.hub][language]
    return slug === '' ? `${prefix}/${hub}/` : `${prefix}/${hub}/${slug}`
}

export const pageUrl = (entry: RegistryEntry, language: Locale): string | null => {
    const path = pagePath(entry, language)
    return path === null ? null : `${ORIGIN}${path}`
}

/**
 * The hreflang cluster of one page: every locale it EXISTS in, itself included,
 * plus x-default on the root locale when the root locale is one of them.
 *
 * A single-locale page still gets a self-referencing entry — that is valid and
 * it is what keeps the set symmetric once a translation is added later.
 */
export const hreflangCluster = (entry: RegistryEntry): { hreflang: string; href: string }[] => {
    const langs = localesOf(entry)
    const cluster = langs.map((lang) => ({ hreflang: lang, href: pageUrl(entry, lang)! }))
    if (langs.includes(ROOT_LOCALE.language)) {
        cluster.push({ hreflang: 'x-default', href: pageUrl(entry, ROOT_LOCALE.language)! })
    }
    return cluster
}

/**
 * Source file of a page inside `docs/`, relative and extension-included.
 * Root locale lives at `<hub>/<slug>.md`, every other locale one level down
 * under its VitePress key — which is exactly what `locales` expects.
 */
export const sourceFile = (entry: RegistryEntry, language: Locale): string | null => {
    const slug = entry.slugs[language]
    if (slug === undefined) return null
    const { vitepressKey } = localeAxis(language)
    const dir = vitepressKey === 'root' ? '' : `${vitepressKey}/`
    const hub = HUBS[entry.hub][language]
    return slug === '' ? `${dir}${hub}/index.md` : `${dir}${hub}/${slug}.md`
}

/**
 * Addresses on darebay.com that the APPLICATION serves, which content pages
 * link to. They are real URLs and dead only from this container's point of
 * view, so VitePress's dead-link check has to be told about them.
 *
 * Listed one by one rather than muted with a pattern: a blanket
 * `ignoreDeadLinks` would also swallow a genuine typo in a content link, which
 * is the failure this whole registry exists to make impossible. Adding a link
 * to a new app route means adding a line here, and that is the point.
 */
const APP_SECTIONS = [
    'for-business',
    'for-business/courses',
    'for-business/telegram',
    'for-business/apps',
    'for-business/saas',
    'earn',
    'earn/clips',
    'earn/ugc',
    'earn/traffic',
    'earn/teams',
    'store',
    'feed',
    'top',
    'tasks',
] as const

// The application serves ONE slug per section under every locale prefix (its
// slugs were translated for one afternoon on 2026-08-03 and reverted), so the
// list is derived rather than written out three times. If that ever changes
// again, this is where it breaks — loudly, via VitePress's dead-link check.
export const APP_ROUTES: readonly string[] = LOCALES.flatMap((locale) =>
    APP_SECTIONS.map((slug) => `${locale.prefix}/${slug}`)
)

/**
 * Every URL prefix the content container answers on — and ONLY the ones that
 * have pages.
 *
 * A locale is routed here when at least one page declares it. Routing
 * `/ua/zarobitok/` before a single Ukrainian page exists would hand the reader
 * a 404 from the content container instead of the application's own 404 page,
 * and would put an empty branch in front of the crawler. Same rule as
 * `hreflangCluster`: what does not exist is not announced.
 */
/**
 * Files the content build writes to the ROOT of its output, which therefore
 * need their own route on the host: with routing by hub prefix, anything not
 * under a hub falls through to the application and 404s.
 *
 * `vp-icons.css` and `hashmap.json` are VitePress's own — the first is loaded by
 * every page, the second by its client router — and both are easy to forget
 * precisely because nothing links to them in the markup a human reads.
 */
export const CONTENT_ROOT_FILES: readonly string[] = [
    '/sitemap-content.xml',
    '/llms.txt',
    '/.well-known/darebay-content-pages.json',
    '/.well-known/darebay-content-release.txt',
    '/vp-icons.css',
    '/hashmap.json',
]

export const CONTENT_SEGMENTS: readonly string[] = LOCALES.flatMap((locale) => {
    const hubsWithPages = new Set(
        PAGES.filter((page) => page.slugs[locale.language] !== undefined).map((page) => page.hub)
    )
    return [...hubsWithPages].map((hubId) => {
        const segment = HUBS[hubId][locale.language]
        return locale.prefix ? `${locale.prefix.slice(1)}/${segment}` : segment
    })
})

/**
 * Old address → new address, one hop each.
 *
 * ⚠️ The eight redirects added in July (the EN-tree removal) pointed at
 * `/docs/ru/...`, which this migration then moves again. Chaining them would
 * make `EN → RU-old → new` a two- or three-hop trip, and every hop bleeds a
 * little authority and a lot of crawl budget. They are therefore rewritten onto
 * their FINAL address here rather than layered on top — which is why entries
 * like `/docs/faq/fees` sit in the `retired` list of the page they now serve.
 */
/**
 * The locale a retired address was written in, read from its own prefix.
 *
 * Until the 2026-08 consolidation every `retired` entry was Russian (`/docs/ru/…`),
 * so mapping them all onto the RU canonical was invisibly correct. Collapsing six
 * pages across all three locales broke that assumption: a Ukrainian reader arriving
 * on `/ua/zarobitok/skilky-platiat-novachku` was 301'd onto the RUSSIAN survivor.
 * A cross-language redirect is worse than a 404 — it silently swaps the reader's
 * language and puts the wrong page in the hreflang cluster.
 */
const retiredLocale = (old: string): Locale => {
    for (const axis of LOCALES) {
        if (axis.prefix && (old === axis.prefix || old.startsWith(`${axis.prefix}/`))) return axis.language
    }
    return ROOT_LOCALE.language
}

export const redirectMap = (): Record<string, string> => {
    const map: Record<string, string> = { ...ORPHAN_REDIRECTS }
    for (const entry of PAGES) {
        const rootTarget = pagePath(entry, ROOT_LOCALE.language)
        if (!rootTarget) continue
        for (const old of entry.retired ?? []) {
            // Land in the reader's own language when the survivor has it. A page
            // registered ru-only (a translation that does not exist yet) still falls
            // back to the root canonical: a live page in the wrong language beats a
            // dead address, and the fallback disappears once the locale is registered.
            map[old] = pagePath(entry, retiredLocale(old)) ?? rootTarget
        }
    }
    return map
}

/**
 * Resolves a link written for a locale onto an address that EXISTS.
 *
 * Content is translated page by page, so a Ukrainian article legitimately links
 * to siblings that are still Russian only. Three ways to handle that, and two of
 * them are wrong: leave the link to 404, or drop it and leave the reader with no
 * way onward. The third is to send them to the HUB of that section in their own
 * language — a live page, in their language, listing everything that section has
 * so far. They land one click from where they were going instead of nowhere.
 *
 * The fallback disappears by itself the moment the translation is registered:
 * once the address resolves, this returns it untouched.
 *
 * A link that matches no live page AND no known hub is left exactly as written,
 * so VitePress's dead-link check still fails on a genuine typo. That is the line
 * between "not translated yet" and "wrong".
 */
export const resolveLocalizedLink = (href: string): string => {
    if (!href.startsWith('/')) return href

    const clean = href.replace(/#.*$/, '')
    const anchor = href.slice(clean.length)

    const live = PAGES.some((entry) =>
        LOCALES.some((locale) => entry.slugs[locale.language] !== undefined && pagePath(entry, locale.language) === clean)
    )
    if (live) return href

    const locale = LOCALES.find((l) => l.prefix && clean.startsWith(`${l.prefix}/`))
    if (!locale) return href

    const hubSegment = clean.slice(locale.prefix.length + 1).split('/')[0]
    const hubId = (Object.keys(HUBS) as HubId[]).find((id) => HUBS[id][locale.language] === hubSegment)
    if (!hubId) return href

    const hubEntry = PAGES.find((e) => e.hub === hubId && e.slugs[locale.language] === '')
    return hubEntry ? `${pagePath(hubEntry, locale.language)}${anchor}` : href
}
