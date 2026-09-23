// Which addresses this container routes itself, and which belong to the application.

import { CONTENT_SEGMENTS } from '../registry'

/** A path this container serves: a content hub, in any declared locale (see registry.ts). */
export const isContentPathname = (pathname: string, segments: readonly string[] = CONTENT_SEGMENTS): boolean =>
    segments.some((segment) => pathname === `/${segment}` || pathname.startsWith(`/${segment}/`))
