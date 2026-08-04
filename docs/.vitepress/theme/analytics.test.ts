import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
    classifyExitFrom,
    DocsEvent,
    isContentPath,
    normalizeDocsPath,
    readDocsOutbox,
    resetDocsAnalyticsForTests,
    sanitizeDocsMeta,
    trackDocsEvent,
    throttleKeyFor,
} from './analytics'

class MemoryStorage {
    private readonly values = new Map<string, string>()

    get length(): number { return this.values.size }
    clear(): void { this.values.clear() }
    getItem(key: string): string | null { return this.values.get(key) ?? null }
    key(index: number): string | null { return [...this.values.keys()][index] ?? null }
    removeItem(key: string): void { this.values.delete(key) }
    setItem(key: string, value: string): void { this.values.set(key, value) }
    keys(): string[] { return [...this.values.keys()] }
}

const tokenFor = (userId: string): string => [
    'header',
    Buffer.from(JSON.stringify({ userId, sub: userId })).toString('base64url'),
    'signature',
].join('.')

const ARTICLE = 'https://darebay.com/zarabotok/kak-zarabotat-na-narezkah-s-nulya'

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
        expect(classifyExitFrom('/pomoshch/oplata-kriptovalyutoy', ARTICLE)).toBeNull()
        expect(classifyExitFrom('../pomoshch/oplata-kriptovalyutoy', ARTICLE)).toBeNull()
        expect(classifyExitFrom('https://darebay.com/zarabotok/', ARTICLE)).toBeNull()
        expect(classifyExitFrom('/ua/zarobitok/yak-zarobyty-na-narizkakh-z-nulia', ARTICLE)).toBeNull()
        // Same page, explicit url plus a fragment.
        expect(classifyExitFrom(`${ARTICLE}#itogi`, ARTICLE)).toBeNull()
    })

    it('counts a link back into the product as the exit that matters', () => {
        expect(classifyExitFrom('https://darebay.com/', ARTICLE)).toBe(DocsEvent.ExitToSite)
        expect(classifyExitFrom('/tasks', ARTICLE)).toBe(DocsEvent.ExitToSite)
        expect(classifyExitFrom('/store', ARTICLE)).toBe(DocsEvent.ExitToSite)
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
        const preview = 'https://dev.darebay.com/pomoshch/'
        expect(classifyExitFrom('/pomoshch/oplata-kriptovalyutoy', preview)).toBeNull()
        expect(classifyExitFrom('https://dev.darebay.com/tasks', preview)).toBe(DocsEvent.ExitToSite)
    })
})

describe('normalizeDocsPath', () => {
    it('keeps the canonical article path so each landing page remains measurable', () => {
        expect(normalizeDocsPath('/zarabotok/kak-zarabotat')).toBe('/zarabotok/kak-zarabotat')
        expect(normalizeDocsPath('/ua/dopomoha/oplata-kryptoiu')).toBe('/ua/dopomoha/oplata-kryptoiu')
    })

    it('keeps the zone and section index pages distinct', () => {
        expect(normalizeDocsPath('/pomoshch/')).toBe('/pomoshch')
        expect(normalizeDocsPath('/en/help/')).toBe('/en/help')
    })

    it('maps the docs root to a single key', () => {
        expect(normalizeDocsPath('/')).toBe('/')
    })
})

describe('isContentPath', () => {
    it('derives RU, UA and EN content trees from the registry', () => {
        expect(isContentPath('/zarabotok/skolko-platyat-novichku')).toBe(true)
        expect(isContentPath('/ua/dopomoha/')).toBe(true)
        expect(isContentPath('/en/about/darebay-reviews')).toBe(true)
        expect(isContentPath('/tasks/example')).toBe(false)
        expect(isContentPath('/store')).toBe(false)
    })
})

describe('throttleKeyFor', () => {
    const A = '/pomoshch/oplata-kriptovalyutoy'
    const B = '/pomoshch/esli-net-rabot'

    it('separates the same event on different pages', () => {
        // The regression: the key had no page in it, so `docs_page_view` had ONE
        // key for the whole site and the 1s throttle silently dropped every view
        // a reader reached faster than that. Five pages at 500ms apart were
        // recorded as three.
        expect(throttleKeyFor('docs_page_view', undefined, undefined, A)).not.toBe(
            throttleKeyFor('docs_page_view', undefined, undefined, B),
        )
    })

    it('separates the same read-depth milestone on different pages', () => {
        expect(throttleKeyFor('docs_read_depth', '25', undefined, A)).not.toBe(
            throttleKeyFor('docs_read_depth', '25', undefined, B),
        )
    })

    it('still collapses a genuine repeat — same event, same page', () => {
        // This is what the throttle is FOR: a double click, or a listener that
        // got registered twice, must not become two rows.
        expect(throttleKeyFor('docs_page_view', undefined, undefined, A)).toBe(
            throttleKeyFor('docs_page_view', undefined, undefined, A),
        )
    })

    it('keeps milestones and metrics apart within one page', () => {
        const keys = ['25', '50', '75', '100'].map((d) => throttleKeyFor('docs_read_depth', d, undefined, A))
        expect(new Set(keys).size).toBe(4)
    })

    it('keeps two different outbound links on one page apart', () => {
        expect(throttleKeyFor('docs_exit_external', undefined, 'https://a.example/', A)).not.toBe(
            throttleKeyFor('docs_exit_external', undefined, 'https://b.example/', A),
        )
    })
})

