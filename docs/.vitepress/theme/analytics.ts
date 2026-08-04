import { HUBS, LOCALES, PAGES, pagePath } from '../registry'

const SESSION_STORAGE_KEY = 'darebay_analytics_session_v2'
const IDENTITY_STORAGE_KEY = 'darebay_analytics_identity_v2'
const FIRST_TOUCH_STORAGE_KEY = 'darebay_analytics_first_touch'
const OUTBOX_STORAGE_PREFIX = 'darebay_docs_analytics_outbox_v2:'
const TOKEN_STORAGE_KEY = 'userToken'
const IMPERSONATOR_TOKEN_KEY = 'impersonatorToken'
const IDLE_ROTATE_MS = 30 * 60 * 1000
const THROTTLE_MS = 1000
const ENDPOINT = '/api/analytics/events'
const EVENT_VERSION = 2
const MAX_OUTBOX_EVENTS = 100
const OUTBOX_TTL_MS = 24 * 60 * 60 * 1000
const MAX_META_VALUE_LENGTH = 256

const CLICK_IDS = ['gclid', 'yclid', 'fbclid', 'ttclid'] as const
type ClickId = (typeof CLICK_IDS)[number]

export const DocsEvent = {
    PageView: 'docs_page_view',
    ExitToSite: 'docs_exit_to_site',
    ExitToTelegram: 'docs_exit_to_telegram',
    ExitExternal: 'docs_exit_external',
    ReadDepth: 'docs_read_depth',
    ReadTime: 'docs_read_time',
    NotFound: 'docs_not_found',
    WebVitals: 'docs_web_vitals',
    ClientError: 'client_error',
} as const

export type DocsEventId = (typeof DocsEvent)[keyof typeof DocsEvent]
type EventKind = 'page_view' | 'interaction' | 'engagement' | 'performance' | 'error'

const EVENT_KINDS: Record<DocsEventId, EventKind> = {
    [DocsEvent.PageView]: 'page_view',
    [DocsEvent.ExitToSite]: 'interaction',
    [DocsEvent.ExitToTelegram]: 'interaction',
    [DocsEvent.ExitExternal]: 'interaction',
    [DocsEvent.ReadDepth]: 'engagement',
    [DocsEvent.ReadTime]: 'engagement',
    [DocsEvent.NotFound]: 'error',
    [DocsEvent.WebVitals]: 'performance',
    [DocsEvent.ClientError]: 'error',
}

const EVENT_META_KEYS: Record<DocsEventId, readonly string[]> = {
    [DocsEvent.PageView]: [],
    [DocsEvent.ExitToSite]: [],
    [DocsEvent.ExitToTelegram]: [],
    [DocsEvent.ExitExternal]: [],
    [DocsEvent.ReadDepth]: ['depth'],
    [DocsEvent.ReadTime]: ['engagedMs', 'maxDepth', 'sequence', 'reason'],
    [DocsEvent.NotFound]: ['referrerHost'],
    [DocsEvent.WebVitals]: ['metric', 'value', 'rating', 'navigationType'],
    [DocsEvent.ClientError]: ['message'],
}

interface Utm {
    source?: string
    medium?: string
    campaign?: string
    content?: string
    term?: string
}

interface Attribution {
    landingPage: string
    referrerHost?: string
    utm?: Utm
    startParam?: string
    clickIds?: Partial<Record<ClickId, string>>
}

interface SessionContext {
    id: string
    anonymousId: string
    firstSeenAt: number
    lastSeenAt: number
    firstTouch: Attribution
    sessionTouch: Attribution
    actorBoundary: string
}

interface BrowserIdentity {
    id: string
    ownerBoundary?: string
}

interface StoredFirstTouch {
    anonymousId: string
    attribution: Attribution
}

