import { describe, expect, it } from 'vitest'

import { classifyExitFrom, DocsEvent, normalizeDocsPath, PASSIVE_DOCS_EVENTS } from './analytics'

const ARTICLE = 'https://darebay.com/docs/ru/zarabotok/kak-zarabotat-na-narezkah-s-nulya'

describe('classifyExitFrom', () => {
    it('does not treat in-page anchors as leaving the docs', () => {
        // The regression this whole function was rewritten for. Every heading
        // renders a `.header-anchor` and the entire "На этой странице" outline
        // is `#…` links. Resolved against the ORIGIN they came out as pathname
        // `/` — not under /docs — so reading the table of contents registered
        // as converting into the product, and `docs_exit_to_site` measured the
        // docs' own navigation instead of its only success metric.
        expect(classifyExitFrom('#kak-eto-rabotaet', ARTICLE)).toBeNull()
        expect(classifyExitFrom('#', ARTICLE)).toBeNull()
    })

    it('ignores navigation deeper into the docs, absolute or relative', () => {
        expect(classifyExitFrom('/docs/ru/faq/crypto', ARTICLE)).toBeNull()
        expect(classifyExitFrom('../faq/crypto', ARTICLE)).toBeNull()
        expect(classifyExitFrom('https://darebay.com/docs/', ARTICLE)).toBeNull()
        // Same page, explicit url plus a fragment.
        expect(classifyExitFrom(`${ARTICLE}#itogi`, ARTICLE)).toBeNull()
    })

    it('counts a link back into the product as the exit that matters', () => {
        expect(classifyExitFrom('https://darebay.com/', ARTICLE)).toBe(DocsEvent.ExitToSite)
        expect(classifyExitFrom('/contests', ARTICLE)).toBe(DocsEvent.ExitToSite)
        // A path that merely starts with the letters "docs" is not the docs.
        expect(classifyExitFrom('/docsomething', ARTICLE)).toBe(DocsEvent.ExitToSite)
    })

    it('recognises Telegram in every form the docs link it', () => {
        expect(classifyExitFrom('https://t.me/darebay_app', ARTICLE)).toBe(DocsEvent.ExitToTelegram)
        expect(classifyExitFrom('https://telegram.me/darebay_app', ARTICLE)).toBe(DocsEvent.ExitToTelegram)
        expect(classifyExitFrom('tg://resolve?domain=darebay_app', ARTICLE)).toBe(DocsEvent.ExitToTelegram)
    })

    it('separates third-party destinations from our own', () => {
        expect(classifyExitFrom('https://www.tiktok.com/@someone', ARTICLE)).toBe(DocsEvent.ExitExternal)
        expect(classifyExitFrom('https://whop.com/', ARTICLE)).toBe(DocsEvent.ExitExternal)
    })

    it('leaves non-navigational protocols alone', () => {
        expect(classifyExitFrom('mailto:hi@darebay.com', ARTICLE)).toBeNull()
        expect(classifyExitFrom('tel:+48000000000', ARTICLE)).toBeNull()
        expect(classifyExitFrom('javascript:void(0)', ARTICLE)).toBeNull()
    })

    it('survives a missing or unparseable href instead of throwing on the click path', () => {
        expect(classifyExitFrom(null, ARTICLE)).toBeNull()
        expect(classifyExitFrom('', ARTICLE)).toBeNull()
        expect(classifyExitFrom('http://[bad', ARTICLE)).toBeNull()
    })

    it('treats the dev host as our own, so a preview does not read as an exit', () => {
        const preview = 'https://dev.darebay.com/docs/ru/faq/'
        expect(classifyExitFrom('/docs/ru/faq/crypto', preview)).toBeNull()
        expect(classifyExitFrom('https://dev.darebay.com/contests', preview)).toBe(DocsEvent.ExitToSite)
    })
})

describe('normalizeDocsPath', () => {
    it('collapses the article slug so a zone can be aggregated', () => {
        expect(normalizeDocsPath('/docs/ru/zarabotok/kak-zarabotat')).toBe('/docs/ru/zarabotok/:slug')
        expect(normalizeDocsPath('/docs/ru/faq/crypto')).toBe('/docs/ru/faq/:slug')
    })

    it('keeps the zone and section index pages distinct', () => {
        expect(normalizeDocsPath('/docs/ru/faq/')).toBe('/docs/ru/faq')
        expect(normalizeDocsPath('/docs/')).toBe('/docs')
    })

    it('maps the docs root to a single key', () => {
        expect(normalizeDocsPath('/')).toBe('/')
    })
})

describe('PASSIVE_DOCS_EVENTS', () => {
    it('lists exactly the beacons the reader never chose to send', () => {
        // Kept in sync by hand with ClickEventService.PASSIVE_EVENT_IDS in the
        // backend. An id that is passive here and unknown there lands in the
        // CTA aggregations and, because these fire on their own, immediately
        // becomes the top "click" on the admin dashboard.
        expect([...PASSIVE_DOCS_EVENTS].sort()).toEqual([
            'docs_page_view',
            'docs_read_depth',
            'docs_read_time',
            'docs_web_vitals',
        ])
    })

    it('does not swallow the exits, which are real clicks', () => {
        expect(PASSIVE_DOCS_EVENTS).not.toContain(DocsEvent.ExitToSite)
        expect(PASSIVE_DOCS_EVENTS).not.toContain(DocsEvent.ExitToTelegram)
        expect(PASSIVE_DOCS_EVENTS).not.toContain(DocsEvent.ExitExternal)
    })
})
