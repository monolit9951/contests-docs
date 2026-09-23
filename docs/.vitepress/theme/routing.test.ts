import { describe, expect, it } from 'vitest'
import { CONTENT_SEGMENTS, PAGES, localesOf, pagePath } from '../registry'
import { isContentPathname } from './routing'

describe('isContentPathname', () => {
    it('matches every hub this container serves, at its root and below', () => {
        expect(CONTENT_SEGMENTS.length).toBeGreaterThan(0)
        for (const segment of CONTENT_SEGMENTS) {
            expect(isContentPathname(`/${segment}`), segment).toBe(true)
            expect(isContentPathname(`/${segment}/`), segment).toBe(true)
            expect(isContentPathname(`/${segment}/some-page`), segment).toBe(true)
        }
    })

    it('matches every published page address', () => {
        for (const page of PAGES) {
            for (const locale of localesOf(page)) {
                const path = pagePath(page, locale)!
                expect(isContentPathname(path), path).toBe(true)
            }
        }
    })

    it('leaves application addresses and look-alike prefixes alone', () => {
        for (const path of ['/', '/en', '/ua', '/tasks', '/definitely-missing-page', '/zarabotokx', `/${CONTENT_SEGMENTS[0]}x/page`]) {
            expect(isContentPathname(path), path).toBe(false)
        }
    })
})
