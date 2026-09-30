import { describe, expect, it } from 'vitest'
import { CHROME_COPY } from './chrome'
import { DATA, sourcesOf } from './theme/landing/platforms'
import {
  COMMUNITY_PLATFORM,
  CTA_KEYS,
  DISCORD,
  FOUNDER_TELEGRAM,
  TELEGRAM,
  TELEGRAM_CHAT,
  ctaAnchor,
  ctaHref,
  isCtaKey,
  localizedSitePath,
  sitePathOf,
  sourceAnchor,
  sourceLabel,
} from './links'
import { APP_ROUTES, KNOWN_LOCALES, LOCALES, PAGES, localesOf, pagePath } from './registry'

describe('sourceAnchor: our own site versus somebody else’s', () => {
  it('keeps a citation of another site an outbound, unfollowed link in a new tab', () => {
    expect(sourceAnchor('https://whop.com/content-rewards', 'en')).toEqual({
      href: 'https://whop.com/content-rewards',
      rel: 'nofollow noopener',
      target: '_blank',
    })
    // A look-alike host is somebody else's site.
    expect(sourceAnchor('https://darebay.com.evil.example/x', 'ru').rel).toBe('nofollow noopener')
    expect(sourceAnchor('https://notdarebay.com/x', 'ru').rel).toBe('nofollow noopener')
    // A subdomain is another origin (siteHost.ts): cited like any other site, never made relative.
    expect(sourceAnchor('https://dev.darebay.com/en/', 'en')).toEqual({
      href: 'https://dev.darebay.com/en/',
      rel: 'nofollow noopener',
      target: '_blank',
    })
  })

  it('turns a darebay.com docs page into a relative link to its version in the reader’s language', () => {
    // The RU "DareBay in numbers" was cited from every EN comparison page.
    expect(sourceAnchor('https://darebay.com/o-proekte/darebay-v-tsifrakh', 'en')).toEqual({ href: '/en/about/darebay-at-a-glance' })
    expect(sourceAnchor('https://darebay.com/o-proekte/darebay-v-tsifrakh', 'ar')).toEqual({ href: '/ar/about/darebay-at-a-glance' })
    expect(sourceAnchor('https://www.darebay.com/en/help/what-commission', 'ru')).toEqual({ href: '/pomoshch/kakaya-komissiya' })
    expect(sourceAnchor('https://darebay.com/en/help/what-commission', 'uk')).toEqual({ href: '/ua/dopomoha/yaka-komisiia' })
    expect(sourceAnchor('https://darebay.com/en/help/what-commission', 'en')).toEqual({ href: '/en/help/what-commission' })
  })

  it('keeps the address as written when the page has no version in the reader’s language', () => {
    // Help "what commission" has no Arabic version: a live English page beats a guessed address.
    expect(sourceAnchor('https://darebay.com/en/help/what-commission', 'ar')).toEqual({ href: '/en/help/what-commission' })
  })

  it('re-aims an application address at the reader’s application tree and keeps it out of the docs router', () => {
    expect(sourceAnchor('https://darebay.com/en', 'ru')).toEqual({ href: '/', target: '_self' })
    expect(sourceAnchor('https://darebay.com/en', 'uk')).toEqual({ href: '/ua', target: '_self' })
    expect(sourceAnchor('https://darebay.com/en', 'ar')).toEqual({ href: '/en', target: '_self' })
    expect(sourceAnchor('https://darebay.com/tasks?type=clips', 'en')).toEqual({ href: '/en/tasks?type=clips', target: '_self' })
  })

  it('never marks one of our own addresses nofollow or opens it in a new tab', () => {
    for (const url of ['/anything/unknown', 'https://darebay.com/pl/tasks', 'https://darebay.com/o-proekte/', '//darebay.com/en/earnings/', 'HTTPS://WWW.DAREBAY.COM/en/help/what-commission', 'https://darebay.com./tasks']) {
      const anchor = sourceAnchor(url, 'en')
      expect(anchor.rel).toBeUndefined()
      expect(anchor.target).not.toBe('_blank')
      expect(anchor.href.startsWith('/')).toBe(true)
    }
    expect(sourceAnchor('https://darebay.com/o-proekte/', 'en')).toEqual({ href: '/en/about/' })
  })

  it('renders every source of the comparison data under that rule', () => {
    for (const platform of DATA.platforms) {
      for (const source of sourcesOf(platform, Object.keys(platform.fields))) {
        for (const { language } of LOCALES) {
          const anchor = sourceAnchor(source.url, language)
          const ours = sitePathOf(source.url) !== null
          expect(anchor.rel === undefined, `${source.url} on ${language}`).toBe(ours)
          if (ours) expect(anchor.href.startsWith('/'), `${source.url} on ${language}`).toBe(true)
        }
      }
    }
  })
})

