import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lintText } from '../../scripts/product-truth-lint.mjs'
import { ctaAnchor } from './links'
import { ART } from './theme/landing/art'
import {
  PAY_CLASSES,
  PRICE_BADGE_MAX,
  TOOL_LOCALES,
  formatToolDate,
  isPageIn,
  keepFigures,
  monogram,
  toolLocales,
  toolsView,
  validateToolsCatalog,
  type ToolEntry,
  type ToolsCatalog,
} from './tools'

const FILE = new URL('./data/tools.json', import.meta.url)
const raw = readFileSync(FILE, 'utf8')
const catalog = JSON.parse(raw) as ToolsCatalog

/** Every string a card can print, in one language. */
const printed = (tool: ToolEntry, locale: 'ru' | 'en') =>
  [tool.displayName?.[locale] ?? tool.name, tool.whatFor[locale], tool.priceFrom[locale], tool.priceBadge?.[locale], tool.freeTier?.[locale], tool.availability[locale]].filter(
    (value): value is string => typeof value === 'string',
  )

describe('data/tools.json', () => {
  it('is a sound catalogue', () => {
    expect(validateToolsCatalog(catalog)).toEqual([])
  })

  it('lists every tool in a known stage, DareBay’s own ones as live only', () => {
    const categories = new Set(catalog.categories.map((category) => category.id))
    for (const tool of catalog.tools) {
      if (tool.category !== null) expect(categories.has(tool.category), tool.id).toBe(true)
      if (tool.darebay.own) expect(tool.darebay.status, tool.id).toBe('live')
    }
  })

  // The corpus's Russian rules (BRIEF §3): no dashes as punctuation, the corpus's words for the job,
  // nothing promised for later, nothing about getting around a platform's checks.
  it('writes its Russian the way the corpus does', () => {
    for (const tool of catalog.tools) {
      if (!toolLocales(tool).includes('ru')) continue
      for (const text of printed(tool, 'ru')) {
        expect(text, tool.id).not.toMatch(/[—–]/)
        // Whole words where a longer word shares the stem ("скорость", "криптовалюта" are fine).
        expect(text, tool.id).not.toMatch(/клиппер|бриф|(?<!\p{L})крипт[аеуы]?(?:ой)?(?!\p{L})|(?<!\p{L})скоро(?!\p{L})|в планах|обход/iu)
      }
    }
    for (const category of catalog.categories) expect(`${category.label.ru} ${category.lede?.ru ?? ''}`).not.toMatch(/[—–]/)
  })

  it('makes no product claim the truth lint refuses, in any language', () => {
    const truth = JSON.parse(readFileSync(new URL('../../data/product-truth.json', import.meta.url), 'utf8'))
    for (const locale of TOOL_LOCALES) {
      const text = catalog.tools.filter((tool) => toolLocales(tool).includes(locale)).flatMap((tool) => printed(tool, locale)).join('\n')
      expect(lintText(text, `docs/.vitepress/data/tools.json (${locale})`, truth, { keys: new Set(), snapshotDate: null })).toEqual([])
    }
  })

  it('dates every price and cites the service’s own page for it', () => {
    for (const tool of catalog.tools) {
      expect(tool.priceCheckedAt, tool.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(tool.source.date, tool.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // The service's own page: validateToolsCatalog holds the host (or a named publisher, `owner`).
      if (!tool.darebay.own) expect(new URL(tool.source.url).hostname, tool.id).not.toMatch(/darebay\.com$/)
    }
  })
})

describe('validateToolsCatalog', () => {
  const tool = (patch: Record<string, unknown>) => ({ ...catalog, tools: [{ ...catalog.tools[0], ...patch }] })
  const own = catalog.tools.find((entry) => entry.darebay.own)!

  it('refuses what would print wrong or leak', () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ surprise: 1 }, /unknown key "surprise"/],
      [{ category: 'nope' }, /"nope" is not a category/],
      [{ category: null }, /only a DareBay tool may stand outside/],
      [{ url: 'http://example.com/' }, /https/],
      [{ url: 'https://darebay.com/store' }, /opens its own site, not darebay\.com/],
      [{ locales: ['ru', 'de'] }, /subset/],
      [{ whatFor: { ru: 'x' } }, /whatFor\.en/],
      [{ priceFrom: { ru: ' x', en: 'y' } }, /priceFrom\.ru/],
      [{ priceCheckedAt: '29.09.2026' }, /priceCheckedAt/],
      [{ review: { en: '/tools/x' } }, /review\.en/],
      [{ review: { ru: '/en/tools/x' } }, /review\.ru/],
      [{ source: { url: 'https://x.example/', date: 'today' } }, /source/],
      [{ source: { url: 'https://reviews.example/capcut', date: '2026-09-29' } }, /the price is read on reviews\.example, not on the tool's own site/],
      [{ source: { url: 'https://darebay.com/instrumenty/', date: '2026-09-29' } }, /not on darebay\.com/],
      [{ source: { url: 'https://www.capcut.com/help/x', date: '2026-09-29', note: 'x' } }, /source: unknown key "note"/],
      [{ darebay: { own: false, status: 'live' } }, /a third-party tool is \{ own: false \} only/],
      [{ mono: 'ABCD' }, /mono/],
      [{ icon: 'video' }, /icon: only a DareBay tool draws an icon/],
      [{ priceBadge: { ru: 'от 790 ₽ в месяц за тариф Лайт', en: '$8/mo' } }, new RegExp(`priceBadge\\.ru: \\d+ characters, a badge holds at most ${PRICE_BADGE_MAX}`)],
      [{ priceBadge: { ru: 'от 790 ₽/мес' } }, /priceBadge\.en: expected a trimmed, non-empty string/],
      [{ pay: { ru: 'card', en: 'free' } }, /pay\.ru: expected one of rub, foreign-card, free, unavailable, app-store/],
      [{ pay: { ru: 'rub' } }, /pay\.en: expected one of/],
      [{ pay: { ru: 'rub', en: 'free', uk: 'free' } }, /pay: unknown language "uk"/],
    ]
    for (const [patch, message] of cases) expect(validateToolsCatalog(tool(patch)).join('\n'), JSON.stringify(patch)).toMatch(message)
  })

  it('takes a price from another host only with its publisher named', () => {
    const listing = { url: 'https://apps.apple.com/us/app/capcut/id1500855883', date: '2026-09-29' }
    expect(validateToolsCatalog(tool({ source: listing })).join('\n')).toMatch(/apps\.apple\.com, not on the tool's own site/)
    expect(validateToolsCatalog(tool({ source: { ...listing, owner: 'App Store listing by the developer' } }))).toEqual([])
    expect(validateToolsCatalog(tool({ source: { url: 'https://capcut.com/pricing', date: '2026-09-29' } }))).toEqual([])
  })

  it('lists a DareBay tool only as live, and only on darebay.com', () => {
    const with_ = (patch: Record<string, unknown>) => ({ ...catalog, tools: [{ ...own, ...patch }] })
    expect(validateToolsCatalog(with_({ darebay: { own: true, status: 'soon' } })).join('\n')).toMatch(/only when it is "live"/)
    expect(validateToolsCatalog(with_({ darebay: { own: true, status: 'live', to: 'home' } })).join('\n')).toMatch(/not a CTA key/)
    expect(validateToolsCatalog(with_({ url: 'https://example.com/' })).join('\n')).toMatch(/opens a darebay\.com address/)
    expect(validateToolsCatalog(with_({ category: null }))).toEqual([])
    expect(validateToolsCatalog(with_({ icon: 'rocket' })).join('\n')).toMatch(/icon: "rocket" is not an icon/)
    expect(validateToolsCatalog(with_({ icon: 'video' }))).toEqual([])
  })

  it('takes a short price for the badge and a payment class, in every language the tool is listed in', () => {
    const capcut = catalog.tools.find((entry) => entry.id === 'capcut')!
    const patched = { ...catalog, tools: [{ ...capcut, priceBadge: { ru: 'Цена в приложении', en: 'Price in the app' }, pay: { ru: 'app-store', en: 'app-store' } }] }
    expect(validateToolsCatalog(patched)).toEqual([])
    expect(PAY_CLASSES).toEqual(['rub', 'foreign-card', 'free', 'unavailable', 'app-store'])
  })

  it('holds a stage back only with the decision it waits for', () => {
    const held = (hold: unknown) => ({ ...catalog, categories: catalog.categories.map((category, index) => (index ? category : { ...category, hold })) })
    expect(validateToolsCatalog(held(' ')).join('\n')).toMatch(/categories\[0\]\.hold: expected the decision/)
    expect(validateToolsCatalog(held(3)).join('\n')).toMatch(/categories\[0\]\.hold: expected the decision/)
    expect(validateToolsCatalog(held('F1: founder decision pending'))).toEqual([])
  })

  it('refuses a malformed file outright', () => {
    expect(validateToolsCatalog(null)).toEqual(['tools.json: not an object'])
    expect(validateToolsCatalog({ checkedAt: '2026-09-29', categories: [], tools: [] }).join('\n')).toMatch(/categories: expected a non-empty list[\s\S]*tools: expected a non-empty list/)
  })
})