interface AnalyticsPayload {
    eventId: DocsEventId
    eventVersion: 2
    eventKind: EventKind
    occurredAt: string
    eventKey: string
    anonymousId: string
    sessionId: string
    sessionStartedAt: string
    pageViewId: string
    surface: 'docs'
    routeId: string
    page: string
    targetUrl?: string
    releaseSha?: string
    language?: string
    isImpersonated?: boolean
    firstTouchUtmSource?: string
    firstTouchUtmMedium?: string
    firstTouchUtmCampaign?: string
    firstTouchUtmContent?: string
    firstTouchUtmTerm?: string
    firstTouchLandingPage?: string
    firstTouchStartParam?: string
    firstTouchReferrer?: string
    firstTouchGclid?: string
    firstTouchYclid?: string
    firstTouchFbclid?: string
    firstTouchTtclid?: string
    sessionTouchUtmSource?: string
    sessionTouchUtmMedium?: string
    sessionTouchUtmCampaign?: string
    sessionTouchUtmContent?: string
    sessionTouchUtmTerm?: string
    sessionTouchLandingPage?: string
    sessionTouchStartParam?: string
    sessionTouchReferrer?: string
    sessionTouchGclid?: string
    sessionTouchYclid?: string
    sessionTouchFbclid?: string
    sessionTouchTtclid?: string
    meta?: Record<string, string>
}

interface AuthenticatedAnalyticsPayload extends AnalyticsPayload {
    authToken?: string
    initData?: string
}

let memoryIdentity: BrowserIdentity | undefined
let memoryFirstTouch: StoredFirstTouch | undefined
let memorySession: SessionContext | undefined
const memoryOutbox = new Map<string, AnalyticsPayload>()
export interface DocsPageContext {
    pageViewId: string
    routeId: string
    page: string
}

let currentPageContext: DocsPageContext | undefined

const randomId = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const bounded = (value: string | null | undefined, max = 128): string | undefined => {
    const normalized = value?.trim()
    return normalized ? normalized.slice(0, max) : undefined
}

const safeGet = (key: string): string | null => {
    try { return localStorage.getItem(key) } catch { return null }
}

const safeSet = (key: string, value: string): void => {
    try { localStorage.setItem(key, value) } catch { /* storage is best-effort */ }
}

const safeRemove = (key: string): void => {
    try { localStorage.removeItem(key) } catch { /* storage is best-effort */ }
}

const safeKeys = (): string[] => {
    try {
        const keys: string[] = []
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index)
            if (key !== null) keys.push(key)
        }
        return keys
    } catch { return [] }
}

const parseJson = <T>(raw: string | null): T | null => {
    if (!raw) return null
    try { return JSON.parse(raw) as T } catch { return null }
}

const jwtAccountId = (): string | undefined => {
    const token = safeGet(TOKEN_STORAGE_KEY)
    if (!token) return undefined
    try {
        const payload = token.split('.')[1]
        if (!payload) return undefined
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
            + '='.repeat((4 - payload.length % 4) % 4)
        const claims = JSON.parse(atob(base64)) as { userId?: unknown; sub?: unknown }
        const accountId = typeof claims.userId === 'string'
            ? claims.userId
            : typeof claims.sub === 'string' ? claims.sub : undefined
        return accountId && /^[A-Za-z0-9_-]{1,128}$/.test(accountId)
            ? accountId
            : undefined
    } catch { return undefined }
}

const telegramUserId = (): number | undefined => {
    const value = (window as unknown as {
        Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: unknown } } } }
    }).Telegram?.WebApp?.initDataUnsafe?.user?.id
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
        ? value
        : undefined
}

const telegramInitData = (): string | undefined => {
    const value = (window as unknown as {
        Telegram?: { WebApp?: { initData?: unknown } }
    }).Telegram?.WebApp?.initData
    return typeof value === 'string' ? bounded(value, 8192) : undefined
}

const actorContext = (): { boundary: string; impersonated: boolean } => {
    const impersonated = safeGet(IMPERSONATOR_TOKEN_KEY) !== null
    const accountId = jwtAccountId()
    const telegramId = telegramUserId()
    let actorKey: string | undefined
    if (impersonated && accountId) actorKey = `account:${accountId}`
    else if (telegramId) actorKey = `telegram:${telegramId}`
    else if (accountId) actorKey = `account:${accountId}`

    let boundary = 'anonymous'
    if (actorKey) boundary = `${impersonated ? 'impersonated' : 'authenticated'}:${actorKey}`
    else if (impersonated) boundary = 'impersonated:unknown'
    return { boundary, impersonated }
}

