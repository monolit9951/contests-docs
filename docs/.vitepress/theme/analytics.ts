// Click beacon for the docs site.
//
// Until this existed the content pages were invisible: 3 758 non-bot visits sat
// in the nginx log against ZERO rows in `click_event`, because /docs is a
// separate static container with none of the SPA's instrumentation. The one page
// that actually earns search traffic could not be seen in the admin dashboard at
// all, so the content fleet's effect was unmeasurable.
//
// It deliberately reuses the app's session record. Same origin (darebay.com),
// same localStorage key, same 30-minute idle rotation — so a reader who arrives
// from search on an article and then opens the product is ONE session, and the
// article → app path is finally attributable. Anything this file writes has to
// stay shape-compatible with `shared/lib/analytics/session.ts` in the frontend.

const STORAGE_KEY = 'darebay_analytics_session'
const IDLE_ROTATE_MS = 30 * 60 * 1000
const NEW_SESSION_WINDOW_MS = 30 * 1000
const THROTTLE_MS = 1000
const ENDPOINT = 'https://darebay.com/api/analytics/click'

/** Ids follow the app's `<page>_<section>_<action>` convention. Fired only here. */
export const DocsEvent = {
    PageView: 'docs_page_view',
    ExitToSite: 'docs_exit_to_site',
    ExitToTelegram: 'docs_exit_to_telegram',
    /** Any other outbound host — a source we cite, a platform we compare against. */
    ExitExternal: 'docs_exit_external',
    /** Reader crossed 25 / 50 / 75 / 100% of the article body. `meta.depth`. */
    ReadDepth: 'docs_read_depth',
    /** Additive chunk of engaged (tab-visible) time. `meta.dwellMs`, `meta.maxDepth`. */
    ReadTime: 'docs_read_time',
    /** A url the fleet or an external link pointed at that no longer exists. */
    NotFound: 'docs_not_found',
    /** Core Web Vitals — LCP / CLS / INP / TTFB. Google ranks on these. */
    WebVitals: 'docs_web_vitals',
} as const

/**
 * Automatic telemetry, as opposed to a click a reader chose to make. The
 * backend excludes these from the CTA dashboards the same way it excludes the
 * SPA's `page_view` — see `ClickEventService.PASSIVE_EVENT_IDS`. Keep the two
 * lists in sync: an id that is passive here and unknown there silently becomes
 * the top "click" on the admin dashboard, because these fire on their own and
 * outnumber real clicks by orders of magnitude.
 */
export const PASSIVE_DOCS_EVENTS: readonly string[] = [
    DocsEvent.PageView,
    DocsEvent.ReadDepth,
    DocsEvent.ReadTime,
    DocsEvent.WebVitals,
]

export type DocsEventId = (typeof DocsEvent)[keyof typeof DocsEvent]

interface SessionContext {
    id: string
    firstSeenAt: number
    lastSeenAt: number
    initialReferrer?: string
    utm?: { source?: string; medium?: string; campaign?: string; content?: string; term?: string }
}

const randomId = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const readSession = (): SessionContext | null => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as SessionContext
        if (!parsed.id || typeof parsed.lastSeenAt !== 'number' || typeof parsed.firstSeenAt !== 'number') {
            return null
        }
        return parsed
    } catch {
        return null
    }
}

/**
 * Where the reader came from, or nothing when they came from us.
 *
 * The same-origin filter is not cosmetic. A session rotates after 30 minutes
 * idle, and the rotation can land on a page opened FROM another page of ours
 * (a docs link in a new tab, a return from the product). Without the filter
 * that fresh session records `https://darebay.com/docs/...` as its acquisition
 * source, and the dashboard's `initialReferrers` breakdown — the one answer to
 * "did search bring them" — fills up with our own urls. `session.ts` in the
 * frontend has always filtered this; the docs copy did not.
 */
const captureInitialReferrer = (): string | undefined => {
    const ref = document.referrer
    if (!ref) return undefined
    try {
        return new URL(ref).hostname === window.location.hostname ? undefined : ref
    } catch {
        return undefined
    }
}

const captureUtm = (): SessionContext['utm'] => {
    const params = new URLSearchParams(window.location.search)
    const utm = {
        source: params.get('utm_source') ?? undefined,
        medium: params.get('utm_medium') ?? undefined,
        campaign: params.get('utm_campaign') ?? undefined,
        content: params.get('utm_content') ?? undefined,
        term: params.get('utm_term') ?? undefined,
    }
    return Object.values(utm).some(Boolean) ? utm : undefined
}

/**
 * The live session, rotated after 30 minutes idle. Acquisition context is
 * captured ONCE at session start: by the second page the referrer is our own
 * domain, and that would overwrite "came from Yandex" with "came from us".
 */
const getSession = (): SessionContext => {
    const now = Date.now()
    const existing = readSession()
    const session: SessionContext =
        existing && now - existing.lastSeenAt < IDLE_ROTATE_MS
            ? { ...existing, lastSeenAt: now }
            : {
                  id: randomId(),
                  firstSeenAt: now,
                  lastSeenAt: now,
                  initialReferrer: captureInitialReferrer(),
                  utm: captureUtm(),
              }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
        /* private mode — the beacon still fires, it just cannot be stitched */
    }
    return session
}

/**
 * Collapses the concrete path into a shape the dashboard can aggregate:
 * /ru/zarabotok/skolko-platyat -> /docs/ru/zarabotok/:slug
 */
export const normalizeDocsPath = (pathname: string): string => {
    const clean = pathname.replace(/\/+$/, '') || '/'
    const parts = clean.split('/').filter(Boolean)
    // ['docs','ru','zarabotok','slug'] — the zone stays, the article collapses.
    if (parts.length >= 4) return `/${parts.slice(0, 3).join('/')}/:slug`
    return `/${parts.join('/')}` || '/'
}

