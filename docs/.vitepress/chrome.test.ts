import { describe, expect, it } from 'vitest'
import siteConfig, { themeForLocale } from './config'
import { productUrlForLocale } from './links'
import type { Locale } from './registry'

const CASES: {
  locale: Locale
  localeKey: 'root' | 'ua' | 'en'
  productUrl: string
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

it('does not keep locale-specific chrome in the global fallback theme', () => {
  expect(siteConfig.themeConfig).not.toHaveProperty('footer')
  expect(siteConfig.themeConfig).not.toHaveProperty('notFound')
  expect(siteConfig.themeConfig).not.toHaveProperty('docFooter')
  expect(siteConfig.themeConfig).not.toHaveProperty('darebayCta')
})
