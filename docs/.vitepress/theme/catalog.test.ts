import { describe, expect, it } from 'vitest'
import hubLoader from '../hubs.data'
import { HUBS, KNOWN_LOCALES, LOCALES, PAGES, pagePath, type HubId } from '../registry'
import { CATALOG_COPY, TOPICS, TOPIC_LABELS, featuredPages, filterCatalog, groupCatalog, rankedRelated, topicFor } from './catalog'

const hubs = hubLoader.load()

describe('registry-backed hub catalogs', () => {
  for (const hub of Object.keys(HUBS) as HubId[]) {
    for (const { language } of LOCALES) {
      it(`${hub}/${language} contains exactly its declared leaf pages in the initial SSR state`, () => {
        const declared = PAGES.filter((page) => page.hub === hub && page.slugs[language] !== undefined && page.slugs[language] !== '')
        const pages = hubs[hub][language]
        const initial = groupCatalog(filterCatalog(pages))
        const rendered = initial.flatMap((group) => group.pages)
        expect(rendered.map((page) => page.id).sort()).toEqual(declared.map((page) => page.id).sort())
        expect(new Set(rendered.map((page) => page.path)).size).toBe(declared.length)
        for (const page of declared) expect(rendered.find((item) => item.id === page.id)?.path).toBe(pagePath(page, language))
        for (const page of rendered) {
          expect(page.title.trim()).not.toBe('')
          expect(page.description.trim()).not.toBe('')
        }
      })
    }
  }

  it('rebuilds after a manifest change as well as a content edit', () => {
    expect(hubLoader.watch).toContain('../content-pages.json')
    expect(hubLoader.watch).toContain('../**/*.md')
  })

  it('features actual localized routes only when the complete route exists', () => {
    for (const { language } of LOCALES) {
      const pages = hubs.earnings[language]
      for (const route of featuredPages(pages)) expect(pages).toContain(route.page)
    }
    expect(featuredPages(hubs.earnings.en).map((route) => route.kind)).toEqual(['start', 'calculate', 'choose'])
    expect(featuredPages(hubs.earnings.ar)).toEqual([])
    expect(featuredPages(hubs.earnings.en.filter((page) => page.id !== 'earnings-calculator'))).toEqual([])
  })
})

describe('catalog search and topics', () => {
  const pages = [
    { id: 'earnings-calculator', title: 'Расчёт дохода', description: 'Ставка и просмотры' },
    { id: 'earnings-clipper-job', title: 'Первая работа', description: 'Учимся делать короткие ролики' },
    { id: 'earnings-whop-review', title: 'Whop review', description: 'Rates, countries and payouts' },
    { id: 'clipping-platforms-egypt-mena', title: 'الأَرباح في مصر', description: 'الدفعات' },
  ]

  it('matches normalized words across title, description and the localized topic', () => {
    expect(filterCatalog(pages, 'РАСЧЕТ просмотры', 'all', 'ru').map((page) => page.id)).toEqual(['earnings-calculator'])
    expect(filterCatalog(pages, 'короткие начать', 'all', 'ru').map((page) => page.id)).toEqual(['earnings-clipper-job'])
    expect(filterCatalog(pages, 'الارباح مصر', 'all', 'ar').map((page) => page.id)).toEqual(['clipping-platforms-egypt-mena'])
    expect(filterCatalog(pages, '  whop   PAYOUTS ', 'all', 'en').map((page) => page.id)).toEqual(['earnings-whop-review'])
  })

  it('intersects topic and query, can show an empty result, and restores all results', () => {
    expect(filterCatalog(pages, '', 'platforms')).toEqual([pages[2]])
    expect(filterCatalog(pages, 'Whop', 'money')).toEqual([])
    expect(filterCatalog(pages, 'this cannot match')).toEqual([])
    expect(filterCatalog(pages, '', 'all')).toEqual(pages)
  })

  it('keeps a newly registered article discoverable before editorial classification', () => {
    const newPage = { id: 'new-article', title: 'New guide', description: 'A new subject' }
    expect(groupCatalog([newPage]).flatMap((group) => group.pages)).toEqual([newPage])
    expect(filterCatalog([newPage], 'new guide')).toEqual([newPage])
  })

  it('has complete nonempty interface copy for every supported language and topic', () => {
    expect(Object.keys(CATALOG_COPY).sort()).toEqual([...KNOWN_LOCALES].sort())
    expect(Object.keys(TOPIC_LABELS).sort()).toEqual([...KNOWN_LOCALES].sort())
    for (const language of KNOWN_LOCALES) {
      expect(Object.keys(CATALOG_COPY[language]).sort()).toEqual(Object.keys(CATALOG_COPY.en).sort())
      expect(Object.keys(TOPIC_LABELS[language]).sort()).toEqual([...TOPICS].sort())
      for (const value of [...Object.values(CATALOG_COPY[language]), ...Object.values(TOPIC_LABELS[language])]) expect(value.trim()).not.toBe('')
    }
  })
})

describe('related article relevance', () => {
  it('prefers the same subject, excludes itself and preserves canonical objects', () => {
    const pages = hubs.earnings.en
    const current = 'earnings-calculator'
    const result = rankedRelated(pages, current)
    expect(result).toHaveLength(3)
    expect(result.every((page) => topicFor(page.id) === topicFor(current))).toBe(true)
    expect(result.some((page) => page.id === current)).toBe(false)
    for (const page of result) expect(pages).toContain(page)
  })

  it('prefers semantic overlap within a topic and has a stable bounded fallback', () => {
    const pages = [{ id: 'earnings-vyro-review' }, { id: 'darebay-vs-klipni' }, { id: 'darebay-vs-whop' }, { id: 'earnings-whop-review' }]
    expect(rankedRelated(pages, 'earnings-whop-review', 1)).toEqual([pages[2]])
    expect(rankedRelated([pages[0]], 'earnings-calculator', 3)).toEqual([pages[0]])
    expect(rankedRelated(pages, 'earnings-whop-review', 0)).toEqual([])
    expect(rankedRelated([], 'earnings-calculator')).toEqual([])
  })
})
