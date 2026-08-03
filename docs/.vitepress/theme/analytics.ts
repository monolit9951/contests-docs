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
} as const

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
                  initialReferrer: document.referrer || undefined,
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

export const trackDocsEvent = (eventId: DocsEventId, meta: Record<string, string> = {}): void => {
    if (typeof window === 'undefined') return

    const now = Date.now()
    const key = `${eventId}:${meta.targetUrl ?? ''}`
    if (now - (recentSends.get(key) ?? 0) < THROTTLE_MS) return
    recentSends.set(key, now)

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

/** Which exit a click is taking, or null when it is internal navigation. */
export const classifyExit = (href: string | null): DocsEventId | null => {
    if (!href) return null
    if (href.startsWith('https://t.me/') || href.startsWith('tg://')) return DocsEvent.ExitToTelegram
    try {
        const url = new URL(href, window.location.origin)
        if (url.hostname !== 'darebay.com' && url.hostname !== window.location.hostname) return null
        // A link back into the product, not deeper into the docs.
        return url.pathname.startsWith('/docs') ? null : DocsEvent.ExitToSite
    } catch {
        return null
    }
}

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
