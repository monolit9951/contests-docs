import { describe, expect, it } from 'vitest'
import hubLoader from '../hubs.data'
import { HUBS, KNOWN_LOCALES, LOCALES, PAGES, pagePath, type HubId } from '../registry'
import { CATALOG_COPY, TOPICS, TOPIC_LABELS, featuredPages, filterCatalog, groupCatalog, rankedRelated, relatedPlan, relatedScore, topicFor } from './catalog'

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

  // The old contract was "ties by hub order": among equally relevant candidates the first ones of
  // the (alphabetical) hub list won on every page, and the last ones were recommended by nobody —
  // /brendam/narezki-ili-reklama-chto-deshevle had no related link at all. Ties are now spread over
  // the whole list; relevance itself is unchanged.
  it('spreads equally relevant candidates instead of recommending the first ones everywhere', () => {
    // Eight pages of one topic sharing no id word: every candidate ties on every page.
    const pages = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].map((id) => ({ id }))
    const inbound = new Map(pages.map((page) => [page.id, 0]))
    for (const page of pages) for (const pick of rankedRelated(pages, page.id)) inbound.set(pick.id, inbound.get(pick.id)! + 1)
    // By hub order p5…p8 would get nothing and p1 seven picks.
    expect(Math.min(...inbound.values())).toBeGreaterThanOrEqual(2)
    expect(Math.max(...inbound.values())).toBeLessThanOrEqual(4)
    // Deterministic: the SSR build and the browser compute the same cards.
    expect(pages.map((page) => rankedRelated([...pages], page.id))).toEqual(pages.map((page) => rankedRelated(pages, page.id)))
  })

  it('never trades relevance for balance on the real hubs, and starves fewer pages than hub order', () => {
    const byHubOrder = <T extends { id: string }>(pages: readonly T[], currentId: string): T[] =>
      pages.filter((page) => page.id !== currentId)
        .map((page, index) => ({ page, index, score: relatedScore(currentId, page.id) }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, 3).map(({ page }) => page)
    let starvedBefore = 0
    let starvedAfter = 0
    for (const hub of Object.keys(HUBS) as HubId[]) {
      for (const { language } of LOCALES) {
        const pages = hubs[hub][language]
        const before = new Map(pages.map((page) => [page.id, 0]))
        const after = new Map(pages.map((page) => [page.id, 0]))
        for (const page of pages) {
          const old = byHubOrder(pages, page.id)
          const picks = rankedRelated(pages, page.id)
          // Same relevance, pick for pick: only equally relevant candidates were exchanged.
          expect(picks.map((pick) => relatedScore(page.id, pick.id)), `${hub}/${language} ${page.id}`)
            .toEqual(old.map((pick) => relatedScore(page.id, pick.id)))
          for (const pick of old) before.set(pick.id, before.get(pick.id)! + 1)
          for (const pick of picks) after.set(pick.id, after.get(pick.id)! + 1)
        }
        starvedBefore += [...before.values()].filter((count) => count === 0).length
        starvedAfter += [...after.values()].filter((count) => count === 0).length
      }
    }
    expect(starvedAfter).toBeLessThan(starvedBefore)
  })

  it('plans every page of a list together and ranks an outsider against that plan', () => {
    const pages = ['p1', 'p2', 'p3', 'p4'].map((id) => ({ id }))
    const plan = relatedPlan(pages, 2)
    expect([...plan.keys()]).toEqual(['p1', 'p2', 'p3', 'p4'])
    for (const page of pages) expect(rankedRelated(pages, page.id, 2)).toEqual(plan.get(page.id))
    // A page outside the list (no plan of its own) is sent to the least recommended candidates.
    const counts = new Map(pages.map((page) => [page.id, 0]))
    for (const picks of plan.values()) for (const pick of picks) counts.set(pick.id, counts.get(pick.id)! + 1)
    const [first] = rankedRelated(pages, 'outsider', 2)
    expect(counts.get(first.id)).toBe(Math.min(...counts.values()))
  })
})