describe('localizedSitePath', () => {
  it('maps every page address of the registry onto the same page in each of its languages', () => {
    for (const entry of PAGES) {
      for (const from of localesOf(entry)) {
        for (const { language } of LOCALES) {
          const written = pagePath(entry, from)!
          expect(localizedSitePath(written, language)).toEqual({ href: pagePath(entry, language) ?? written, docsPage: true })
        }
      }
    }
  })

  it('accepts a hub with or without its slash and drops a heading anchor only when the language changes', () => {
    expect(localizedSitePath('/o-proekte', 'uk')).toEqual({ href: '/ua/pro-proekt/', docsPage: true })
    expect(localizedSitePath('/en/help/what-commission#fees', 'en')).toEqual({ href: '/en/help/what-commission#fees', docsPage: true })
    expect(localizedSitePath('/en/help/what-commission#fees', 'ru')).toEqual({ href: '/pomoshch/kakaya-komissiya', docsPage: true })
  })
})

describe('sourceLabel', () => {
  it('prints what the link opens', () => {
    expect(sourceLabel('https://www.whop.com/terms', 'ru')).toBe('whop.com/terms')
    expect(sourceLabel('https://darebay.com/o-proekte/darebay-v-tsifrakh', 'en')).toBe('darebay.com/en/about/darebay-at-a-glance')
  })
})

describe('CTA keys', () => {
  it('sends every application key into the application tree the reader is sent to', () => {
    expect(ctaHref('tasks', 'ru')).toBe('https://darebay.com/tasks')
    expect(ctaHref('tasks', 'uk')).toBe('https://darebay.com/ua/tasks')
    expect(ctaHref('teams', 'ru')).toBe('https://darebay.com/earn/teams')
    expect(ctaHref('traffic', 'en')).toBe('https://darebay.com/en/earn/traffic')
    expect(ctaHref('store', 'ru')).toBe('https://darebay.com/store')
    expect(ctaHref('business', 'en')).toBe('https://darebay.com/en/for-business')
    // The application has no Arabic tree: an Arabic page's buttons open the English interface.
    expect(ctaHref('business', 'ar')).toBe('https://darebay.com/en/for-business')
  })

  it('opens the registration dialog over the task catalogue for `signup`', () => {
    expect(ctaHref('signup', 'ru')).toBe('https://darebay.com/tasks?auth=signup')
    expect(ctaHref('signup', 'en')).toBe('https://darebay.com/en/tasks?auth=signup')
    expect(ctaHref('signup', 'ar')).toBe('https://darebay.com/en/tasks?auth=signup')
  })

  it('opens the founder and the community room of the page’s language directly', () => {
    for (const language of KNOWN_LOCALES) expect(ctaHref('founder', language)).toBe(FOUNDER_TELEGRAM)
    expect(ctaHref('community', 'ru')).toBe(TELEGRAM_CHAT)
    expect(ctaHref('community', 'uk')).toBe(TELEGRAM_CHAT)
    expect(ctaHref('community', 'en')).toBe(DISCORD)
    expect(ctaHref('community', 'ar')).toBe(DISCORD)
    // The chat, not the one-way channel; the room itself, not `/community?src=…`, whose `src` never
    // reaches analytics.
    for (const language of KNOWN_LOCALES) {
      expect(ctaHref('community', language)).not.toBe(TELEGRAM)
      expect(ctaHref('community', language)).not.toMatch(/\/community\b/)
    }
  })

  it('names the community platform each language declares in its chrome copy', () => {
    for (const language of KNOWN_LOCALES) expect(COMMUNITY_PLATFORM[language], language).toBe(CHROME_COPY[language].community.platform)
  })

  it('keeps a product button in the same tab and opens a room in a new one, never unfollowed', () => {
    for (const language of KNOWN_LOCALES) {
      for (const key of CTA_KEYS) {
        const anchor = ctaAnchor(key, language)
        expect(anchor.href).toBe(ctaHref(key, language))
        expect(anchor.rel ?? '').not.toContain('nofollow')
        expect(anchor.target).toBe(key === 'founder' || key === 'community' ? '_blank' : '_self')
      }
    }
  })

  it('lands every application key on a route the dead-link checks know, and carries no UTM', () => {
    const routes = new Set(APP_ROUTES)
    for (const language of KNOWN_LOCALES) {
      for (const key of CTA_KEYS) {
        const url = new URL(ctaHref(key, language))
        expect(url.search, key).not.toMatch(/utm_/)
        if (url.hostname !== 'darebay.com') continue
        // VitePress and check-registry both judge the path without its query.
        expect(routes.has(url.pathname), `${key} on ${language}: ${url.pathname}`).toBe(true)
      }
    }
  })

  it('accepts exactly the closed key set', () => {
    for (const key of CTA_KEYS) expect(isCtaKey(key)).toBe(true)
    for (const value of ['clips', 'home', '', undefined, null, 1, '/tasks']) expect(isCtaKey(value)).toBe(false)
  })
})
