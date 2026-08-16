import { DocsEvent, flushDocsOutbox, trackDocsEvent } from './analytics'

const DEPTH_MILESTONES = [25, 50, 75, 100] as const
const MIN_REPORTABLE_MS = 1000
const IDLE_MS = 30_000
const HEARTBEAT_MS = 15_000

interface PageEngagement {
    activeMs: number
    emittedMs: number
    lastTick: number
    lastInteraction: number
    visible: boolean
    focused: boolean
    maxDepth: number
    reached: Set<number>
    sequence: number
}

let state: PageEngagement | null = null
let listenersInstalled = false
let scrollQueued = false
let heartbeat: number | undefined

export const computeDepth = (articleTop: number, articleHeight: number, viewportHeight: number): number => {
    if (articleHeight <= 0) return 100
    const seen = viewportHeight - articleTop
    if (seen <= 0) return 0
    if (seen >= articleHeight) return 100
    return Math.round((seen / articleHeight) * 100)
}

const articleElement = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('.vp-doc')
    ?? document.querySelector<HTMLElement>('.content-container')
    ?? document.querySelector<HTMLElement>('main')

const now = (): number => performance.now()

const accrue = (at = now()): void => {
    if (!state) return
    const safeNow = Math.max(at, state.lastTick)
    if (state.visible && state.focused) {
        const activeEnd = Math.min(safeNow, state.lastInteraction + IDLE_MS)
        if (activeEnd > state.lastTick) state.activeMs += activeEnd - state.lastTick
    }
    state.lastTick = safeNow
}

const interact = (): void => {
    if (!state) return
    const at = now()
    accrue(at)
    state.lastInteraction = at
}

const sampleDepth = (): void => {
    if (!state) return
    const el = articleElement()
    if (!el) return
    const rect = el.getBoundingClientRect()
    const depth = computeDepth(rect.top, rect.height, window.innerHeight)
    state.maxDepth = Math.max(state.maxDepth, depth)

    for (const milestone of DEPTH_MILESTONES) {
        if (state.maxDepth < milestone || state.reached.has(milestone)) continue
        state.reached.add(milestone)
        trackDocsEvent(DocsEvent.ReadDepth, { depth: String(milestone) }, { dedupeKey: String(milestone) })
    }
}

export const flushEngagement = (reason: string, deferFlush = false): void => {
    if (!state) return
    accrue()
    const engagedMs = Math.round(state.activeMs - state.emittedMs)
    if (engagedMs < MIN_REPORTABLE_MS) return
    state.emittedMs = state.activeMs
    state.sequence += 1
    trackDocsEvent(
        DocsEvent.ReadTime,
        {
            engagedMs: String(engagedMs),
            maxDepth: String(state.maxDepth),
            sequence: String(state.sequence),
            reason,
        },
        { dedupeKey: String(state.sequence), deferFlush },
    )
}

const onVisibilityChange = (): void => {
    if (!state) return
    accrue()
    state.visible = document.visibilityState === 'visible'
    if (state.visible) state.lastInteraction = now()
    else flushEngagement('visibility_hidden')
}

const onFocus = (): void => {
    if (!state) return
    accrue()
    state.focused = true
    state.lastInteraction = now()
}

const onBlur = (): void => {
    if (!state) return
    accrue()
    state.focused = false
    flushEngagement('blur')
}

const onPageHide = (): void => {
    if (state) {
        accrue()
        state.visible = false
    }
    flushEngagement('pagehide', true)
    void flushDocsOutbox(true)
}

const onPageShow = (event: PageTransitionEvent): void => {
    if (!state || !event.persisted) return
    const at = now()
    state.lastTick = at
    state.lastInteraction = at
    state.visible = document.visibilityState === 'visible'
    state.focused = document.hasFocus()
}

const onScrollOrResize = (): void => {
    interact()
    if (scrollQueued) return
    scrollQueued = true
    requestAnimationFrame(() => {
        scrollQueued = false
        sampleDepth()
    })
}

const installListeners = (): void => {
    if (listenersInstalled) return
    listenersInstalled = true
    window.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize, { passive: true })
    for (const event of ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const) {
        window.addEventListener(event, interact, { passive: true, capture: true })
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
}

export const startPageEngagement = (): void => {
    if (typeof window === 'undefined') return
    const startedAt = now()
    state = {
        activeMs: 0,
        emittedMs: 0,
        lastTick: startedAt,
        lastInteraction: startedAt,
        visible: document.visibilityState === 'visible',
        focused: document.hasFocus(),
        maxDepth: 0,
        reached: new Set(),
        sequence: 0,
    }
    installListeners()
    if (heartbeat !== undefined) window.clearInterval(heartbeat)
    heartbeat = window.setInterval(() => flushEngagement('heartbeat'), HEARTBEAT_MS)
    requestAnimationFrame(sampleDepth)
}
