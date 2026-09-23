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
//   * the legacy spellings of those addresses and the host prefixes that
//     route them to this container                  (LEGACY_ROUTE_PREFIXES)
//
// TWO RULES THAT ARE NOT NEGOTIABLE.
//
//  1. RUSSIAN LIVES AT THE ROOT, every other language behind a prefix. In July
//     an EN tree sat on the SHORT urls while RU sat a level deeper; Google
//     indexed the English pages and served English sitelinks under a Russian
//     brand query, and the tree had to be removed on 2026-07-25. Never again.
//     This fixes the ADDRESS SHAPE of the `ru` axis; it does not oblige any
//     individual page to exist in Russian.
//  2. A PAGE DECLARES ONLY THE LOCALES IT ACTUALLY HAS — at least one, and
//     every declared one backed by a file. `hreflangCluster` lists exactly
//     those. This is what makes partial translation safe: no empty locale tree
//     and no fallback-language text under a translated address.
//
//     A page therefore needs no Russian version at all. Founder, 2026-09-18:
//     pages about markets that do not read Russian ("who pays clippers in
//     India / Pakistan / Nigeria") ship EN-only, because the Russian twin of
//     such a page would be a doorway — text written for nobody, to satisfy a
//     registry rule. Nothing below singles the root locale out; a page with one
//     locale is self-canonical and its own x-default, exactly as the six ru-only
//     pages already are.

export type Locale = 'ru' | 'uk' | 'en' | 'ar'
export type HubId = 'earnings' | 'brands' | 'help' | 'about' | 'legal'
export type TextDirection = 'ltr' | 'rtl'

export interface LocaleAxis {
    /** i18next / hreflang / <html lang> code. */
    readonly language: Locale
    /** URL prefix WITHOUT a trailing slash. '' for the locale served at the root. */
    readonly prefix: string
    /** VitePress locale key: 'root' for the unprefixed one, else the dir name. */
    readonly vitepressKey: string
    /** `<html dir>`: the side every logical CSS property of the page resolves to. */
    readonly dir: TextDirection
}

// ---------------------------------------------------------------------------
// KNOWING a language and SERVING it are two different things.
//
// The table below is code: every language the build knows how to render, with
// the fixed shape of its tree — the URL prefix, the source directory, the
// writing direction — and the application tree its readers are sent to. The
// manifest (`docs/content-pages.json`) decides which of them are LIVE: a known
// language that the manifest does not declare has no address, no route, no
// sitemap entry and no hreflang, exactly like a translation a page does not
// have. So a new language is prepared here — its shape, its interface copy, its
// right-to-left layout — and goes live the day the manifest declares it
// together with its first pages, with no second code change.
//
// `app` is the application locale behind the product links of a docs locale.
// The application speaks Russian, Ukrainian and English (and Polish, which has
// no docs tree), not Arabic: an Arabic reader who presses "open the tasks" is
// sent to the English interface, and that decision lives here, once, rather
// than in the text of every Arabic page (`appPathFor`, `appLinkTarget`).
// ---------------------------------------------------------------------------

interface LocaleShape {
    readonly prefix: string
    readonly vitepressKey: string
    readonly dir: TextDirection
    readonly app: Locale
}

const LOCALE_SHAPES: Readonly<Record<Locale, LocaleShape>> = {
    ru: { prefix: '', vitepressKey: 'root', dir: 'ltr', app: 'ru' },
    uk: { prefix: '/ua', vitepressKey: 'ua', dir: 'ltr', app: 'uk' },
    en: { prefix: '/en', vitepressKey: 'en', dir: 'ltr', app: 'en' },
    // Latin slugs under `/ar`, like every other tree: an Arabic-script slug would
    // travel as percent-escapes, and the slug grammar below admits none.
    ar: { prefix: '/ar', vitepressKey: 'ar', dir: 'rtl', app: 'en' },
}

/**
 * Every language the build can render, in the order its trees are listed —
 * hreflang clusters, the language switcher, llms.txt, the host routes. A new
 * language is appended, so nothing already published changes its order.
 *
 * Every per-locale dictionary (interface copy, labels, Open Graph locales) is
 * keyed by this list, and `locales.test.ts` fails when one of them misses a
 * language here.
 */
export const KNOWN_LOCALES: readonly Locale[] = ['ru', 'uk', 'en', 'ar']

/**
 * The trees the manifest can never drop: they have pages, host routes and
 * indexed addresses. Every other known language is optional and dark until the
 * manifest declares it.
 */
const MANDATORY_LOCALES: readonly Locale[] = ['ru', 'uk', 'en']

