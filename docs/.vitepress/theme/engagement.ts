// Reading engagement for the docs — the two numbers a content site is
// actually judged on, and the two the beacon did not have.
//
// `docs_page_view` alone cannot tell a page that earns its search position
// from a page that people bounce off in two seconds: both are one row. These
// add how far down the article the reader got, and how long the tab was really
// in front of them, so the fleet's output can be ranked by whether it is read
// rather than by whether it was served.

import { DocsEvent, trackDocsEvent } from './analytics'

const DEPTH_MILESTONES = [25, 50, 75, 100] as const
/** Under a second is a bounce or a mis-click, not a read worth a row. */
const MIN_REPORTABLE_MS = 1000
/**
 * A tab left open on an article for a working day would otherwise report the
 * working day. Visibility already excludes background tabs; this caps the
 * foreground-but-abandoned case (reader walks away, screen stays on).
 */
const MAX_REPORTABLE_MS = 30 * 60 * 1000

interface PageEngagement {
    /** Engaged ms accumulated since the last flush. */
    activeMs: number
    /** When the tab last became visible, or null while it is hidden. */
    resumedAt: number | null
    maxDepth: number
    reached: Set<number>
}

let state: PageEngagement | null = null
let listenersInstalled = false
let scrollQueued = false

/**
 * Share of the ARTICLE the reader has seen, 0..100.
 *
 * Deliberately not "share of the document": every VitePress page ends with the
 * outline, the platform CTA, the prev/next pager and the footer, so a reader
 * who stopped halfway through the text can still sit at 100% of the scroll
 * height. Measured as how far the BOTTOM of the viewport has travelled through
 * the article body — the standard reading-progress definition.
 *
 * @param articleTop  article's top edge relative to the viewport (rect.top)
 */
export const computeDepth = (articleTop: number, articleHeight: number, viewportHeight: number): number => {
    // A zero-height article (or a layout we could not measure) is not something
    // a reader can be partway through. Treat it as fully seen rather than
    // reporting a permanent 0 that would drag every average down.
    if (articleHeight <= 0) return 100
    const seen = viewportHeight - articleTop
    if (seen <= 0) return 0
    if (seen >= articleHeight) return 100
    return Math.round((seen / articleHeight) * 100)
}

/** The rendered markdown, not the page chrome. */
const articleElement = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('.vp-doc') ??
    document.querySelector<HTMLElement>('.content-container') ??
    document.querySelector<HTMLElement>('main')

const accrue = (): void => {
    if (!state || state.resumedAt === null) return
    const now = Date.now()
    state.activeMs += now - state.resumedAt
    state.resumedAt = now
}

const sampleDepth = (): void => {
    if (!state) return
    const el = articleElement()
    if (!el) return
    const rect = el.getBoundingClientRect()
    const depth = computeDepth(rect.top, rect.height, window.innerHeight)
    if (depth > state.maxDepth) state.maxDepth = depth

    for (const milestone of DEPTH_MILESTONES) {
        if (state.maxDepth < milestone || state.reached.has(milestone)) continue
        state.reached.add(milestone)
        // A reader who hits End crosses all four inside the same second, and
        // the 1s throttle is keyed by event id — without the milestone as the
        // dedupe key only the 25 would ever be recorded.
        trackDocsEvent(DocsEvent.ReadDepth, { depth: String(milestone) }, { dedupeKey: String(milestone) })
    }
}

/**
 * Send the engaged time banked so far and reset the accumulator.
 *
 * Additive on purpose: one read can produce several rows (tab hidden, tab back,
 * page closed), because a beacon owed at the end of the session is a beacon
 * that often never gets sent — phones background a tab and never fire
 * `pagehide`. The dashboard sums `dwellMs` per page; `maxDepth` is a running
 * maximum, so the last row of a page carries the final answer.
 */
export const flushEngagement = (reason: string): void => {
    if (!state) return
    accrue()
    const dwellMs = Math.min(state.activeMs, MAX_REPORTABLE_MS)
    state.activeMs = 0
    if (dwellMs < MIN_REPORTABLE_MS) return
    trackDocsEvent(
        DocsEvent.ReadTime,
        { dwellMs: String(dwellMs), maxDepth: String(state.maxDepth), reason },
        { dedupeKey: reason },
    )
}

const onVisibilityChange = (): void => {
    if (!state) return
    if (document.visibilityState === 'hidden') {
        accrue()
        state.resumedAt = null
        flushEngagement('hidden')
    } else {
        state.resumedAt = Date.now()
    }
}

const onPageHide = (): void => {
    if (!state) return
    accrue()
    state.resumedAt = null
    flushEngagement('unload')
}

const onScrollOrResize = (): void => {
    if (scrollQueued) return
    scrollQueued = true
    requestAnimationFrame(() => {
        scrollQueued = false
        sampleDepth()
    })
}

/**
 * Listeners are global and read the mutable page state, so they are attached
 * once for the lifetime of the tab — a VitePress route change swaps the state,
 * not the listeners.
 */
const installListeners = (): void => {
    if (listenersInstalled) return
    listenersInstalled = true
    window.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    // `pagehide`, not `beforeunload`: it also fires when a phone backgrounds
    // the tab, and it does not disqualify the page from the bfcache.
    window.addEventListener('pagehide', onPageHide)
}

/** Begin (or restart, on SPA navigation) measuring the current page. */
export const startPageEngagement = (): void => {
    if (typeof window === 'undefined') return
    state = {
        activeMs: 0,
        resumedAt: document.visibilityState === 'visible' ? Date.now() : null,
        maxDepth: 0,
        reached: new Set(),
    }
    installListeners()
    // A page shorter than the viewport is fully read on arrival and will never
    // fire a scroll event. The new route's DOM is not laid out yet on the
    // microtask after navigation, so measure on the next frame.
    requestAnimationFrame(sampleDepth)
}