const readIdentity = (): BrowserIdentity | undefined => {
    const parsed = memoryIdentity
        ?? parseJson<BrowserIdentity>(safeGet(IDENTITY_STORAGE_KEY))
    if (!parsed || !bounded(parsed.id)) return undefined
    if (parsed.ownerBoundary !== undefined && !bounded(parsed.ownerBoundary, 160)) return undefined
    return parsed
}

const writeIdentity = (identity: BrowserIdentity): BrowserIdentity => {
    memoryIdentity = identity
    safeSet(IDENTITY_STORAGE_KEY, JSON.stringify(identity))
    return identity
}

const resetIdentityState = (): void => {
    memoryFirstTouch = undefined
    memorySession = undefined
    safeRemove(FIRST_TOUCH_STORAGE_KEY)
    safeRemove(SESSION_STORAGE_KEY)
}

const identityForBoundary = (boundary: string): BrowserIdentity => {
    const existing = readIdentity()
    const anonymous = boundary === 'anonymous'
    if (!existing) {
        return writeIdentity({ id: randomId(), ...(!anonymous && { ownerBoundary: boundary }) })
    }
    if (!existing.ownerBoundary && !anonymous && !boundary.startsWith('impersonated:')) {
        return writeIdentity({ ...existing, ownerBoundary: boundary })
    }
    const crossed = existing.ownerBoundary ? existing.ownerBoundary !== boundary : !anonymous
    if (crossed) {
        resetIdentityState()
        return writeIdentity({ id: randomId(), ...(!anonymous && { ownerBoundary: boundary }) })
    }
    memoryIdentity = existing
    return existing
}

const captureAttribution = (): Attribution => {
    const params = new URLSearchParams(window.location.search)
    const utm: Utm = {}
    for (const key of ['source', 'medium', 'campaign', 'content', 'term'] as const) {
        const value = bounded(params.get(`utm_${key}`))
        if (value) utm[key] = value
    }
    const clickIds: Partial<Record<ClickId, string>> = {}
    for (const key of CLICK_IDS) {
        const value = bounded(params.get(key))
        if (value) clickIds[key] = value
    }
    let referrerHost: string | undefined
    try {
        const referrer = document.referrer ? new URL(document.referrer) : undefined
        if (referrer && referrer.hostname !== window.location.hostname) referrerHost = referrer.hostname.toLowerCase()
    } catch { /* invalid referrer */ }
    const hash = window.location.hash.replace(/^#/, '')
    const startParam = bounded(
        params.get('tgWebAppStartParam')
        ?? new URLSearchParams(hash).get('tgWebAppStartParam'),
    )
    return {
        landingPage: normalizePublicPath(window.location.pathname),
        referrerHost,
        utm: Object.keys(utm).length ? utm : undefined,
        startParam,
        clickIds: Object.keys(clickIds).length ? clickIds : undefined,
    }
}

const getSession = (): SessionContext => {
    const now = Date.now()
    const actor = actorContext()
    const identity = identityForBoundary(actor.boundary)
    const parsed = memorySession ?? parseJson<SessionContext>(safeGet(SESSION_STORAGE_KEY))
    if (parsed?.id && parsed.anonymousId && parsed.firstTouch?.landingPage && parsed.sessionTouch?.landingPage
        && parsed.actorBoundary === actor.boundary && parsed.anonymousId === identity.id
        && now - parsed.lastSeenAt < IDLE_ROTATE_MS) {
        const refreshed = { ...parsed, lastSeenAt: now }
        memorySession = refreshed
        safeSet(SESSION_STORAGE_KEY, JSON.stringify(refreshed))
        return refreshed
    }

    const sessionTouch = captureAttribution()
    const storedFirstTouch = memoryFirstTouch
        ?? parseJson<StoredFirstTouch>(safeGet(FIRST_TOUCH_STORAGE_KEY))
    const firstTouch = storedFirstTouch?.anonymousId === identity.id
        && storedFirstTouch.attribution?.landingPage
        ? storedFirstTouch.attribution
        : sessionTouch
    memoryFirstTouch = { anonymousId: identity.id, attribution: firstTouch }
    safeSet(FIRST_TOUCH_STORAGE_KEY, JSON.stringify(memoryFirstTouch))
    const session: SessionContext = {
        id: randomId(),
        anonymousId: identity.id,
        firstSeenAt: now,
        lastSeenAt: now,
        firstTouch,
        sessionTouch,
        actorBoundary: actor.boundary,
    }
    memorySession = session
    safeSet(SESSION_STORAGE_KEY, JSON.stringify(session))
    return session
}

const normalizePublicPath = (pathname: string): string => {
    const withoutTrailing = pathname.replace(/\/+$/, '')
    return withoutTrailing || '/'
}

const canonicalContentPaths = new Set(
    PAGES.flatMap((entry) => LOCALES.flatMap(({ language }) => {
        const path = pagePath(entry, language)
        return path ? [normalizePublicPath(path)] : []
    })),
)

const contentPrefixes = LOCALES.flatMap(({ language, prefix }) =>
    Object.values(HUBS).map((hub) => `${prefix}/${hub[language]}`),
)

export const normalizeDocsPath = (pathname: string): string => normalizePublicPath(pathname)

export const isContentPath = (pathname: string): boolean => {
    const normalized = normalizePublicPath(pathname)
    if (canonicalContentPaths.has(normalized)) return true
    return contentPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))
}

