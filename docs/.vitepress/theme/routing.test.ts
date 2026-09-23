import { describe, expect, it } from 'vitest'
import { CONTENT_SEGMENTS, PAGES, localesOf, pagePath } from '../registry'
import { isContentPathname, leavesForApplication, mergeSlashes } from './routing'

const ORIGIN = 'https://darebay.com'

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

describe('mergeSlashes', () => {
    it('merges each run of slashes, the way nginx matched the address it served', () => {
        expect(mergeSlashes('//zarabotok/zarabotok-na-vk-klipah')).toBe('/zarabotok/zarabotok-na-vk-klipah')
        expect(mergeSlashes('/zarabotok//zarabotok-na-vk-klipah')).toBe('/zarabotok/zarabotok-na-vk-klipah')
        expect(mergeSlashes('///ua///zarobitok//')).toBe('/ua/zarobitok/')
    })

    it('leaves every published address as it is', () => {
        for (const page of PAGES) {
            for (const locale of localesOf(page)) {
                const path = pagePath(page, locale)!
                expect(mergeSlashes(path), path).toBe(path)
            }
        }
    })

    it('gives the router a path, not a protocol-relative host', () => {
        // VitePress parses addresses against a fake host (router.js): `//x/y` would be host x.
        expect(new URL('//zarabotok/zarabotok-na-vk-klipah', 'http://a.com').pathname).toBe('/zarabotok-na-vk-klipah')
        expect(new URL(mergeSlashes('//zarabotok/zarabotok-na-vk-klipah'), 'http://a.com').pathname)
            .toBe('/zarabotok/zarabotok-na-vk-klipah')
    })
})

describe('leavesForApplication', () => {
    it('sends a click on an application address to a real page load', () => {
        expect(leavesForApplication('/en', ORIGIN, false)).toBe(true)
        expect(leavesForApplication(`${ORIGIN}/tasks?from=docs`, ORIGIN, false)).toBe(true)
    })

    it('routes content addresses client-side', () => {
        expect(leavesForApplication('/zarabotok/zarabotok-na-vk-klipah', ORIGIN, false)).toBe(false)
        expect(leavesForApplication(`${ORIGIN}/ua/zarobitok/`, ORIGIN, false)).toBe(false)
    })

    it("never leaves on the document's own first route: that was a reload loop", () => {
        // `vitepress preview` answers /definitely-missing-page with 404.html; the first route is
        // that same address, and leaving for it loaded the page again, forever.
        expect(leavesForApplication('/definitely-missing-page', ORIGIN, true)).toBe(false)
        expect(leavesForApplication('/definitely-missing-page', ORIGIN, false)).toBe(true)
    })

    it('keeps the old answer for an address it cannot parse: stay', () => {
        expect(leavesForApplication('http://[', ORIGIN, false)).toBe(false)
    })
})
