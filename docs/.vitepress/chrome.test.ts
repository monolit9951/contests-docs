import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import liveManifest from '../content-pages.json' with { type: 'json' }
import siteConfig, { HUB_TITLES, NAV_HUBS, navSections, themeForLocale } from './config'
import { productUrlForLocale } from './links'
import { HUBS, LOCALES, PAGES, createRegistry, hubIndexPath, localeAxis, pagePath, sourceFile, type Locale } from './registry'

const CASES: {
  locale: Locale
  localeKey: 'root' | 'ua' | 'en'
  productUrl: string
  tasksUrl: string
  authorName: string
  authorPath: string
  docsHome: string
  outline: string
  previous: string
  next: string
  notFound: string
  ctaTitle: string
}[] = [
  {
    locale: 'ru',
    localeKey: 'root',
    productUrl: 'https://darebay.com/',
    tasksUrl: 'https://darebay.com/tasks',
    authorName: 'Руслан',
    authorPath: '/o-proekte/kto-pishet-i-otkuda-tsifry',
    docsHome: '/zarabotok/',
    outline: 'На этой странице',
    previous: 'Предыдущая страница',
    next: 'Следующая страница',
    notFound: 'Страница не найдена',
    ctaTitle: 'Открыть DareBay',
  },
  {
    locale: 'uk',
    localeKey: 'ua',
    productUrl: 'https://darebay.com/ua',
    tasksUrl: 'https://darebay.com/ua/tasks',
    authorName: 'Руслан',
    authorPath: '/ua/pro-proekt/khto-pyshe-i-zvidky-tsyfry',
    docsHome: '/ua/zarobitok/',
    outline: 'На цій сторінці',
    previous: 'Попередня сторінка',
    next: 'Наступна сторінка',
    notFound: 'Сторінку не знайдено',
    ctaTitle: 'Відкрити DareBay',
  },
  {
    locale: 'en',
    localeKey: 'en',
    productUrl: 'https://darebay.com/en',
    tasksUrl: 'https://darebay.com/en/tasks',
    authorName: 'Ruslan',
    authorPath: '/en/about/who-writes-darebay-guides',
    docsHome: '/en/earnings/',
    outline: 'On this page',
    previous: 'Previous page',
    next: 'Next page',
    notFound: 'Page not found',
    ctaTitle: 'Open DareBay',
  },
]

describe.each(CASES)('$locale shared chrome', (expected) => {
  const theme = themeForLocale(expected.locale)

  it('keeps product exits in the current locale', () => {
    expect(productUrlForLocale(expected.locale)).toBe(expected.productUrl)
    expect(theme.nav?.at(-1)).toMatchObject({ link: expected.productUrl })
    expect(theme.footer?.message).toContain(`href="${expected.productUrl}"`)
    expect(theme.darebayCta.productUrl).toBe(expected.productUrl)
    expect(theme.darebayCta.tasksUrl).toBe(expected.tasksUrl)
    expect(theme.authorLink).toEqual({ name: expected.authorName, path: expected.authorPath })
  })

  it('uses native locale theme config for the logo and visible labels', () => {
    expect(theme.logoLink).toBe(expected.docsHome)
    expect(theme.outline).toMatchObject({ label: expected.outline })
    expect(theme.docFooter).toEqual({ prev: expected.previous, next: expected.next })
    expect(theme.notFound?.title).toBe(expected.notFound)
    expect(theme.darebayCta.title).toBe(expected.ctaTitle)

    const configured = siteConfig.locales?.[expected.localeKey]?.themeConfig
    expect(configured).toEqual(theme)
  })
})