export const startDocsPage = (): DocsPageContext => {
    currentPageContext = {
        pageViewId: randomId(),
        routeId: normalizeDocsPath(window.location.pathname),
        page: normalizePublicPath(window.location.pathname),
    }
    return currentPageContext
}

export const getDocsPageContext = (): DocsPageContext => currentPageContext ?? startDocsPage()

export const throttleKeyFor = (
    eventId: string,
    dedupeKey: string | undefined,
    targetUrl: string | undefined,
    pathname: string,
): string => `${eventId}:${dedupeKey ?? targetUrl ?? ''}:${normalizePublicPath(pathname)}`

const recentSends = new Map<string, number>()

interface TrackOptions {
    dedupeKey?: string
    pageContext?: DocsPageContext
    deferFlush?: boolean
}

const sanitizeTarget = (value: string | undefined): string | undefined => {
    if (!value) return undefined
    try {
        const url = new URL(value, window.location.origin)
        const path = normalizePublicPath(url.pathname).slice(0, 256)
        return url.origin === window.location.origin ? path : `${url.origin}${path}`.slice(0, 512)
    } catch { return undefined }
}

const outboxKey = (eventKey: string): string =>
    `${OUTBOX_STORAGE_PREFIX}${encodeURIComponent(eventKey)}`

export const readDocsOutbox = (): AnalyticsPayload[] => {
    const cutoff = Date.now() - OUTBOX_TTL_MS
    const stored: AnalyticsPayload[] = []
    for (const key of safeKeys().filter((candidate) => candidate.startsWith(OUTBOX_STORAGE_PREFIX))) {
        const event = parseJson<AnalyticsPayload>(safeGet(key))
        if (event?.eventKey && Date.parse(event.occurredAt) >= cutoff) stored.push(event)
        else safeRemove(key)
    }
    const unique = new Map<string, AnalyticsPayload>()
    for (const event of [...stored, ...memoryOutbox.values()]) {
        if (Date.parse(event.occurredAt) >= cutoff) unique.set(event.eventKey, event)
    }
    return [...unique.values()]
        .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))
        .slice(-MAX_OUTBOX_EVENTS)
}

const pruneOutbox = (): void => {
    const retained = new Set(readDocsOutbox().map((event) => event.eventKey))
    for (const key of safeKeys().filter((candidate) => candidate.startsWith(OUTBOX_STORAGE_PREFIX))) {
        try {
            const eventKey = decodeURIComponent(key.slice(OUTBOX_STORAGE_PREFIX.length))
            if (!retained.has(eventKey)) safeRemove(key)
        } catch { safeRemove(key) }
    }
    for (const eventKey of memoryOutbox.keys()) {
        if (!retained.has(eventKey)) memoryOutbox.delete(eventKey)
    }
}

