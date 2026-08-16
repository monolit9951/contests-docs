import { describe, expect, it } from 'vitest'
import { HUBS, LOCALES, PAGES, ROOT_LOCALE, pagePath, redirectMap } from './registry'

// A retired address must land the reader in the language they arrived in.
//
// WHY THIS EXISTS. Until the 2026-08 consolidation every `retired` entry was
// Russian (`/docs/ru/…`), so mapping all of them onto the RU canonical was
// invisibly correct. Collapsing six pages across all three locales added UA and
// EN addresses to the same lists, and the old one-line implementation 301'd
// `/ua/zarobitok/skilky-platiat-novachku` onto the RUSSIAN survivor. It shipped
// and was caught only by probing the live site after deploy.
//
// A cross-language redirect is worse than a 404: the reader silently loses their
// language, and the wrong page ends up answering for that locale.

const localeOfPath = (path: string): string => {
    for (const axis of LOCALES) {
        if (axis.prefix && (path === axis.prefix || path.startsWith(`${axis.prefix}/`))) return axis.language
    }
    return ROOT_LOCALE.language
}

describe('redirectMap locale integrity', () => {
    const map = redirectMap()

    it('never sends a reader across languages', () => {
        // The ONE legal crossing: the survivor has no page in the source language
        // yet, so the root canonical is the only live address there is.
        const illegal = Object.entries(map)
            .filter(([from, to]) => localeOfPath(from) !== localeOfPath(to))
            .filter(([from, to]) => {
                if (localeOfPath(to) !== ROOT_LOCALE.language) return true
                const survivor = PAGES.find((entry) => pagePath(entry, ROOT_LOCALE.language) === to)
                if (!survivor) return true
                const language = localeOfPath(from) as (typeof LOCALES)[number]['language']
                return pagePath(survivor, language) !== null
            })
            .map(([from, to]) => `${from} -> ${to}`)

        expect(illegal).toEqual([])
    })

    it('keeps every localized retired address inside its own hub tree', () => {
        for (const [from, to] of Object.entries(map)) {
            const language = localeOfPath(from)
            if (language === ROOT_LOCALE.language) continue
            const axis = LOCALES.find((candidate) => candidate.language === language)
            expect(axis, `unknown locale for ${from}`).toBeDefined()
            // A UA address may only resolve to a UA address (or fall back to root).
            expect(
                to.startsWith(`${axis!.prefix}/`) || localeOfPath(to) === ROOT_LOCALE.language,
                `${from} -> ${to} escapes its locale tree`,
            ).toBe(true)
        }
    })

    it('resolves the collapsed earnings pages within each locale', () => {
        // Regression guard with the exact addresses that shipped wrong.
        const cases: Array<[string, string]> = [
            ['/ua/zarobitok/skilky-platiat-novachku', '/ua/zarobitok/skilky-mozhna-zarobyty-na-narizkakh'],
            ['/ua/zarobitok/porih-perehliadiv-dlia-vyplaty', '/ua/zarobitok/yak-rakhuiutsia-perehliady-dlia-vyplaty'],
            ['/en/earnings/view-threshold', '/en/earnings/how-views-are-counted'],
            ['/en/earnings/beginner-rates', '/en/earnings/how-much-clipping-pays'],
            ['/zarabotok/skolko-platyat-novichku', '/zarabotok/skolko-mozhno-zarabotat-na-narezkah'],
        ]
        for (const [from, expected] of cases) expect(map[from]).toBe(expected)
    })

    it('points every target at a live address, never at another redirect', () => {
        const sources = new Set(Object.keys(map))
        for (const [from, to] of Object.entries(map)) {
            expect(sources.has(to), `${from} -> ${to} chains onward`).toBe(false)
        }
    })

    it('covers all three locales, so the guard cannot pass vacuously', () => {
        const covered = new Set(Object.keys(map).map(localeOfPath))
        for (const axis of LOCALES) expect(covered.has(axis.language)).toBe(true)
        expect(Object.keys(HUBS).length).toBeGreaterThan(0)
    })
})
