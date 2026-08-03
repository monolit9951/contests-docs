import { computed, type ComputedRef } from 'vue'
import { useData } from 'vitepress'

/**
 * Replaces VitePress's own `useLangs` composable — aliased in config.ts, so both
 * `VPNavBarTranslations` (desktop) and `VPNavScreenTranslations` (mobile) get it
 * with their markup and styling untouched.
 *
 * WHY. The stock version builds the other language's address by swapping the
 * PREFIX on the current path:
 *
 *     link = `/${localeKey}` + page.relativePath (minus the current prefix)
 *
 * That is only correct while every locale serves a page under the same slug.
 * Ours do not, deliberately — a docs slug IS the query it answers, so the help
 * hub is `/pomoshch/` in Russian, `/ua/dopomoha/` in Ukrainian and `/en/help/`
 * in English. Swapping the prefix produced `/en/pomoshch/…`, which is nothing.
 *
 * Measured on prod 2026-08-03, before this existed: of the 86 addresses the
 * switcher offered across the 43 Russian pages, **79 answered 404**. The seven
 * that worked were `/legal/*` and `/brendam/`, where the slugs happen to match.
 * The hreflang tags on those same pages were correct the whole time — the
 * machines had the right addresses and the menu for humans did not.
 *
 * So the links stop being computed from the path and are read from the page,
 * where `transformPageData` has already resolved them through the registry —
 * the same source the canonical and the hreflang cluster come from. They are
 * baked into the prerendered HTML, which also matters: the crawlers that read
 * this site do not run JavaScript, and a nav full of 404s is crawl budget spent
 * on nothing.
 */

interface LocaleLink {
    readonly text: string
    readonly link: string
}

interface Langs {
    localeLinks: ComputedRef<LocaleLink[]>
    currentLang: ComputedRef<{ label: string | undefined; link: string }>
}

export function useLangs(_options: { correspondingLink?: boolean } = {}): Langs {
    const { site, localeIndex, frontmatter, hash } = useData()

    const currentLang = computed(() => ({
        label: site.value.locales[localeIndex.value]?.label,
        link:
            site.value.locales[localeIndex.value]?.link ||
            (localeIndex.value === 'root' ? '/' : `/${localeIndex.value}/`),
    }))

    const localeLinks = computed<LocaleLink[]>(() => {
        // Injected per page by transformPageData. A page lists only the locales
        // it HAS been translated into — the registry's rule — so a switcher never
        // offers a translation that does not exist. That is the same promise the
        // hreflang cluster makes, kept by the same table.
        const declared = frontmatter.value.localeLinks as LocaleLink[] | undefined
        if (declared) {
            return declared.map((locale) => ({ ...locale, link: locale.link + hash.value }))
        }

        // Fallback for a page outside the registry — 404s, and nothing else,
        // since transformPageData throws on any other unregistered page. Offer
        // the locale roots: not the same document, but never a dead address.
        return Object.entries(site.value.locales).flatMap(([key, value]) =>
            currentLang.value.label === value.label
                ? []
                : { text: value.label, link: value.link || (key === 'root' ? '/' : `/${key}/`) }
        )
    })

    return { localeLinks, currentLang }
}