const enqueue = (payload: AnalyticsPayload): void => {
    const key = outboxKey(payload.eventKey)
    if (safeGet(key) !== null || memoryOutbox.has(payload.eventKey)) return
    memoryOutbox.set(payload.eventKey, payload)
    safeSet(key, JSON.stringify(payload))
    pruneOutbox()
}

const acknowledge = (eventKey: string): void => {
    memoryOutbox.delete(eventKey)
    safeRemove(outboxKey(eventKey))
}

const credentialsFor = (
    payload: AnalyticsPayload,
): Pick<AuthenticatedAnalyticsPayload, 'authToken' | 'initData'> => {
    // Credentials are attached only in memory at send time. If a shared
    // browser switched actor after enqueue, the old event remains anonymous
    // instead of being attributed to the new account.
    if (getSession().id !== payload.sessionId) return {}
    return {
        authToken: bounded(safeGet(TOKEN_STORAGE_KEY), 4096),
        initData: telegramInitData(),
    }
}

export const sanitizeDocsMeta = (
    eventId: DocsEventId,
    meta: Record<string, string>,
): Record<string, string> | undefined => {
    const allowed = new Set(EVENT_META_KEYS[eventId])
    const out: Record<string, string> = {}
    for (const [key, raw] of Object.entries(meta)) {
        if (!allowed.has(key)) continue
        const value = raw.trim().slice(0, MAX_META_VALUE_LENGTH)
        if (!value) continue
        if (key === 'referrerHost'
            && !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(value)) {
            continue
        }
        if (['depth', 'engagedMs', 'maxDepth', 'sequence'].includes(key) && !/^\d+$/.test(value)) continue
        if (key === 'value' && !/^-?\d+(?:\.\d+)?$/.test(value)) continue
        if (key === 'reason' && !/^[a-z][a-z0-9_-]{0,63}$/.test(value)) continue
        if (key === 'message' && !/^[a-z][a-z0-9_-]{0,63}$/.test(value)) continue
        out[key] = value
    }
    return Object.keys(out).length ? out : undefined
}