// The header and the footer print `nav.slice(0, -1)` as section links and `nav.at(-1)` as the
// product button (LandingHeader.vue, LandingFooter.vue). The rule "a section is offered only where
// its index page exists" is held here, for every declared tree: an Arabic header linking
// `/ar/about/`, a section that has a fact card and no index there, would be a 404 on every Arabic
// page. `url-gates.mjs` gate `10-sections` probes the same links in the shipped markup.
describe('header and footer sections', () => {
  const declared = LOCALES.map((axis) => axis.language)
  const sectionsOf = (language: Locale) => (themeForLocale(language).nav ?? []).slice(0, -1) as { text: string; link: string }[]

  it('offers earnings, brands, help and about, in that order', () => {
    expect(NAV_HUBS).toEqual(['earnings', 'brands', 'help', 'about'])
  })

  it.each(declared)('%s: every offered section is an index page that exists, under its own title', (language) => {
    const expected = NAV_HUBS.filter((hub) => hubIndexPath(hub, language)).map((hub) => ({
      text: HUB_TITLES[language][hub],
      link: hubIndexPath(hub, language),
    }))
    expect(sectionsOf(language)).toEqual(expected)
    for (const { link } of sectionsOf(language)) {
      const index = PAGES.find((page) => pagePath(page, language) === link)
      expect(index, link).toBeDefined()
      expect(existsSync(new URL(`../${sourceFile(index!, language)}`, import.meta.url)), link).toBe(true)
    }
  })

  it.each(declared)('%s: no link to the root of a section that has no index there', (language) => {
    const links = sectionsOf(language).map((item) => item.link)
    for (const hub of NAV_HUBS) {
      if (hubIndexPath(hub, language)) continue
      expect(links, `${language}/${hub}`).not.toContain(`${localeAxis(language).prefix}/${HUBS[hub][language]}/`)
    }
  })

  it.each(declared)('%s: the product button stays last, after every section', (language) => {
    const nav = themeForLocale(language).nav ?? []
    expect(nav).toHaveLength(sectionsOf(language).length + 1)
    expect(nav.at(-1)).toMatchObject({ link: productUrlForLocale(language) })
    expect(sectionsOf(language).map((item) => item.link)).not.toContain(productUrlForLocale(language))
  })

  it('closes the Russian, Ukrainian and English lists with "About"', () => {
    expect(sectionsOf('ru').at(-1)).toEqual({ text: 'О проекте', link: '/o-proekte/' })
    expect(sectionsOf('uk').at(-1)).toEqual({ text: 'Про проєкт', link: '/ua/pro-proekt/' })
    expect(sectionsOf('en').at(-1)).toEqual({ text: 'About', link: '/en/about/' })
  })

  // The Arabic shape of 2026-09-20, rebuilt on an in-memory manifest so the case outlives the day
  // the live tree changes: a fact card under About, and no About index. Axes, segments and entries
  // are read from the live manifest, so the fixture cannot drift from production topology.
  describe('a tree with pages under About and no About index', () => {
    const arabicHubs = Object.fromEntries(
      Object.entries(liveManifest.hubs).map(([hub, segments]) => [hub, { ...segments, ar: (segments as Record<string, string>).en }]),
    )
    const manifestWith = (aboutIndexInArabic: boolean) => ({
      ...liveManifest,
      locales: { ...liveManifest.locales, ar: { prefix: '/ar', vitepressKey: 'ar' } },
      hubs: arabicHubs,
      pages: liveManifest.pages.map((page) => {
        const { ar: _arabic, ...slugs } = page.slugs as Record<string, string>
        if (page.id === 'earnings-hub') return { ...page, slugs: { ...slugs, ar: '' } }
        if (page.id === 'darebay-at-a-glance') return { ...page, slugs: { ...slugs, ar: slugs.en } }
        if (page.id === 'about-hub' && aboutIndexInArabic) return { ...page, slugs: { ...slugs, ar: '' } }
        return { ...page, slugs }
      }),
    })

    it('gets no "About" link, while the trees that have the index keep theirs', () => {
      const registry = createRegistry(manifestWith(false))
      expect(registry.PAGES.some((page) => page.hub === 'about' && page.slugs.ar !== undefined)).toBe(true)
      expect(registry.hubIndexPath('about', 'ar')).toBeNull()
      expect(navSections('ar', registry.hubIndexPath)).toEqual([{ text: HUB_TITLES.ar.earnings, link: '/ar/earnings/' }])
      expect(navSections('en', registry.hubIndexPath).at(-1)).toEqual({ text: 'About', link: '/en/about/' })
    })

    it('gets the link the day its About index is declared, with no code change', () => {
      const registry = createRegistry(manifestWith(true))
      expect(navSections('ar', registry.hubIndexPath)).toEqual([
        { text: HUB_TITLES.ar.earnings, link: '/ar/earnings/' },
        { text: HUB_TITLES.ar.about, link: '/ar/about/' },
      ])
    })
  })
})

it('does not keep locale-specific chrome in the global fallback theme', () => {
  expect(siteConfig.themeConfig).not.toHaveProperty('footer')
  expect(siteConfig.themeConfig).not.toHaveProperty('notFound')
  expect(siteConfig.themeConfig).not.toHaveProperty('docFooter')
  expect(siteConfig.themeConfig).not.toHaveProperty('darebayCta')
})
