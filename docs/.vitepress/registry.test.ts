import { readFileSync } from 'node:fs'
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
            ['/ua/zarobitok/porih-perehliadiv-dlia-vyplaty', '/ua/zarobitok/yak-pratsiuie-oplata-za-perehliady'],
            ['/en/earnings/view-threshold', '/en/earnings/how-pay-per-view-works'],
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

// `/<hub>/index` is the file VitePress writes the hub to, not an address the
// site ever meant to answer. The container's `try_files $uri $uri/ $uri.html`
// fallback resolved the extensionless file name anyway and served the hub with
// 200 plus a canonical pointing at `/<hub>/` — fifteen crawlable duplicates,
// one per hub per locale, all discovered on the live site rather than here.
//
// A redirect is a public contract, so the rule is asserted against the SHIPPED
// redirects.conf: the failure this has to catch is a registry that grew a hub
// and an artifact nobody regenerated, and importing the generator's own source
// would hide exactly that.
describe('hub index duplicates', () => {
    const conf = readFileSync(new URL('../../redirects.conf', import.meta.url), 'utf8')
    const hubs = PAGES.flatMap((entry) =>
        LOCALES.filter((axis) => entry.slugs[axis.language] === '').map((axis) => pagePath(entry, axis.language)!),
    )

    it('retires the file name of every hub in every locale', () => {
        expect(hubs.length).toBe(Object.keys(HUBS).length * LOCALES.length)
        for (const hub of hubs) {
            expect(conf).toContain(`location = ${hub}index { return 301 ${hub}$is_args$args; }`)
        }
    })

    it('leaves the neighbouring spellings alone', () => {
        // `/<hub>/index.html` is answered by the clean-url regex in nginx.conf and
        // `/<hub>/index/` is a deliberate 404. An exact `=` rule for either one here
        // would take that decision away from the file that documents it.
        for (const hub of hubs) {
            expect(conf).not.toContain(`location = ${hub}index.html`)
            expect(conf).not.toContain(`location = ${hub}index/`)
        }
    })

    it('hops onto a hub that exists, never onto a 404', () => {
        const live = new Set(
            PAGES.flatMap((entry) => LOCALES.map((axis) => pagePath(entry, axis.language)).filter(Boolean)),
        )
        const emitted = [...conf.matchAll(/location = (\S+)index \{ return 301 (\S+)\$is_args/g)]
        expect(emitted.length).toBe(hubs.length)
        for (const [, source, target] of emitted) {
            expect(source).toBe(target)
            expect(live.has(target), `${target} is not a live address`).toBe(true)
        }
    })
})