let flushPromise: Promise<void> | undefined
export const flushDocsOutbox = (useBeacon = false): Promise<void> => {
    if (useBeacon) {
        if (typeof navigator.sendBeacon === 'function') {
            for (const payload of readDocsOutbox()) {
                const authenticated: AuthenticatedAnalyticsPayload = {
                    ...payload,
                    ...credentialsFor(payload),
                }
                navigator.sendBeacon(ENDPOINT, new Blob(
                    [JSON.stringify(authenticated)],
                    { type: 'application/json' },
                ))
            }
        }
        // No application-level acknowledgement exists. Retain every event for
        // an idempotent retry, even when a concurrent fetch is already active.
        return Promise.resolve()
    }
    if (flushPromise) return flushPromise
    flushPromise = (async () => {
        for (const payload of readDocsOutbox()) {
            const authenticated: AuthenticatedAnalyticsPayload = {
                ...payload,
                ...credentialsFor(payload),
            }
            const body = JSON.stringify(authenticated)
            try {
                const response = await fetch(ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                    keepalive: true,
                    credentials: 'include',
                })
                if ((response.ok || (response.status >= 400 && response.status < 500)) && response.status !== 429) {
                    acknowledge(payload.eventKey)
                }
                if (response.status === 429 || response.status >= 500) break
            } catch { break }
        }
    })().finally(() => { flushPromise = undefined })
    return flushPromise
}

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

    const session = getSession()
    const pageContext = options.pageContext ?? getDocsPageContext()
    const { targetUrl, ...rawMeta } = meta
    const payload: AnalyticsPayload = {
        eventId,
        eventVersion: EVENT_VERSION,
        eventKind: EVENT_KINDS[eventId],
        occurredAt: new Date(now).toISOString(),
        eventKey: randomId(),
        anonymousId: session.anonymousId,
        sessionId: session.id,
        sessionStartedAt: new Date(session.firstSeenAt).toISOString(),
        pageViewId: pageContext.pageViewId,
        surface: 'docs',
        routeId: pageContext.routeId,
        page: pageContext.page,
        targetUrl: sanitizeTarget(targetUrl),
        releaseSha: import.meta.env.VITE_BUILD_SHA?.slice(0, 64),
        language: document.documentElement.lang || navigator.language,
        isImpersonated: actorContext().impersonated || undefined,
        firstTouchUtmSource: session.firstTouch.utm?.source,
        firstTouchUtmMedium: session.firstTouch.utm?.medium,
        firstTouchUtmCampaign: session.firstTouch.utm?.campaign,
        firstTouchUtmContent: session.firstTouch.utm?.content,
        firstTouchUtmTerm: session.firstTouch.utm?.term,
        firstTouchLandingPage: session.firstTouch.landingPage,
        firstTouchStartParam: session.firstTouch.startParam,
        firstTouchReferrer: session.firstTouch.referrerHost,
        firstTouchGclid: session.firstTouch.clickIds?.gclid,
        firstTouchYclid: session.firstTouch.clickIds?.yclid,
        firstTouchFbclid: session.firstTouch.clickIds?.fbclid,
        firstTouchTtclid: session.firstTouch.clickIds?.ttclid,
        sessionTouchUtmSource: session.sessionTouch.utm?.source,
        sessionTouchUtmMedium: session.sessionTouch.utm?.medium,
        sessionTouchUtmCampaign: session.sessionTouch.utm?.campaign,
        sessionTouchUtmContent: session.sessionTouch.utm?.content,
        sessionTouchUtmTerm: session.sessionTouch.utm?.term,
        sessionTouchLandingPage: session.sessionTouch.landingPage,
        sessionTouchStartParam: session.sessionTouch.startParam,
        sessionTouchReferrer: session.sessionTouch.referrerHost,
        sessionTouchGclid: session.sessionTouch.clickIds?.gclid,
        sessionTouchYclid: session.sessionTouch.clickIds?.yclid,
        sessionTouchFbclid: session.sessionTouch.clickIds?.fbclid,
        sessionTouchTtclid: session.sessionTouch.clickIds?.ttclid,
        meta: sanitizeDocsMeta(eventId, rawMeta),
    }
    enqueue(payload)
    if (!options.deferFlush) void flushDocsOutbox()
}

export const classifyExitFrom = (href: string | null, currentUrl: string): DocsEventId | null => {
    if (!href || href.startsWith('#')) return null
    if (href.startsWith('tg://')) return DocsEvent.ExitToTelegram
    try {
        const url = new URL(href, currentUrl)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
        if (url.hostname === 't.me' || url.hostname === 'telegram.me') return DocsEvent.ExitToTelegram
        const currentHost = new URL(currentUrl).hostname
        if (url.hostname !== 'darebay.com' && url.hostname !== currentHost) return DocsEvent.ExitExternal
        return isContentPath(url.pathname) ? null : DocsEvent.ExitToSite
    } catch { return null }
}

export const classifyExit = (href: string | null): DocsEventId | null => classifyExitFrom(href, window.location.href)

let installed = false
export const installDocsAnalytics = (): void => {
    if (typeof window === 'undefined' || installed) return
    installed = true
    document.addEventListener('click', (event) => {
        const anchor = (event.target as HTMLElement | null)?.closest?.('a')
        if (!anchor) return
        const exit = classifyExit(anchor.getAttribute('href'))
        if (exit) trackDocsEvent(exit, { targetUrl: anchor.href })
    }, { capture: true })
    window.addEventListener('online', () => void flushDocsOutbox())
    void flushDocsOutbox()
}

export const resetDocsAnalyticsForTests = (): void => {
    memoryIdentity = undefined
    memoryFirstTouch = undefined
    memorySession = undefined
    memoryOutbox.clear()
    currentPageContext = undefined
    recentSends.clear()
    flushPromise = undefined
    installed = false
    for (const key of safeKeys()) {
        if (key.startsWith(OUTBOX_STORAGE_PREFIX)) safeRemove(key)
    }
}
