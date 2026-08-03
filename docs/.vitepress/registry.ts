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
// So identity moves here. A page is an `id`; its address in each locale is data.
// Everything else is DERIVED from this file and never hand-written:
//
//   * the public URL of a page in any locale        (pageUrl)
//   * the hreflang cluster                          (hreflangCluster)
//   * the per-locale sitemaps
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
//     lists exactly those. This is what makes partial translation safe: content
//     is RU-only today, so no empty Ukrainian tree and no Russian text sitting
//     under a Ukrainian address can come into existence by accident.

export type Locale = 'ru' | 'uk' | 'en'

export interface LocaleAxis {
    /** i18next / hreflang / <html lang> code. */
    readonly language: Locale
    /** URL prefix WITHOUT a trailing slash. '' for the locale served at the root. */
    readonly prefix: string
    /** VitePress locale key: 'root' for the unprefixed one, else the dir name. */
    readonly vitepressKey: string
}

// `/ua` and not `/uk`: `uk` is the LANGUAGE code (ISO 639-1) and the only value
// hreflang accepts, but a Ukrainian reader parses `/uk/` as United Kingdom. The
// URL segment talks to a human, the hreflang value talks to a crawler, and they
// are allowed to disagree. This is deliberate — do not "fix" it.
export const LOCALES: readonly LocaleAxis[] = [
    { language: 'ru', prefix: '', vitepressKey: 'root' },
    { language: 'uk', prefix: '/ua', vitepressKey: 'ua' },
    { language: 'en', prefix: '/en', vitepressKey: 'en' },
]

export const ROOT_LOCALE = LOCALES[0]

export const ORIGIN = 'https://darebay.com'

/**
 * Top-level sections. The KEY is the stable id; the values are the localized
 * URL segment. A section exists only when its index page is a page that can
 * rank on its own — a directory that exists to tidy files is a level that
 * costs authority and returns nothing.
 *
 * `narezki` is deliberately ABSENT. The architecture reserves it, but shipping
 * a hub with no articles under it is the same "empty tree" mistake rule 2
 * above exists to prevent. It gets added with its first article.
 */
export const HUBS = {
    earnings: { ru: 'zarabotok', uk: 'zarobitok', en: 'earnings' },
    brands: { ru: 'brendam', uk: 'brendam', en: 'for-brands' },
    help: { ru: 'pomoshch', uk: 'dopomoha', en: 'help' },
    about: { ru: 'o-proekte', uk: 'pro-proekt', en: 'about' },
    // Legal slugs are NOT translated: these addresses are pasted into contracts
    // and email footers, and stability beats a query nobody types.
    legal: { ru: 'legal', uk: 'legal', en: 'legal' },
} as const

export type HubId = keyof typeof HUBS

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

