import { describe, expect, it } from 'vitest'
import { modifiedDay, visibleUpdatedDate } from './pageDates'

describe('the visible page update date', () => {
  it('uses the same git modification day as structured data', () => {
    const day = modifiedDay({ published: '2026-09-03T12:00:00Z', modified: '2026-10-01T10:24:45Z' })
    const page = { updated: day, hero: { updated: '2026-09-29' }, compare: { ids: ['darebay'] } }
    expect(visibleUpdatedDate(page)).toBe('2026-10-01')
    expect(page.hero.updated).toBe('2026-09-29')
  })

  it('does not invent a page update from a source snapshot', () => {
    const page = { updated: null, hero: { updated: '2026-09-29' }, compare: {} }
    expect(modifiedDay()).toBeNull()
    expect(visibleUpdatedDate(page)).toBeNull()
  })

  it('keeps showcase hubs from printing a second date beside their dated kicker', () => {
    expect(visibleUpdatedDate({ updated: '2026-10-01', isHub: true, showcase: true })).toBeNull()
    expect(visibleUpdatedDate({ updated: '2026-10-01', isHub: true })).toBe('2026-10-01')
    expect(visibleUpdatedDate({ updated: '2026-10-01', showcase: true })).toBe('2026-10-01')
  })
})
