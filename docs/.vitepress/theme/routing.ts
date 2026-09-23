// Which addresses this container routes itself, and which belong to the application.

import { CONTENT_SEGMENTS } from '../registry'

/**
 * The address with each run of slashes merged into one: the path nginx matched (merge_slashes)
 * when it served this document for `//zarabotok/page` or `/zarabotok//page`, canonical included.
 * VitePress routes neither spelling. It reads a leading `//` as a protocol-relative host (it would
 * route `/page` and draw its 404 view over the article) and has no page for `hub//page`.
 */
export const mergeSlashes = (pathname: string): string => pathname.replace(/\/{2,}/g, '/')

/** A path this container serves: a content hub, in any declared locale (see registry.ts). */
export const isContentPathname = (pathname: string, segments: readonly string[] = CONTENT_SEGMENTS): boolean =>
    segments.some((segment) => pathname === `/${segment}` || pathname.startsWith(`/${segment}/`))

/**
 * Whether a client route change to `to` must leave for the application (a real page load)
 * instead of being routed by VitePress. Anything outside the content hubs is the application.
 *
 * Never on the first route change of a document: that one is the document's own load
 * (VitePress's client entry calls `router.go()` with the current address), and "leaving" for
 * the address the browser has just loaded reloads the page, which does the same again — a
 * reload loop. It happens only where this container answers an address outside its hubs,
 * `vitepress preview` serving 404.html for any unknown path (the host never routes such an
 * address here in production), and there VitePress's 404 view is the right answer.
 */
export const leavesForApplication = (
    to: string,
    base: string,
    firstRoute: boolean,
    segments?: readonly string[],
): boolean => {
    if (firstRoute) return false
    let pathname: string
    try { pathname = new URL(to, base).pathname } catch { return false }
    return !isContentPathname(pathname, segments)
}