export const PAGES: readonly RegistryEntry[] = [
    // ── Заработок ─────────────────────────────────────────────── /zarabotok/
    {
        id: 'earnings-hub',
        hub: 'earnings',
        slugs: { ru: '', uk: '', en: '' },
        retired: ['/docs/ru/zarabotok/', '/docs/ru/blog/'],
    },
    {
        id: 'earnings-from-zero',
        hub: 'earnings',
        slugs: { ru: 'kak-zarabotat-na-narezkah-s-nulya' },
        retired: ['/docs/ru/zarabotok/kak-zarabotat-na-narezkah-s-nulya'],
    },
    {
        id: 'earnings-streamer-clips',
        hub: 'earnings',
        slugs: { ru: 'kak-zarabotat-na-narezkah-strimerov' },
        retired: ['/docs/ru/zarabotok/kak-zarabotat-na-narezkah-strimerov'],
    },
    {
        id: 'earnings-clipper-job',
        hub: 'earnings',
        slugs: { ru: 'rabota-narezchikom' },
        retired: ['/docs/ru/zarabotok/rabota-narezchikom'],
    },
    {
        id: 'earnings-how-much-total',
        hub: 'earnings',
        slugs: { ru: 'skolko-mozhno-zarabotat-na-narezkah' },
        retired: ['/docs/ru/zarabotok/skolko-mozhno-zarabotat-na-narezkah'],
    },
    {
        id: 'earnings-beginner-rate',
        hub: 'earnings',
        slugs: { ru: 'skolko-platyat-novichku' },
        retired: ['/docs/ru/zarabotok/skolko-platyat-novichku'],
    },
    {
        id: 'earnings-per-1000-views',
        hub: 'earnings',
        slugs: { ru: 'skolko-platyat-za-1000-prosmotrov', uk: 'skilky-platiat-za-1000-perehliadiv', en: 'pay-per-1000-views' },
        retired: ['/docs/ru/zarabotok/skolko-platyat-za-1000-prosmotrov'],
    },
    {
        // The one page that demonstrably ranks (yandex.ru + yandex.kz, 4 of the
        // 12 external search entries in 4.5 months). Its slug is unchanged on
        // purpose — the redirect carries it, but there is no reason to reword.
        id: 'earnings-streamer-clip-rate',
        hub: 'earnings',
        slugs: { ru: 'skolko-platyat-za-narezki-strimerov' },
        retired: ['/docs/ru/zarabotok/skolko-platyat-za-narezki-strimerov'],
    },
    {
        id: 'earnings-tiktok-views',
        hub: 'earnings',
        slugs: { ru: 'skolko-platyat-za-prosmotry-v-tiktok' },
        retired: ['/docs/ru/zarabotok/skolko-platyat-za-prosmotry-v-tiktok'],
    },
    {
        id: 'earnings-without-followers',
        hub: 'earnings',
        slugs: { ru: 'zarabotok-bez-podpischikov' },
        retired: ['/docs/ru/zarabotok/zarabotok-bez-podpischikov'],
    },
    {
        // Moved out of the old `kak-rabotaet` zone: the mechanics of getting
        // paid are a creator subject, not a separate section.
        id: 'earnings-ppv-mechanics',
        hub: 'earnings',
        slugs: { ru: 'kak-rabotaet-oplata-za-prosmotry', uk: 'yak-pratsiuie-oplata-za-perehliady', en: 'how-pay-per-view-works' },
        retired: ['/docs/ru/kak-rabotaet/kak-rabotaet-oplata-za-prosmotry'],
    },
    {
        id: 'earnings-view-counting',
        hub: 'earnings',
        slugs: { ru: 'kak-schitayutsya-prosmotry-dlya-vyplaty' },
        retired: ['/docs/ru/kak-rabotaet/kak-schitayutsya-prosmotry-dlya-vyplaty'],
    },
    {
        id: 'earnings-view-threshold',
        hub: 'earnings',
        slugs: { ru: 'porog-prosmotrov-dlya-vyplaty', uk: 'porih-perehliadiv-dlia-vyplaty', en: 'view-threshold' },
        retired: ['/docs/ru/kak-rabotaet/porog-prosmotrov-dlya-vyplaty'],
    },
    {
        id: 'earnings-where-to-find-work',
        hub: 'earnings',
        slugs: { ru: 'gde-brat-zakazy-na-narezki' },
        retired: ['/docs/ru/platformy/gde-brat-zakazy-na-narezki'],
    },
    {
        // Was the index of the `platformy` zone. A comparison of platforms and
        // their fees is an article, not a section: it has one subject.
        id: 'earnings-platforms-and-fees',
        hub: 'earnings',
        slugs: { ru: 'ploshchadki-i-komissii' },
        retired: ['/docs/ru/platformy/'],
    },

    // ── Брендам ───────────────────────────────────────────────────/brendam/
    {
        // New page. The zone had no index — brand articles sat scattered across
        // `kak-rabotaet` and `platformy` with nothing tying them together.
        id: 'brands-hub',
        hub: 'brands',
        slugs: { ru: '', uk: '', en: '' },
    },
    {
        id: 'brands-pay-clippers',
        hub: 'brands',
        slugs: { ru: 'kak-platit-narezchikam-za-prosmotry' },
        retired: ['/docs/ru/kak-rabotaet/kak-platit-narezchikam-za-prosmotry'],
    },
    {
        id: 'brands-create-contest',
        hub: 'brands',
        slugs: { ru: 'kak-sozdat-konkurs-dlya-narezchikov' },
        retired: ['/docs/ru/kak-rabotaet/kak-sozdat-konkurs-dlya-narezchikov'],
    },
    {
        id: 'brands-order-clips',
        hub: 'brands',
        slugs: { ru: 'kak-zakazat-narezki-dlya-prodvizheniya' },
        retired: ['/docs/ru/platformy/kak-zakazat-narezki-dlya-prodvizheniya'],
    },

    // ── Помощь ───────────────────────────────────────────────────/pomoshch/
    {
        id: 'help-hub',
        hub: 'help',
        slugs: { ru: '', uk: '', en: '' },
        retired: ['/docs/ru/faq/', '/docs/faq/'],
    },
    {
        id: 'help-quick-start',
        hub: 'help',
        slugs: { ru: 'bystryy-start' },
        retired: ['/docs/ru/getting-started/', '/docs/getting-started/'],
    },
    {
        id: 'help-first-contest',
        hub: 'help',
        slugs: { ru: 'pervyy-konkurs' },
        retired: ['/docs/ru/getting-started/create-your-first-contest', '/docs/getting-started/create-your-first-contest'],
    },
    {
        id: 'help-prizes-and-payouts',
        hub: 'help',
        slugs: { ru: 'prizy-i-vyplaty' },
        retired: ['/docs/ru/getting-started/prizes-and-payouts', '/docs/getting-started/prizes-and-payouts'],
    },
    {
        id: 'help-submit-work',
        hub: 'help',
        slugs: { ru: 'kak-otpravit-rabotu' },
        retired: ['/docs/ru/getting-started/submit-a-work', '/docs/getting-started/submit-a-work'],
    },
    {
        id: 'help-verification',
        hub: 'help',
        slugs: { ru: 'verifikatsiya' },
        retired: ['/docs/ru/getting-started/verification-and-trust', '/docs/getting-started/verification-and-trust'],
    },
    {
        id: 'help-watch-vote-win',
        hub: 'help',
        slugs: { ru: 'smotret-golosovat-vyigrat' },
        retired: ['/docs/ru/getting-started/watch-vote-win', '/docs/getting-started/watch-vote-win'],
    },
    {
        id: 'help-choosing-winners',
        hub: 'help',
        slugs: { ru: 'kak-vybirayut-pobeditelya' },
        retired: ['/docs/ru/faq/choosing-winners', '/docs/faq/choosing-winners'],
    },
    {
        id: 'help-crypto-payment',
        hub: 'help',
        slugs: { ru: 'oplata-kriptoy' },
        retired: ['/docs/ru/faq/crypto', '/docs/faq/crypto'],
    },
    {
        // Brand-prefixed query ("darebay вывод денег"), so the brand stays in
        // the slug even though the page itself is product help.
        id: 'help-withdraw',
        hub: 'help',
        slugs: { ru: 'darebay-vyvod-deneg' },
        retired: ['/docs/ru/faq/darebay-vyvod-deneg', '/docs/faq/withdraw'],
    },
    {
        id: 'help-fake-submissions',
        hub: 'help',
        slugs: { ru: 'zashchita-ot-nakrutki' },
        retired: ['/docs/ru/faq/fake-submissions', '/docs/faq/fake-submissions'],
    },
    {
        id: 'help-illegal-content',
        hub: 'help',
        slugs: { ru: 'zapreshchennyy-kontent' },
        retired: ['/docs/ru/faq/illegal-content', '/docs/faq/illegal-content'],
    },
    {
        id: 'help-commission',
        hub: 'help',
        slugs: { ru: 'kakaya-komissiya' },
        retired: ['/docs/ru/faq/kakaya-komissiya', '/docs/faq/fees'],
    },
    {
        id: 'help-no-submissions',
        hub: 'help',
        slugs: { ru: 'esli-nikto-ne-uchastvuet' },
        retired: ['/docs/ru/faq/no-submissions', '/docs/faq/no-submissions'],
    },

    // ── О проекте ───────────────────────────────────────────────/o-proekte/
    //
    // Not an "about" page with FAQ bolted on: this is the TRUST cluster. The
    // "развод / скам / реально ли платит" queries are the highest-intent ones
    // we answer, and they belong next to who we are, not filed under help.
    {
        id: 'about-hub',
        hub: 'about',
        slugs: { ru: '', uk: '', en: '' },
        retired: ['/docs/ru/o-proekte'],
    },
    {
        // `/docs/` was NOT the "about" page — it served the Manifesto, a
        // separate 114-line brand page with its own cover. Folding the two into
        // one address would have quietly deleted one of them, so the manifesto
        // keeps a page and `/docs/` redirects to it rather than to the hub:
        // a 301 belongs on the page carrying equivalent content, and Google
        // re-derives the sitelink from there.
        id: 'about-manifesto',
        hub: 'about',
        slugs: { ru: 'manifest' },
        retired: ['/docs/', '/docs/ru/'],
    },
    {
        id: 'about-is-it-a-scam',
        hub: 'about',
        slugs: { ru: 'darebay-eto-skam' },
        retired: ['/docs/ru/faq/darebay-eto-skam'],
    },
    {
        id: 'about-reviews',
        hub: 'about',
        slugs: { ru: 'darebay-otzyvy' },
        retired: ['/docs/ru/faq/darebay-otzyvy'],
    },
    {
        id: 'about-is-it-a-fraud',
        hub: 'about',
        slugs: { ru: 'darebay-razvod-ili-net' },
        retired: ['/docs/ru/faq/darebay-razvod-ili-net'],
    },
    {
        id: 'about-really-pays',
        hub: 'about',
        slugs: { ru: 'darebay-realno-platit' },
        retired: ['/docs/ru/faq/darebay-realno-platit'],
    },
    {
        id: 'about-payout-guarantee',
        hub: 'about',
        slugs: { ru: 'garantiya-vyplat' },
        retired: ['/docs/ru/faq/garantiya-vyplat'],
    },

    // ── Правовое ─────────────────────────────────────────────────── /legal/
    {
        id: 'legal-hub',
        hub: 'legal',
        slugs: { ru: '' },
        retired: ['/docs/ru/legal/', '/docs/legal/'],
    },
    {
        id: 'legal-privacy',
        hub: 'legal',
        slugs: { ru: 'privacy' },
        retired: ['/docs/ru/legal/privacy', '/docs/legal/privacy'],
    },
    {
        id: 'legal-terms',
        hub: 'legal',
        slugs: { ru: 'terms' },
        retired: ['/docs/ru/legal/terms', '/docs/legal/terms'],
    },
]

