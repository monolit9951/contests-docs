import { describe, expect, it } from 'vitest'

import { computeDepth } from './engagement'

const VIEWPORT = 800

describe('computeDepth', () => {
    it('reports nothing seen while the article is still below the fold', () => {
        // Article starts one full viewport down (a tall hero above it).
        expect(computeDepth(VIEWPORT, 4000, VIEWPORT)).toBe(0)
        expect(computeDepth(VIEWPORT + 200, 4000, VIEWPORT)).toBe(0)
    })

    it('measures how far the bottom of the viewport has travelled into the article', () => {
        // Article top at the top of the viewport: the reader can see the first
        // 800px of 4000 = 20%.
        expect(computeDepth(0, 4000, VIEWPORT)).toBe(20)
        // Scrolled so that 2000px of the article are above the viewport top:
        // 2000 + 800 = 2800 of 4000 seen.
        expect(computeDepth(-2000, 4000, VIEWPORT)).toBe(70)
    })

    it('caps at 100 once the end of the article is on screen', () => {
        expect(computeDepth(-3200, 4000, VIEWPORT)).toBe(100)
        // Scrolled past the article entirely, into the CTA and the footer.
        expect(computeDepth(-6000, 4000, VIEWPORT)).toBe(100)
    })

    it('calls a short article fully read on arrival', () => {
        // The whole point of measuring the ARTICLE and not the document: a FAQ
        // answer shorter than the viewport is finished the moment it renders,
        // and will never fire a scroll event to say so.
        expect(computeDepth(0, 300, VIEWPORT)).toBe(100)
    })

    it('does not report a permanent zero when the article cannot be measured', () => {
        // A zero-height node is a layout we failed to read, not a page the
        // reader is 0% through — counting it as 0 would drag every average down.
        expect(computeDepth(0, 0, VIEWPORT)).toBe(100)
        expect(computeDepth(0, -1, VIEWPORT)).toBe(100)
    })

    it('crosses each milestone exactly where the dashboard expects', () => {
        // 4000px article, 800px viewport: 25% is 1000px seen, i.e. top at -200.
        expect(computeDepth(-200, 4000, VIEWPORT)).toBe(25)
        expect(computeDepth(-1200, 4000, VIEWPORT)).toBe(50)
        expect(computeDepth(-2200, 4000, VIEWPORT)).toBe(75)
    })
})