const recentSends = new Map<string, number>()

interface TrackOptions {
    /**
     * Extra discriminator for the 1s throttle. Without it a burst of distinct
     * events sharing one id collapses to the first: a reader who jumps to the
     * end of an article crosses 25/50/75/100% inside the same second, and only
     * the 25 would survive. Pass the varying part (the milestone, the metric
     * name) so each is throttled against its own kind.
     */
    dedupeKey?: string
}

/**
 * Throttle identity of one event.
 *
 * The pathname is part of it, and that is the whole point. The throttle exists
 * to swallow an accidental repeat — a double click, a listener registered
 * twice — which is always the SAME event on the SAME page. Without the path in
 * the key, `docs_page_view` had one constant key for the entire site and a
 * reader moving through the sidebar faster than once a second simply stopped
 * being counted: measured on the built bundle, five pages visited at 500 ms
 * apart produced three page views, while the same five at 1400 ms produced
 * five. Read-depth collided the same way, milestone against milestone.
 *
 * Deliberately the RAW pathname, not the normalized one: two articles in the
 * same zone both normalize to `/docs/ru/zarabotok/:slug` and would still
 * collide with each other.
 */
export const throttleKeyFor = (
    eventId: string,
    dedupeKey: string | undefined,
    targetUrl: string | undefined,
    pathname: string,
): string => `${eventId}:${dedupeKey ?? targetUrl ?? ''}:${pathname}`

export const trackDocsEvent = (
    eventId: DocsEventId,
    meta: Record<string, string> = {},
    options: TrackOptions = {},
): void => {
    if (typeof window === 'undefined') return

    const now = Date.now()
    const key = throttleKeyFor(eventId, options.dedupeKey, meta.targetUrl, window.location.pathname)
    if (now - (recentSends.get(key) ?? 0) < THROTTLE_MS) return
    recentSends.set(key, now)
    // The key now varies per page, so the map grows with the session instead of
    // being bounded by the event vocabulary. Drop entries that are past the
    // window and can no longer suppress anything.
    if (recentSends.size > 500) {
        for (const [k, ts] of recentSends) {
            if (now - ts >= THROTTLE_MS) recentSends.delete(k)
        }
    }

    const session = getSession()
    const { targetUrl, ...rest } = meta

    const payload = {
        eventId,
        page: normalizeDocsPath(window.location.pathname),
        rawPage: (window.location.pathname + window.location.search).slice(0, 512),
        targetUrl,
        sessionId: session.id,
        sessionStartedAt: new Date(session.firstSeenAt).toISOString(),
        isNewSession: now - session.firstSeenAt < NEW_SESSION_WINDOW_MS,
        initialReferrer: session.initialReferrer,
        eventKey: randomId(),
        utmSource: session.utm?.source,
        utmMedium: session.utm?.medium,
        utmCampaign: session.utm?.campaign,
        utmContent: session.utm?.content,
        utmTerm: session.utm?.term,
        language: navigator.languages?.[0] || navigator.language || undefined,
        meta: Object.keys(rest).length ? rest : undefined,
    }

    const body = JSON.stringify(payload)
    try {
        if (typeof navigator.sendBeacon === 'function') {
            if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) return
        }
        void fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
        }).catch(() => {
            /* analytics must never break the page */
        })
    } catch {
        /* same */
    }
}

const isDocsPath = (pathname: string): boolean =>
    pathname === '/docs' || pathname.startsWith('/docs/')

/**
 * Which exit a click is taking, or null when it is internal navigation.
 *
 * Pure — `currentUrl` is passed in rather than read off `window` — so the
 * classification is unit-testable without a DOM. {@link classifyExit} is the
 * browser-bound wrapper the click listener actually calls.
 */
export const classifyExitFrom = (href: string | null, currentUrl: string): DocsEventId | null => {
    if (!href) return null
    // In-page anchors first. Every heading carries a `.header-anchor` and the
    // whole "На этой странице" outline is `#…` links — resolved against the
    // ORIGIN (as this did) they came out with pathname `/`, which is not under
    // /docs, so each one was logged as an exit INTO the product. The docs' main
    // conversion metric was counting its own table of contents.
    if (href.startsWith('#')) return null
    if (href.startsWith('tg://')) return DocsEvent.ExitToTelegram
    try {
        // Base is the current URL, not the origin: a relative href ('../faq/')
        // has to resolve against the page it sits on to get a real pathname.
        const url = new URL(href, currentUrl)
        // mailto:, tel:, javascript: — not navigation we can attribute.
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
        if (url.hostname === 't.me' || url.hostname === 'telegram.me') return DocsEvent.ExitToTelegram
        if (url.hostname !== 'darebay.com' && url.hostname !== new URL(currentUrl).hostname) {
            // Sources we cite and platforms we compare against. Worth knowing:
            // an article that leaks readers to a competitor is a content bug.
            return DocsEvent.ExitExternal
        }
        // Same host: deeper into the docs is navigation, anywhere else is the product.
        return isDocsPath(url.pathname) ? null : DocsEvent.ExitToSite
    } catch {
        return null
    }
}

export const classifyExit = (href: string | null): DocsEventId | null =>
    classifyExitFrom(href, window.location.href)

export const installDocsAnalytics = (): void => {
    if (typeof window === 'undefined') return

    document.addEventListener(
        'click',
        (event) => {
            const anchor = (event.target as HTMLElement | null)?.closest?.('a')
            if (!anchor) return
            const exit = classifyExit(anchor.getAttribute('href'))
            if (exit) trackDocsEvent(exit, { targetUrl: anchor.href.slice(0, 512) })
        },
        { capture: true },
    )
}