/**
 * The fixed axis of a known language, declared or not: where its tree WOULD live. For the live
 * trees use `LOCALES` / `localeAxis`; this is for code that has to be ready before a tree is
 * declared — a hand-written nginx location, a test of it.
 */
export const knownAxisOf = (language: Locale): LocaleAxis => {
    const { prefix, vitepressKey, dir } = LOCALE_SHAPES[language]
    return { language, prefix, vitepressKey, dir }
}

/** Writing direction of a known language, declared or not. */
export const textDirectionOf = (language: Locale): TextDirection => LOCALE_SHAPES[language].dir

/**
 * The application locale a reader of this docs locale is sent to: the same
 * language where the application has it, English where it does not.
 */
export const appLocaleOf = (language: Locale): Locale => LOCALE_SHAPES[language].app

/**
 * The language of a page, read off its docs-relative source path: `ua/…` is
 * Ukrainian, `ar/…` Arabic, anything outside a locale directory the root locale.
 * It is how a Markdown rule that only has a file name knows the language of the
 * page it is rendering. Directories are matched whole, so `uanews/x.md` is not
 * Ukrainian.
 */
export const localeOfSourcePath = (path: string): Locale => {
    const normalized = String(path).replace(/\\/g, '/').replace(/^\/+/, '')
    for (const language of KNOWN_LOCALES) {
        const { vitepressKey } = LOCALE_SHAPES[language]
        if (vitepressKey !== 'root' && normalized.startsWith(`${vitepressKey}/`)) return language
    }
    return KNOWN_LOCALES.find((language) => LOCALE_SHAPES[language].vitepressKey === 'root')!
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
     * Every one becomes a single-hop 301 onto this page's current address in
     * the reader's own language, or onto its x-default version when the page
     * has no version in that language (`redirectTarget`).
     * Entries are never deleted: a 301 costs nothing and holds the old address
     * for years.
     */
    readonly retired?: readonly string[]
}

interface ContentManifest {
    readonly schemaVersion: 1
    readonly origin: string
    /** The LIVE trees: a subset of `KNOWN_LOCALES` that always holds the mandatory three. */
    readonly locales: Readonly<Partial<Record<Locale, Omit<LocaleAxis, 'language' | 'dir'>>>>
    /** One segment per hub for every declared locale — and for no other. */
    readonly hubs: Readonly<Record<HubId, Readonly<Partial<Record<Locale, string>>>>>
    readonly pages: readonly RegistryEntry[]
}

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

/**
 * Fail closed before any sitemap, redirect or public manifest is derived.
 *
 * Exported so the schema contract can be exercised on an in-memory manifest:
 * the rules that matter here — at least one locale per page, only known
 * locales, slug hygiene — are rejections, and a rejection cannot be proven by
 * the live manifest, which by definition contains no rejected entry.
 */