/**
 * Retired addresses whose page did not survive the migration, mapped onto the
 * page that replaced them. Kept apart from `PAGES` because there is no entry
 * they belong to — but they must still single-hop, not 404.
 */
export const ORPHAN_REDIRECTS: Readonly<Record<string, string>> = {
    // The old `kak-rabotaet` index duplicated the app's own "how it works"
    // landing, which is translated into three languages and stays in the SPA.
    '/docs/ru/kak-rabotaet/': '/kak-eto-rabotaet',
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
export const APP_ROUTES: readonly string[] = [
    '/kak-eto-rabotaet',
    '/dlya-biznesa',
    '/magazin',
    '/lenta',
    '/reyting',
    // Same routes on the other locale trees. The application serves each under
    // its own slug — the Ukrainian "how it works" is /ua/yak-tse-pratsiuie, not
    // /ua/kak-eto-rabotaet — so they are listed per locale rather than derived
    // by gluing a prefix onto the Russian list.
    '/ua/yak-tse-pratsiuie',
    '/ua/dlia-biznesu',
    '/ua/kramnytsia',
    '/ua/strichka',
    '/ua/reitynh',
    '/en/how-it-works',
    '/en/for-business',
    '/en/store',
    '/en/feed',
    '/en/top',
]

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
export const redirectMap = (): Record<string, string> => {
    const map: Record<string, string> = { ...ORPHAN_REDIRECTS }
    for (const entry of PAGES) {
        const target = pagePath(entry, ROOT_LOCALE.language)
        if (!target) continue
        for (const old of entry.retired ?? []) map[old] = target
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