describe('toolsView', () => {
  const view = toolsView(catalog, () => true)

  // Held to what the file says rather than to a list of words: a card may name PayPal as the way a
  // tool takes payment (Vizard does), while a partner programme's terms never reach a page. Its
  // address is left out of the comparison: a programme may live on the tool's own site.
  it('never ships the partner programmes or the field-level sources', () => {
    const shipped = JSON.stringify(view)
    expect(shipped).not.toMatch(/"(affiliate|sources)"/)
    const terms = catalog.tools.flatMap((tool) => Object.values((tool.affiliate ?? {}) as Record<string, unknown>))
      .filter((value): value is string => typeof value === 'string' && value.length > 12 && !/^https:\/\//.test(value))
    expect(terms.length).toBeGreaterThan(0)
    for (const value of terms) expect(shipped, value).not.toContain(JSON.stringify(value).slice(1, -1))
  })

  it('lists DareBay’s own tools in their own group and nowhere else', () => {
    for (const locale of TOOL_LOCALES) {
      const cards = view[locale]!
      expect(cards.own.length).toBeGreaterThan(0)
      for (const card of cards.own) expect(card.own).toBe(true)
      for (const group of cards.groups) for (const card of group.tools) expect(card.own, card.id).toBe(false)
    }
  })

  it('keeps the stages in their order and sorts each A to Z in the reader’s language', () => {
    for (const locale of TOOL_LOCALES) {
      const groups = view[locale]!.groups
      const order = catalog.categories.map((category) => category.id)
      expect(groups.map((group) => order.indexOf(group.id))).toEqual([...groups.map((group) => order.indexOf(group.id))].sort((a, b) => a - b))
      for (const group of groups) {
        const names = group.tools.map((card) => card.name)
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, locale)))
        expect(group.tools.length).toBeGreaterThan(0)
      }
    }
  })

  // A held stage (the data holds multi-account tools back until the founder decides, F1) keeps its
  // cards in the file and off every page: no group, no card, DareBay's own included.
  it('shows nothing of a held stage', () => {
    const synthetic = { ...catalog, categories: catalog.categories.map((category) => (category.id === 'editing' ? { ...category, hold: 'test' } : category)) }
    for (const data of [catalog, synthetic]) {
      const held = new Set(data.categories.filter((category) => category.hold !== undefined).map((category) => category.id))
      const heldTools = new Set(data.tools.filter((tool) => tool.category !== null && held.has(tool.category)).map((tool) => tool.id))
      const shown = toolsView(data, () => true)
      for (const locale of TOOL_LOCALES) {
        expect(shown[locale]!.groups.filter((group) => held.has(group.id))).toEqual([])
        for (const card of [...shown[locale]!.own, ...shown[locale]!.groups.flatMap((group) => group.tools)]) expect(heldTools.has(card.id), card.id).toBe(false)
      }
    }
  })

  it('shows a tool only in the catalogues it is listed in', () => {
    const ruOnly = catalog.tools.filter((tool) => toolLocales(tool).length === 1 && toolLocales(tool)[0] === 'ru')
    expect(ruOnly.length).toBeGreaterThan(0)
    const enIds = new Set([...view.en!.own, ...view.en!.groups.flatMap((group) => group.tools)].map((card) => card.id))
    for (const tool of ruOnly) expect(enIds.has(tool.id), tool.id).toBe(false)
  })

  it('links a third-party site unfollowed in a new tab, and a DareBay tool into the product', () => {
    for (const locale of TOOL_LOCALES) {
      const cards = view[locale]!
      for (const card of cards.groups.flatMap((group) => group.tools)) {
        expect(card.site, card.id).toMatchObject({ rel: 'nofollow noopener', target: '_blank' })
        expect(card.asOf?.href, card.id).toMatch(/^https:\/\//)
      }
      for (const card of cards.own) {
        expect(card.site.rel).toBeUndefined()
        expect(card.asOf).toBeUndefined()
      }
    }
    const uniqualizer = view.ru!.own.find((card) => card.id === 'darebay-uniqualizer')!
    expect(uniqualizer.site).toEqual(ctaAnchor('signup', 'ru'))
    expect(uniqualizer.to).toBe('signup')
    expect(uniqualizer.mono).toBe('D')
    expect(uniqualizer.stage).toBe('Уникализация')
  })

  // Six of our own tools used to read as six identical «D» badges (review 2026-09-30): each draws
  // its own line icon, from the tiles' set; a third-party card keeps its letters and draws nothing.
  it('draws an icon on each of DareBay’s own cards and on no other', () => {
    for (const locale of TOOL_LOCALES) {
      const cards = view[locale]!
      for (const card of cards.own) expect(card.icon, card.id).toMatch(/^<svg viewBox="0 0 24 24"/)
      for (const card of cards.groups.flatMap((group) => group.tools)) expect(card.icon, card.id).toBeUndefined()
    }
    expect(view.ru!.own.find((card) => card.id === 'darebay-uniqualizer')!.icon).toBe(ART['i-copies'])
    expect(new Set(view.ru!.own.map((card) => card.icon)).size).toBe(view.ru!.own.length)
  })

  it('carries a short price and a payment class onto the card only when the data has them', () => {
    const capcut = catalog.tools.find((entry) => entry.id === 'capcut')!
    const patched = { ...catalog, tools: catalog.tools.map((entry) => (entry === capcut ? { ...capcut, priceBadge: { ru: 'от 1 090 ₽/мес', en: '$9.99/mo' }, pay: { ru: 'app-store' as const, en: 'foreign-card' as const } } : entry)) }
    const card = (data: ToolsCatalog, locale: 'ru' | 'en') => toolsView(data, () => true)[locale]!.groups.flatMap((group) => group.tools).find((entry) => entry.id === 'capcut')!
    expect(card(patched, 'ru')).toMatchObject({ badge: keepFigures('от 1 090 ₽/мес'), pay: 'app-store', price: keepFigures(capcut.priceFrom.ru!) })
    expect(card(patched, 'en')).toMatchObject({ badge: '$9.99/mo', pay: 'foreign-card' })
    // The same card with neither field: no badge, no payment label. Built from the entry rather than
    // read off the file, which gives most cards a badge.
    const bare = Object.fromEntries(Object.entries(capcut).filter(([key]) => key !== 'priceBadge' && key !== 'pay')) as unknown as ToolEntry
    const without = { ...catalog, tools: catalog.tools.map((entry) => (entry === capcut ? bare : entry)) }
    expect(card(without, 'ru')).not.toHaveProperty('badge')
    expect(card(without, 'ru')).not.toHaveProperty('pay')
  })

  it('links our review only once that page exists in the reader’s language', () => {
    const none = toolsView(catalog, () => false)
    for (const locale of TOOL_LOCALES) {
      for (const card of [...none[locale]!.own, ...none[locale]!.groups.flatMap((group) => group.tools)]) expect(card.review, card.id).toBeUndefined()
    }
    const capcut = view.en!.groups.flatMap((group) => group.tools).find((card) => card.id === 'capcut')!
    expect(capcut.review).toBe('/en/tools/capcut-alternatives')
    expect(isPageIn('/zarabotok/kalkulyator-zarabotka-na-narezkah', 'ru')).toBe(true)
    expect(isPageIn('/zarabotok/kalkulyator-zarabotka-na-narezkah', 'en')).toBe(false)
    expect(isPageIn('/instrumenty/no-such-review', 'ru')).toBe(false)
  })

  it('keeps a price’s figure and unit on one line, and dates it the way the language writes dates', () => {
    expect(keepFigures('от 2 270 ₽ в месяц, помесячно 3 490 ₽')).toBe('от 2 270 ₽ в месяц, помесячно 3 490 ₽')
    expect(keepFigures('вывод от 10 USDT, 20 аккаунтов')).toBe('вывод от 10 USDT, 20 аккаунтов')
    expect(formatToolDate('2026-09-29', 'ru')).toBe('29.09.2026')
    expect(formatToolDate('2026-09-29', 'en')).toBe('September 29, 2026')
  })
})

describe('monogram', () => {
  it('reads a name as its badge letters', () => {
    expect(monogram('CapCut')).toBe('CC')
    expect(monogram('OpusClip')).toBe('OC')
    expect(monogram('Reels Boss')).toBe('RB')
    expect(monogram('Рилс Босс')).toBe('РБ')
    expect(monogram('VN')).toBe('VN')
    expect(monogram('Klap')).toBe('K')
    expect(monogram('Dolphin{anty}')).toBe('DA')
    expect(monogram('  ')).toBe('?')
  })
})