describe('docs event meta contract', () => {
    it('keeps only event-specific bounded properties', () => {
        expect(sanitizeDocsMeta(DocsEvent.ReadTime, {
            engagedMs: '15000',
            maxDepth: '75',
            sequence: '2',
            reason: 'visibility_hidden',
            targetUrl: 'https://example.com/?secret=yes',
        })).toEqual({
            engagedMs: '15000',
            maxDepth: '75',
            sequence: '2',
            reason: 'visibility_hidden',
        })
    })

    it('rejects a referrer URL where a hostname is required', () => {
        expect(sanitizeDocsMeta(DocsEvent.NotFound, {
            referrerHost: 'https://example.com/private/path',
        })).toBeUndefined()
    })
})

describe('docs analytics persistence boundaries', () => {
    let storage: MemoryStorage

    beforeEach(() => {
        storage = new MemoryStorage()
        vi.stubGlobal('localStorage', storage)
        vi.stubGlobal('window', {
            location: {
                href: 'https://darebay.com/zarabotok/article?utm_source=google',
                origin: 'https://darebay.com',
                pathname: '/zarabotok/article',
                search: '?utm_source=google',
                hash: '',
                hostname: 'darebay.com',
            },
        })
        vi.stubGlobal('document', {
            referrer: '',
            documentElement: { lang: 'ru' },
        })
        vi.stubGlobal('navigator', { language: 'ru' })
        vi.stubGlobal('atob', (value: string) => Buffer.from(value, 'base64').toString('binary'))
        resetDocsAnalyticsForTests()
    })

    it('reads the same identity-scoped first-touch format as the SPA', () => {
        storage.setItem('darebay_analytics_identity_v2', JSON.stringify({ id: 'anon-shared' }))
        storage.setItem('darebay_analytics_first_touch', JSON.stringify({
            anonymousId: 'anon-shared',
            attribution: { landingPage: '/first', utm: { source: 'telegram' } },
        }))

        trackDocsEvent(DocsEvent.PageView, {}, { dedupeKey: 'shared', deferFlush: true })
        const [event] = readDocsOutbox()

        expect(event.anonymousId).toBe('anon-shared')
        expect(event.firstTouchLandingPage).toBe('/first')
        expect(event.firstTouchUtmSource).toBe('telegram')
    })

    it('lets one account claim an anonymous visit and isolates the next account', () => {
        trackDocsEvent(DocsEvent.PageView, {}, { dedupeKey: 'anonymous', deferFlush: true })
        const anonymousId = readDocsOutbox().at(-1)?.anonymousId

        storage.setItem('userToken', tokenFor('user-a'))
        trackDocsEvent(DocsEvent.PageView, {}, { dedupeKey: 'user-a', deferFlush: true })
        expect(readDocsOutbox().at(-1)?.anonymousId).toBe(anonymousId)

        storage.setItem('userToken', tokenFor('user-b'))
        trackDocsEvent(DocsEvent.PageView, {}, { dedupeKey: 'user-b', deferFlush: true })
        expect(readDocsOutbox().at(-1)?.anonymousId).not.toBe(anonymousId)
    })

    it('uses one immutable storage key per event and marks impersonation', () => {
        storage.setItem('userToken', tokenFor('target-user'))
        storage.setItem('impersonatorToken', 'admin-token')
        trackDocsEvent(DocsEvent.PageView, {}, { dedupeKey: 'one', deferFlush: true })
        trackDocsEvent(DocsEvent.ExitToSite, {}, { dedupeKey: 'two', deferFlush: true })

        const eventKeys = storage.keys().filter((key) =>
            key.startsWith('darebay_docs_analytics_outbox_v2:'))
        expect(eventKeys).toHaveLength(2)
        expect(readDocsOutbox().every((event) => event.isImpersonated)).toBe(true)
    })
})