export const parseContentManifest = (input: unknown): ContentManifest => {
    if (!isRecord(input)) throw new Error('registry: docs/content-pages.json must be an object')
    assertKeys(input, ['schemaVersion', 'origin', 'locales', 'hubs', 'pages'], [], 'manifest')
    if (input.schemaVersion !== 1) {
        throw new Error(`registry: unsupported docs/content-pages.json schemaVersion ${String(input.schemaVersion)}`)
    }
    if (input.origin !== 'https://darebay.com') throw new Error('registry: manifest origin must be https://darebay.com')

    if (!isRecord(input.locales)) throw new Error('registry: manifest.locales must be an object')
    assertKeys(
        input.locales,
        MANDATORY_LOCALES,
        KNOWN_LOCALES.filter((locale) => !MANDATORY_LOCALES.includes(locale)),
        'manifest.locales',
    )
    // The live trees, in the fixed order of `KNOWN_LOCALES` whatever the key
    // order in the file. Everything below — hub segments, page slugs — is
    // checked against THIS list, so a language the manifest has not declared
    // cannot slip in through a hub or a page.
    const declared = KNOWN_LOCALES.filter((locale) => locale in input.locales)
    for (const locale of declared) {
        const axis = (input.locales as Record<string, unknown>)[locale]
        if (!isRecord(axis)) throw new Error(`registry: manifest.locales.${locale} must be an object`)
        assertKeys(axis, ['prefix', 'vitepressKey'], [], `manifest.locales.${locale}`)
        const shape = LOCALE_SHAPES[locale]
        if (axis.prefix !== shape.prefix || axis.vitepressKey !== shape.vitepressKey) {
            throw new Error(`registry: manifest.locales.${locale} violates the stable locale axis`)
        }
    }

    if (!isRecord(input.hubs)) throw new Error('registry: manifest.hubs must be an object')
    assertKeys(input.hubs, HUB_ORDER, [], 'manifest.hubs')
    for (const hub of HUB_ORDER) {
        const localized = input.hubs[hub]
        if (!isRecord(localized)) throw new Error(`registry: manifest.hubs.${hub} must be an object`)
        assertKeys(localized, declared, [], `manifest.hubs.${hub}`)
        for (const locale of declared) {
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
        assertKeys(page.slugs, [], declared, `${label}.slugs`)
        // At least one locale, and no locale is privileged: a page with only
        // `en` is as valid as a page with only `ru`. A page with none has no
        // address at all, so it could not be served, linked or redirected to.
        if (!Object.keys(page.slugs).length) {
            throw new Error(`registry: ${label}.slugs declares no locale — a semantic page needs at least one`)
        }
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

// ---------------------------------------------------------------------------
// Constants that belong to no manifest.
// ---------------------------------------------------------------------------

/**
 * Retired addresses whose page or file did not survive the migration, mapped
 * onto the address that replaced them. Kept apart from `PAGES` because there is
 * no entry they belong to — but they must still single-hop, not 404.
 */
export const ORPHAN_REDIRECTS: Readonly<Record<string, string>> = {
    // The old `kak-rabotaet` index duplicated the app's own explainer, which
    // has since been split by audience: `/how-it-works` retired into `/earn` on
    // 2026-08-07. Points at the app's CURRENT address — naming a retired one
    // would make this a two-hop chain, caught by gate 1 of scripts/url-gates.mjs.
    '/docs/ru/kak-rabotaet/': '/earn',
    // The sitemap of the old `/docs/` tree. robots.txt named it until 2026-08-04
    // (contests-frontend 8c30ea14), when the migration replaced it with the root
    // `/sitemap-content.xml` of this same site. Crawlers keep sitemap addresses
    // long after robots.txt drops them: GPTBot asked for this one on 14 of the 15
    // days of the 2026-09-18 nginx baseline and got a 404 every time.
    '/docs/sitemap.xml': '/sitemap-content.xml',
}

/**
 * The root tree's legacy alias: `/ru/<path>` is `/<path>` spelled with the
 * language segment the site carried before Russian moved to the root.
 *
 * The application strips it blindly (contests-frontend nginx.conf, the `^/ru/`
 * regex next to `location = /ru/`) and 301s onto the bare path. For a content
 * address that bare path is a second hop at best (`/ru/o-proekte` -> `/o-proekte`
 * -> `/o-proekte/`) and a 404 at worst (`/ru/faq/illegal-content` ->
 * `/faq/illegal-content`). So every content address under the alias is
 * answered by THIS container, in one hop (`redirectMap`), and the host routes
 * those prefixes here (`LEGACY_ROUTE_PREFIXES`). `/ru` and `/ru/` themselves
 * stay the application's: they land on its home page.
 */
export const ROOT_LOCALE_LEGACY_ALIAS = '/ru'

/** The tree the whole site lived under until the 2026-08 migration. */
const RETIRED_DOCS_BASE = '/docs'

/**
 * An address with a file extension (`/docs/sitemap.xml`) was only ever served
 * under its own name, unlike a page, so no other spelling of it is derived.
 */
const FILE_ADDRESS = /\.[A-Za-z0-9]+$/

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

/**
 * The language `x-default` stands for: the version shown to a reader none of the
 * cluster's languages match. English, because English is what the site itself
 * gives the rest of the world (founder, 2026-09-01: every country outside Ukraine
 * and the Russian-speaking world reads English by default) — and the root locale
 * when a page has no English version. The application makes the same choice in
 * `contests-frontend/src/domain/i18n/localeRoute.ts` (`withXDefault`).
 */
export const X_DEFAULT_LANGUAGE: Locale = 'en'

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
    'partners',
    'top',
    'tasks',
] as const

export type AppSection = (typeof APP_SECTIONS)[number]

/**
 * The application's address of one section for a reader of `language` — in the
 * application tree that reader is sent to (`appLocaleOf`), so an Arabic page
 * gets the English catalogue. The ONE place the docs build writes a product
 * address; `links.ts` (header, hero, CTA) and the Markdown link rewrite below
 * both come through here.
 */
export const appPathFor = (language: Locale, section: AppSection | ''): string => {
    const prefix = LOCALE_SHAPES[appLocaleOf(language)].prefix
    if (section === '') return prefix || '/'
    if (!(APP_SECTIONS as readonly string[]).includes(section)) {
        throw new Error(`registry: "${section}" is not an application section`)
    }
    return `${prefix}/${section}`
}

/**
 * Files the content build writes to the ROOT of its output, which therefore
 * need their own route on the host: with routing by hub prefix, anything not
 * under a hub falls through to the application and 404s.
 *
 * `vp-icons.css` and `hashmap.json` are VitePress's own, and both are easy to
 * forget precisely because nothing links to them in the markup a human reads.
 * `hashmap.json` is fetched by the client router. VitePress writes `vp-icons.css`
 * on every build, but current pages do not link it while it is empty (config.ts
 * `transformHtml`, see headAssets.ts; the dist gate `vp-icons` holds both ways).
 * It stays routed all the same: HTML of earlier releases still in caches links
 * it, and a non-empty icons file would be linked again. Unused-looking is not
 * unused here: do not drop it.
 */
export const CONTENT_ROOT_FILES: readonly string[] = [
    '/sitemap-content.xml',
    '/llms.txt',
    '/.well-known/darebay-content-pages.json',
    '/.well-known/darebay-content-release.txt',
    // The machine-readable fact card (`scripts/gen-facts-json.mjs`): the eleven public numbers
    // with the file each came from and the date it was read. Routed as ONE exact address rather
    // than a `/data/` prefix — a prefix would take that whole namespace away from the application
    // for the sake of a single file, and nothing here should claim more of the domain than it
    // serves. Adding it here is what makes it public: the host routes exactly this list, and
    // `url-gates.mjs` gate 5 plus `probe-live-routing.mjs` both probe every entry.
    '/data/darebay-facts.json',
    '/vp-icons.css',
    '/hashmap.json',
]

// ---------------------------------------------------------------------------
// Derivations. Nothing below is ever hand-maintained.
//
// They are built by `createRegistry` from ONE parsed manifest, and the module
// exports the instance built from the live `docs/content-pages.json`. The
// factory exists so the rules can be exercised on a manifest that is not the
// live one — a tree the live manifest has not declared yet (Arabic, until its
// first pages ship) has no address in the live instance, and a test that could
// only see the live instance could not prove anything about it.
// ---------------------------------------------------------------------------

export const createRegistry = (input: unknown) => {
    const manifest = parseContentManifest(input)

    // `/ua` and not `/uk`: `uk` is the LANGUAGE code (ISO 639-1) and the only value
    // hreflang accepts, but a Ukrainian reader parses `/uk/` as United Kingdom. The
    // URL segment talks to a human, the hreflang value talks to a crawler.
    const LOCALES: readonly LocaleAxis[] = KNOWN_LOCALES.filter((language) => manifest.locales[language]).map(
        (language) => ({
            language,
            ...manifest.locales[language]!,
            dir: LOCALE_SHAPES[language].dir,
        }),
    )

    const ROOT_LOCALE = LOCALES[0]
    const ORIGIN = manifest.origin

    /** Top-level sections, with a segment for every DECLARED locale. */
    const HUBS: Readonly<Record<HubId, Readonly<Partial<Record<Locale, string>>>>> = manifest.hubs

    // -----------------------------------------------------------------------
    // The pages.
    //
    // Sorted by hub, index page first. `retired` carries the pre-migration address
    // of every page; the four-level `/docs/ru/<zone>/<slug>` shape is gone, and two
    // of those levels never carried meaning.
    //
    // Slugs that were English (`create-your-first-contest`, `submit-a-work`, …) are
    // leftovers of the EN tree removed in July: Russian pages wearing English
    // addresses. They are translated here, which is the whole point of the rule.
    // -----------------------------------------------------------------------

    const CONTENT_MANIFEST_SCHEMA_VERSION = manifest.schemaVersion
    const PAGES = manifest.pages

    const localeAxis = (language: Locale): LocaleAxis => {
        const axis = LOCALES.find((l) => l.language === language)
        if (!axis) throw new Error(`registry: unknown locale ${language}`)
        return axis
    }

    /** Hub segment of a DECLARED locale; the parser guarantees every hub has one. */
    const hubSegment = (hub: HubId, language: Locale): string => {
        const segment = HUBS[hub][language]
        if (segment === undefined) throw new Error(`registry: hub ${hub} has no segment for ${language}`)
        return segment
    }

    /** Locales a page actually exists in, in LOCALES order. */
    const localesOf = (entry: RegistryEntry): Locale[] =>
        LOCALES.map((l) => l.language).filter((lang) => entry.slugs[lang] !== undefined)

    /**
     * Public path of a page in one locale, or null when the page has no version in
     * it. Hub indexes keep their trailing slash; leaf pages have none. One form per
     * address, always — two forms answering 200 is a duplicate on every page.
     */
    const pagePath = (entry: RegistryEntry, language: Locale): string | null => {
        const slug = entry.slugs[language]
        if (slug === undefined) return null
        const { prefix } = localeAxis(language)
        const hub = hubSegment(entry.hub, language)
        return slug === '' ? `${prefix}/${hub}/` : `${prefix}/${hub}/${slug}`
    }

    const pageUrl = (entry: RegistryEntry, language: Locale): string | null => {
        const path = pagePath(entry, language)
        return path === null ? null : `${ORIGIN}${path}`
    }

    /**
     * The index page of a hub in one language, or null when that hub has no index
     * there yet.
     *
     * A tree does not have to open with every section: Arabic starts with the
     * earnings hub and a handful of pages that live under About and Help. Every
     * link to a hub root — the header nav, the breadcrumb, the "all pages" link —
     * asks here first, so a section with no index in a language is simply not
     * offered in it instead of being linked to a 404.
     */
    const hubIndexPath = (hub: HubId, language: Locale): string | null => {
        const index = PAGES.find((entry) => entry.hub === hub && entry.slugs[language] === '')
        return index ? pagePath(index, language) : null
    }

    /**
     * The locale a page's `x-default` points at: English when the page has it, the
     * root locale otherwise — and, when it has neither, its first declared locale.
     *
     * That last branch is not a hypothetical: a page declares at least one locale
     * and may declare only one, so the only total answer for a page outside both
     * preferred languages is "itself". Returning `undefined` there would drop
     * x-default from its cluster and leave `hreflangCluster` partial for a page
     * that is perfectly well-formed. An Arabic-only page is exactly that page.
     */
    const xDefaultLocaleOf = (entry: RegistryEntry): Locale => {
        const langs = localesOf(entry)
        if (langs.includes(X_DEFAULT_LANGUAGE)) return X_DEFAULT_LANGUAGE
        if (langs.includes(ROOT_LOCALE.language)) return ROOT_LOCALE.language
        return langs[0]
    }

    /**
     * The OTHER locales a page exists in, seen from one of them — what the language
     * switcher offers and what `og:locale:alternate` announces.
     *
     * One rule, one implementation: the menu for humans and the tags for crawlers
     * used to filter `localesOf` inline in two places in config.ts, and the whole
     * reason `theme/langs.ts` exists is that those two once disagreed. For a
     * single-locale page this is empty, so the switcher offers nothing rather than
     * a translation that does not exist.
     */
    const alternateLocalesOf = (entry: RegistryEntry, current: Locale): Locale[] =>
        localesOf(entry).filter((language) => language !== current)

    /**
     * The hreflang cluster of one page: every locale it EXISTS in, itself included,
     * plus x-default on the English version — or on the root one for a page that has
     * no English (`xDefaultLocaleOf`).
     *
     * A single-locale page still gets a self-referencing entry plus x-default on
     * itself — two links, both pointing at the page. That is valid, it is what the
     * six ru-only pages already emit, and it is what keeps the set symmetric once a
     * translation is added later.
     */
    const hreflangCluster = (entry: RegistryEntry): { hreflang: string; href: string }[] => {
        const langs = localesOf(entry)
        const cluster = langs.map((lang) => ({ hreflang: lang, href: pageUrl(entry, lang)! }))
        cluster.push({ hreflang: 'x-default', href: pageUrl(entry, xDefaultLocaleOf(entry))! })
        return cluster
    }

    /**
     * Source file of a page inside `docs/`, relative and extension-included.
     * Root locale lives at `<hub>/<slug>.md`, every other locale one level down
     * under its VitePress key — which is exactly what `locales` expects.
     */
    const sourceFile = (entry: RegistryEntry, language: Locale): string | null => {
        const slug = entry.slugs[language]
        if (slug === undefined) return null
        const { vitepressKey } = localeAxis(language)
        const dir = vitepressKey === 'root' ? '' : `${vitepressKey}/`
        const hub = hubSegment(entry.hub, language)
        return slug === '' ? `${dir}${hub}/index.md` : `${dir}${hub}/${slug}.md`
    }

    /**
     * Locales a page DECLARES but has no file for, given the docs-relative paths
     * that exist on disk.
     *
     * A declared locale is a promise of an address: it enters the sitemap, the
     * hreflang cluster, the hub list and the host routes. Declaring one without the
     * file behind it is how a sitemap fills with 404s, so `check-registry.mjs`
     * gate 6 refuses it — this is that rule, named and pure so it can be exercised
     * on a file list instead of only on the current tree.
     */
    const missingSources = (entry: RegistryEntry, onDisk: ReadonlySet<string>): Locale[] =>
        localesOf(entry).filter((language) => !onDisk.has(sourceFile(entry, language)!))

    // The application serves ONE slug per section under every locale prefix (its
    // slugs were translated for one afternoon on 2026-08-03 and reverted), so the
    // list is derived rather than written out once per language. If that ever
    // changes again, this is where it breaks — loudly, via VitePress's dead-link
    // check. A docs tree without an application tree of its own (Arabic) adds no
    // routes: its readers are sent to the tree `appLocaleOf` names.
    const APP_ROUTES: readonly string[] = [
        ...new Set(LOCALES.flatMap((locale) => APP_SECTIONS.map((section) => appPathFor(locale.language, section)))),
    ]

    /**
     * The application address a docs link resolves to, or null when the link is
     * not a link into the application under a docs prefix of its own.
     *
     * A translator writes the product links of an Arabic page the way every other
     * tree writes them — `/ar/tasks`, the catalogue in the reader's language. The
     * application has no Arabic tree, so that address would be a 404 in the
     * product; this sends it to the tree `appLocaleOf` names, anchor and query
     * kept. Links under a locale the application does serve are left alone: they
     * are already the address.
     */
    const appLinkTarget = (href: string): string | null => {
        if (!href.startsWith('/')) return null
        const clean = href.replace(/[?#].*$/, '')
        const rest = href.slice(clean.length)
        for (const locale of LOCALES) {
            if (!locale.prefix || LOCALE_SHAPES[appLocaleOf(locale.language)].prefix === locale.prefix) continue
            if (!clean.startsWith(`${locale.prefix}/`)) continue
            const section = clean.slice(locale.prefix.length + 1).replace(/\/$/, '')
            if ((APP_SECTIONS as readonly string[]).includes(section)) {
                return `${appPathFor(locale.language, section as AppSection)}${rest}`
            }
        }
        return null
    }

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
    const CONTENT_SEGMENTS: readonly string[] = LOCALES.flatMap((locale) => {
        const hubsWithPages = new Set(
            PAGES.filter((page) => page.slugs[locale.language] !== undefined).map((page) => page.hub)
        )
        return [...hubsWithPages].map((hubId) => {
            const segment = hubSegment(hubId, locale.language)
            return locale.prefix ? `${locale.prefix.slice(1)}/${segment}` : segment
        })
    })

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

    /**
     * Where one retired address of one page lands.
     *
     * Land in the reader's own language when the survivor has it. When it does not
     * — a translation that does not exist yet, or a page written for one market
     * only — fall back to the survivor's x-default version: a live page in another
     * language beats a dead address, and the fallback disappears the moment the
     * locale is registered.
     *
     * This used to fall back to the RU canonical and SKIP the page entirely when it
     * had none, which silently dropped every retired address of a page without a
     * Russian version. Since 2026-09-18 such pages are legitimate, and a dropped
     * 301 is an indexed address turning into a 404.
     */
    const redirectTarget = (entry: RegistryEntry, old: string): string =>
        pagePath(entry, retiredLocale(old)) ?? pagePath(entry, xDefaultLocaleOf(entry))!

    /**
     * Recorded old address → new address, one hop each: every page's `retired`
     * list plus `ORPHAN_REDIRECTS`.
     *
     * ⚠️ The eight redirects added in July (the EN-tree removal) pointed at
     * `/docs/ru/...`, which this migration then moves again. Chaining them would
     * make `EN → RU-old → new` a two- or three-hop trip, and every hop bleeds a
     * little authority and a lot of crawl budget. They are therefore rewritten onto
     * their FINAL address here rather than layered on top — which is why entries
     * like `/docs/faq/fees` sit in the `retired` list of the page they now serve.
     */
    const recordedRedirects = (): Record<string, string> => {
        const map: Record<string, string> = { ...ORPHAN_REDIRECTS }
        for (const entry of PAGES) {
            for (const old of entry.retired ?? []) map[old] = redirectTarget(entry, old)
        }
        return map
    }

    /**
     * Other SPELLINGS of addresses that are already redirected or live, each
     * onto the SAME final target. Derived, never recorded: a spelling rule
     * written down address by address is the list that goes stale.
     *
     *  (a) The base-less twin of every `/docs/<dir>/...` source: `/faq/fees` for
     *      `/docs/faq/fees`, `/ru/faq/illegal-content` for
     *      `/docs/ru/faq/illegal-content`. While base was '/docs/' (2026-04-16
     *      to 2026-08-03) VitePress inlined the nav and sidebar links of every
     *      page WITHOUT the base into `__VP_SITE_DATA__`, and crawlers still
     *      ask for exactly those spellings (GSC, 2026-09-23: soft 404 and 404).
     *      Only sources with a directory component: a root-level leaf such as
     *      `/docs/skolko-platyat-novichku` would take a bare root address from
     *      the application, and nobody holds its twin. A twin that IS its own
     *      target (`/legal/terms`, served identically in both trees) is the
     *      live page and is skipped.
     *  (b) The root tree under `ROOT_LOCALE_LEGACY_ALIAS`: `/ru` + every
     *      root-locale page (and a hub's bare `/ru/<segment>`), and `/ru` +
     *      every recorded root-tree source outside `/docs`. The application's
     *      blind strip made these two hops or a 404.
     *  (c) `<dir>index` for every directory-shaped source except `/docs/`: the
     *      file name VitePress wrote the directory to, which the old container
     *      answered as a duplicate (`/docs/ru/faq/index`, GSC 404). The live
     *      hubs' own file names are emitted by gen-nginx-redirects.mjs.
     *
     * Fails closed: a spelling that is a live page, or that already redirects
     * somewhere else, throws. A derived rule never silently wins over data.
     */
    const legacySpellings = (recorded: Readonly<Record<string, string>>): Record<string, string> => {
        const live = new Map<string, string>()
        for (const entry of PAGES) {
            for (const language of localesOf(entry)) live.set(pagePath(entry, language)!, `${entry.id} [${language}]`)
        }
        const derived: Record<string, string> = {}
        const add = (from: string, to: string, rule: string) => {
            if (live.has(from)) {
                throw new Error(`registry: ${rule} spelling ${from} -> ${to} would shadow the live page ${live.get(from)}`)
            }
            const known = recorded[from] ?? derived[from]
            if (known !== undefined && known !== to) {
                throw new Error(`registry: ${rule} spelling ${from} -> ${to}, but ${from} already redirects to ${known}`)
            }
            if (recorded[from] === undefined) derived[from] = to
        }

        // (a) Base-less twins of the retired /docs tree.
        for (const [from, to] of Object.entries(recorded)) {
            if (!from.startsWith(`${RETIRED_DOCS_BASE}/`)) continue
            const rest = from.slice(RETIRED_DOCS_BASE.length)
            if (!rest.slice(1).includes('/') || FILE_ADDRESS.test(rest)) continue
            // `/docs/ru/` -> `/ru/` is the alias root, which the application owns.
            if (rest === `${ROOT_LOCALE_LEGACY_ALIAS}/` || rest === to) continue
            add(rest, to, 'base-less')
        }

        // (b) The root tree under its legacy alias.
        const alias = ROOT_LOCALE_LEGACY_ALIAS
        for (const entry of PAGES) {
            const path = pagePath(entry, ROOT_LOCALE.language)
            if (path === null) continue
            add(`${alias}${path}`, path, 'root-alias')
            if (path.endsWith('/')) add(`${alias}${path.slice(0, -1)}`, path, 'root-alias')
        }
        for (const [from, to] of Object.entries(recorded)) {
            if (from === RETIRED_DOCS_BASE || from.startsWith(`${RETIRED_DOCS_BASE}/`)) continue
            if (from.startsWith(`${alias}/`) || retiredLocale(from) !== ROOT_LOCALE.language) continue
            add(`${alias}${from}`, to, 'root-alias')
        }

        // (c) The file name of every retired directory.
        for (const [from, to] of Object.entries({ ...recorded, ...derived })) {
            if (!from.endsWith('/') || from === `${RETIRED_DOCS_BASE}/`) continue
            add(`${from}index`, to, 'file-name')
        }
        return derived
    }

    // Built once, when the registry is created, so a colliding spelling fails the
    // import itself: no generator or gate can run on a map that would shadow a page.
    const REDIRECTS: Readonly<Record<string, string>> = (() => {
        const recorded = recordedRedirects()
        return { ...recorded, ...legacySpellings(recorded) }
    })()

    /**
     * Old address → new address, one hop each: the recorded addresses first, then
     * their derived legacy spellings. What redirects.conf, the url gates and the
     * live probes all read. A fresh copy per call, so no caller can edit the map
     * the others see.
     */
    const redirectMap = (): Record<string, string> => ({ ...REDIRECTS })

    const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)
    const LANGUAGE_SEGMENTS = new Set([ROOT_LOCALE_LEGACY_ALIAS, ...LOCALES.map((axis) => axis.prefix).filter(Boolean)])

    /**
     * Host prefixes that are NOT content hubs but still belong to this
     * container, because redirect sources live under them: the first segment
     * of every redirect source outside `/docs` and `CONTENT_SEGMENTS`, or the
     * first two for a source under a language segment (`/ru/<segment>` under
     * the root tree's legacy alias; `/ua/<segment>` and the like, should a tree
     * ever retire a whole section). A language segment alone is never claimed:
     * it is a whole application tree.
     *
     * Each one is taken away from the application by the host snippet
     * (gen-host-nginx.mjs), so it is derived from the sources that need it and
     * from nothing else: a prefix with no source would hand the application's
     * namespace to a container with nothing to say there. The container answers
     * every known spelling under it with one 301 and anything else with its
     * localized 404, the status the application gave these addresses anyway.
     */
    const LEGACY_ROUTE_PREFIXES: readonly string[] = [
        ...new Set(
            Object.keys(REDIRECTS)
                .filter(
                    (from) =>
                        !isUnder(from, RETIRED_DOCS_BASE) &&
                        !CONTENT_SEGMENTS.some((segment) => isUnder(from, `/${segment}`)),
                )
                .map((from) => {
                    const [first, second] = from.split('/').filter(Boolean)
                    if (!LANGUAGE_SEGMENTS.has(`/${first}`)) return `/${first}`
                    if (!second) throw new Error(`registry: ${from} would claim the whole /${first} tree`)
                    return `/${first}/${second}`
                }),
        ),
    ].sort()

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
     * A link into the application under a tree the application does not have
     * (`/ar/tasks`) goes to the application tree that reader is sent to
     * (`appLinkTarget`) — the same rule as every product button of the page.
     *
     * A link that matches no live page AND no known hub is left exactly as written,
     * so VitePress's dead-link check still fails on a genuine typo. That is the line
     * between "not translated yet" and "wrong".
     */
    const resolveLocalizedLink = (href: string): string => {
        if (!href.startsWith('/')) return href

        const app = appLinkTarget(href)
        if (app !== null) return app

        const clean = href.replace(/#.*$/, '')
        const anchor = href.slice(clean.length)

        const live = PAGES.some((entry) =>
            LOCALES.some((locale) => entry.slugs[locale.language] !== undefined && pagePath(entry, locale.language) === clean)
        )
        if (live) return href

        const locale = LOCALES.find((l) => l.prefix && clean.startsWith(`${l.prefix}/`))
        if (!locale) return href

        const segment = clean.slice(locale.prefix.length + 1).split('/')[0]
        const hubId = (Object.keys(HUBS) as HubId[]).find((id) => HUBS[id][locale.language] === segment)
        if (!hubId) return href

        const hubPath = hubIndexPath(hubId, locale.language)
        return hubPath ? `${hubPath}${anchor}` : href
    }

    return {
        LOCALES,
        ROOT_LOCALE,
        ORIGIN,
        HUBS,
        CONTENT_MANIFEST_SCHEMA_VERSION,
        PAGES,
        APP_ROUTES,
        CONTENT_SEGMENTS,
        LEGACY_ROUTE_PREFIXES,
        localeAxis,
        localesOf,
        pagePath,
        pageUrl,
        hubIndexPath,
        xDefaultLocaleOf,
        alternateLocalesOf,
        hreflangCluster,
        sourceFile,
        missingSources,
        appLinkTarget,
        redirectTarget,
        redirectMap,
        resolveLocalizedLink,
    }
}

export type ContentRegistry = ReturnType<typeof createRegistry>

// The live registry: `docs/content-pages.json` as shipped. Every consumer of this
// module — the VitePress config, the generators, the gates — reads these.
export const {
    LOCALES,
    ROOT_LOCALE,
    ORIGIN,
    HUBS,
    CONTENT_MANIFEST_SCHEMA_VERSION,
    PAGES,
    APP_ROUTES,
    CONTENT_SEGMENTS,
    LEGACY_ROUTE_PREFIXES,
    localeAxis,
    localesOf,
    pagePath,
    pageUrl,
    hubIndexPath,
    xDefaultLocaleOf,
    alternateLocalesOf,
    hreflangCluster,
    sourceFile,
    missingSources,
    appLinkTarget,
    redirectTarget,
    redirectMap,
    resolveLocalizedLink,
} = createRegistry(contentManifest)
