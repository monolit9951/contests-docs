import { describe, expect, it } from 'vitest'
import { LANDING_COPY } from './copy'
import { DATA, DEFAULT_COLUMNS, REGION_FIELDS, bidiAttrs, byId, sourceIndex, sourcesOf, text, textLang } from './platforms'
import { sourceAnchor } from '../../links'
import { KNOWN_LOCALES } from '../../registry'

/**
 * One data file feeds every comparison page, so a field added for one page is a field every other
 * page's components can see. Two of them roll a platform's sources into a visible list — the
 * "Sources" line under each card (`LPlatforms`) and the numbered list in "how this comparison was
 * built" (`LMethod`) — and the table prints a superscript whose number comes from the same order.
 *
 * The eight per-country columns exist for the regional pages only. These tests are the promise
 * that adding them, and adding more of them later, leaves the twenty pages that never print a
 * country column with exactly the source list they had.
 */

// Every language the build knows, not only the live trees: a regional column shown on an Arabic
// page the day the Arabic tree is declared must already have its Arabic heading.
const LOCALES = KNOWN_LOCALES

describe('per-country columns', () => {
  it('exist on every platform, with a state, a source and English text', () => {
    for (const platform of DATA.platforms) {
      for (const key of REGION_FIELDS) {
        const field = platform.fields[key]
        expect(field, `${platform.id}.${key}`).toBeDefined()
        expect(['yes', 'no', 'partial', 'unknown'], `${platform.id}.${key}`).toContain(field.state)
        expect(field.source?.url, `${platform.id}.${key}`).toMatch(/^https:\/\//)
        expect(field.source?.date, `${platform.id}.${key}`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        // `text` falls back to English, so an English string is what every locale renders.
        expect(typeof field.text?.en, `${platform.id}.${key}`).toBe('string')
      }
    }
  })

  it('never states a country claim without the source page it came from', () => {
    for (const platform of DATA.platforms) {
      for (const key of REGION_FIELDS) {
        const field = platform.fields[key]
        if (field.text?.en) expect(field.source?.url, `${platform.id}.${key}`).toBeTruthy()
      }
    }
  })

  it('has a column label in every interface locale, so no table prints a raw key', () => {
    for (const key of REGION_FIELDS) {
      for (const locale of LOCALES) {
        expect(LANDING_COPY[locale].columns[key], `${locale}.${key}`).toBeTruthy()
      }
    }
  })

  it('is not one of the columns a page gets by default', () => {
    // A regional column is opt-in from frontmatter. If one leaked into the defaults it would
    // appear on every comparison table in the corpus.
    for (const key of REGION_FIELDS) expect(DEFAULT_COLUMNS).not.toContain(key)
  })
})

describe('source roll-up stays scoped to what a page shows', () => {
  const regionUrls = (id: string) =>
    new Set(REGION_FIELDS.map((key) => byId(id)?.fields[key]?.source?.url).filter(Boolean) as string[])

  it('leaves a per-country source out of a platform-wide list', () => {
    for (const platform of DATA.platforms) {
      const listed = new Set(sourcesOf(platform).map((s) => s.url))
      const regionOnly = [...regionUrls(platform.id)].filter(
        (url) =>
          !Object.entries(platform.fields).some(
            ([key, field]) => !REGION_FIELDS.includes(key) && field.source?.url === url
          )
      )
      for (const url of regionOnly) expect(listed, `${platform.id} ${url}`).not.toContain(url)
    }
  })

  it('adds it back for the page that renders the column', () => {
    const whop = byId('whop')!
    const url = whop.fields.nigeria.source!.url
    expect(sourcesOf(whop).map((s) => s.url)).not.toContain(url)
    expect(sourcesOf(whop, ['nigeria']).map((s) => s.url)).toContain(url)
    // And only that column's source: asking for Nigeria does not drag in the other seven.
    expect(sourcesOf(whop, ['nigeria']).length).toBe(sourcesOf(whop).length + 1)
  })

  it('never renumbers the sources an existing page already cites', () => {
    // The superscript in a table cell is this number. A regional column may only ever append.
    for (const platform of DATA.platforms) {
      const before = sourcesOf(platform).map((s) => s.url)
      const after = sourcesOf(platform, [...REGION_FIELDS]).map((s) => s.url)
      expect(after.slice(0, before.length)).toEqual(before)
      for (const url of before) {
        expect(sourceIndex(platform, url, [...REGION_FIELDS])).toBe(sourceIndex(platform, url))
      }
    }
  })

  it('keeps every card footer host list unchanged for the cards that show no country', () => {
    // `LPlatforms` dedupes sources by host and prints the first one's date. Both are derived from
    // this order, so the non-regional prefix being stable is what keeps those footers stable.
    for (const platform of DATA.platforms) {
      const hosts = (shown: string[]) => [
        ...new Set(sourcesOf(platform, shown).map((s) => new URL(s.url).hostname.replace(/^www\./, ''))),
      ]
      expect(hosts([])).toEqual(hosts(DEFAULT_COLUMNS))
    }
  })
})

describe('a page lists each address its reader opens once', () => {
  // Our own pages are cited in whichever language a number was read in, and `sourceAnchor` sends the
  // reader to their own version. So two different urls can open one address on one page: DareBay's
  // threshold cites the Russian "DareBay in numbers", its country columns cite the English version,
  // and on an English regional page both open /en/about/darebay-at-a-glance. The list printed that
  // address twice with two dates.
  const opens = (url: string, locale: (typeof LOCALES)[number]) => sourceAnchor(url, locale).href

  it('merges the Russian and English "DareBay in numbers" on an English page with a country column', () => {
    const darebay = byId('darebay')!
    const glance = sourcesOf(darebay, ['india'], 'en').filter((s) => opens(s.url, 'en') === '/en/about/darebay-at-a-glance')
    expect(glance).toHaveLength(1)
    // The entry kept is the first field's, as when two fields cite one url.
    expect(glance[0]).toEqual(darebay.fields.threshold.source)
    // Without a page language the list is still one entry per url as written.
    expect(sourcesOf(darebay, ['india']).map((s) => s.url)).toEqual(
      expect.arrayContaining(['https://darebay.com/o-proekte/darebay-v-tsifrakh', 'https://darebay.com/en/about/darebay-at-a-glance'])
    )
  })

  // What a comparison page can render: no country column, the default columns, every country.
  const VIEWS: readonly (readonly string[])[] = [[], DEFAULT_COLUMNS, [...REGION_FIELDS]]

  it('never lists one address twice, and numbers every cell by the entry that opens its address', () => {
    for (const platform of DATA.platforms) {
      for (const locale of LOCALES) {
        for (const shown of VIEWS) {
          const addresses = sourcesOf(platform, shown, locale).map((s) => opens(s.url, locale))
          expect(new Set(addresses).size, `${platform.id} on ${locale}`).toBe(addresses.length)
          for (const [key, field] of Object.entries(platform.fields)) {
            if (!field.source?.url || (REGION_FIELDS.includes(key) && !shown.includes(key))) continue
            const index = sourceIndex(platform, field.source.url, shown, locale)
            expect(addresses[index - 1], `${platform.id}.${key} on ${locale}`).toBe(opens(field.source.url, locale))
          }
        }
      }
    }
  })

  it('still only appends for a regional column, in every language', () => {
    for (const platform of DATA.platforms) {
      for (const locale of LOCALES) {
        const before = sourcesOf(platform, [], locale)
        const after = sourcesOf(platform, [...REGION_FIELDS], locale)
        expect(after.slice(0, before.length), `${platform.id} on ${locale}`).toEqual(before)
      }
    }
  })
})

describe('the platforms every regional page compares', () => {
  it('answers the country question in English for each one', () => {
    // `unknown` with no text is a real answer ("not stated"); anything else must say something.
    for (const platform of DATA.platforms) {
      for (const key of REGION_FIELDS) {
        const field = platform.fields[key]
        if (field.state !== 'unknown') expect(text(platform, key, 'en'), `${platform.id}.${key}`).not.toBe('')
      }
    }
  })

  it('never claims DareBay pays somewhere without the worldwide statement behind it', () => {
    // DareBay excludes no country, so every regional cell says so and cites a darebay.com page.
    // Until 2026-09-18 every cell was also required to read plain "yes". That stopped being true
    // for regions whose regulator bars or criminalizes dealing in crypto (Egypt, Algeria and Iraq
    // in `mena`; Bangladesh and Nepal, whose central banks do not permit crypto transactions, in
    // `bangladesh`): DareBay's only money rail is USDT on TON, so "yes" there would contradict the
    // regional page itself. Such a cell is `partial`, and it must name the rail it is limited by.
    const darebay = byId('darebay')!
    for (const key of REGION_FIELDS) {
      const field = darebay.fields[key]
      expect(['yes', 'partial'], `darebay.${key}`).toContain(field.state)
      expect(field.text?.en).toContain('no exclusion list')
      expect(field.source?.url).toMatch(/^https:\/\/darebay\.com\//)
      if (field.state === 'partial') expect(field.text?.en, `darebay.${key}`).toContain('USDT on TON')
    }
  })
})

describe('a value shown in a page of another writing direction', () => {
  // A synthetic platform, so the rule does not depend on which languages the live data carries.
  const fixture = {
    ...byId('whop')!,
    fields: { rate: { text: { en: '$1–$2 per 1,000 views', ru: '$1–$2 за 1000 просмотров' } } },
  }

  it('falls back to English and says so', () => {
    expect(text(fixture, 'rate', 'ar')).toBe('$1–$2 per 1,000 views')
    expect(textLang(fixture, 'rate', 'ar')).toBe('en')
    expect(textLang(fixture, 'rate', 'ru')).toBe('ru')
  })

  it('is marked as a left-to-right English run inside a right-to-left page, and only there', () => {
    expect(bidiAttrs('en', 'ar')).toEqual({ lang: 'en', dir: 'ltr' })
    expect(bidiAttrs('ar', 'ar')).toEqual({})
    // Left-to-right trees keep their markup: an English fallback in a Russian table is not marked.
    expect(bidiAttrs('en', 'ru')).toEqual({})
    expect(bidiAttrs('en', 'en')).toEqual({})
  })
})
