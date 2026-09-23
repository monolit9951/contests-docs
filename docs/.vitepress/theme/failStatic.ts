// Fail-static: when the FIRST client load of a page cannot get the page's code, keep the page
// the server rendered instead of letting VitePress turn it into the 404 view.
//
// VitePress 1.6 hydrates a page only after importing its chunk (`<page>.md.<hash>.lean.js`).
// When that import fails it fetches /hashmap.json and tries the full chunk once more; when the
// retry fails too, the router falls back to `Theme.NotFound` with `notFoundPageData`
// (client/app/router.js). The app then mounts the 404 view OVER the server-rendered article, and
// `useUpdateHead` (client/app/composables/head.js), which runs right before the mount, rewrites
// `<title>` to "404" and the description to "Not Found" (titleTemplate is false in config.ts).
// A crawler's renderer that loses one chunk request therefore records a real article as a
// textbook soft 404: a "404" heading, a "404" title and a "Not Found" snippet. Search Console
// reported two docs URLs as soft 404 on 2026-09-23 with no 4xx on any of their chunks at our
// origin (the import failed inside the renderer), so keeping old assets alone cannot fix it.
//
// The server-rendered HTML is the page. So on that one render we hydrate the markup the server
// sent as a static vnode (Vue adopts the existing DOM nodes and changes nothing) and put back
// the title and description that were served. A page whose server render IS the 404 view, or
// whose `#app` is empty (VitePress's own 404.html, the dev server), still renders as a 404.

import { isContentPathname } from './routing'

/** What the server rendered, read before the client app touches the document. */
export interface ServedPage {
    /** `document.title` as served. */
    title: string
    /** The served `<meta name="description">` content, or null when the page has none. */
    description: string | null
    /** The served `#app` markup and the number of its top-level nodes (the static vnode). */
    html: string
    nodeCount: number
    /** The server rendered this site's own 404 view (LandingLayout's `.lp-notfound`). */
    notFound: boolean
}

export const NOT_FOUND_SELECTOR = '.lp-notfound'

/**
 * The page-level metadata `transformPageData` (config.ts) writes into `frontmatter.head`.
 *
 * After a fail-static load VitePress never learned these tags belong to the page (its first
 * head update ran for the 404 data, whose frontmatter head is empty), so on the next client
 * navigation it would ADD the new page's canonical, hreflang cluster, JSON-LD and share cards
 * next to the old ones. They are removed on that navigation instead. Font preloads and
 * stylesheets are deliberately not covered: a stale one costs nothing, a removed one repaints.
 *
 * The site-wide head (config.ts `head`, og:site_name among it) must never match. VitePress does
 * not manage it on the client at all (the client site data ships `head: []`), so a site tag
 * removed here would be gone for the rest of the visit. The rules say so themselves (`except`)
 * instead of comparing with the client's site head, which is always empty.
 * failStatic.test.ts holds every tag transformPageData emits, and every site head tag, against
 * these rules.
 */
interface MetadataRule {
    tag: 'link' | 'meta' | 'script'
    attr: string
    equals?: string
    prefix?: string
    /** Values of `attr` the rule leaves alone: the site-wide tags that share a page prefix. */
    except?: readonly string[]
    /** A second attribute the tag must carry. */
    with?: string
}
const PAGE_METADATA_RULES: readonly MetadataRule[] = [
    { tag: 'link', attr: 'rel', equals: 'canonical' },
    { tag: 'link', attr: 'rel', equals: 'alternate', with: 'hreflang' },
    { tag: 'script', attr: 'type', equals: 'application/ld+json' },
    { tag: 'meta', attr: 'property', prefix: 'og:', except: ['og:site_name'] },
    { tag: 'meta', attr: 'property', prefix: 'article:' },
    { tag: 'meta', attr: 'name', prefix: 'twitter:' },
]

export const PAGE_METADATA_SELECTOR = PAGE_METADATA_RULES.map(({ tag, attr, equals, prefix, except = [], with: extra }) =>
    `${tag}[${attr}${equals !== undefined ? `="${equals}"` : `^="${prefix}"`}]${extra ? `[${extra}]` : ''}`
    + except.map((value) => `:not([${attr}="${value}"])`).join(''),
).join(', ')

/** The same rules for a VitePress head tag (`[tag, attrs, innerHTML]`), as config.ts writes it. */
export const isPageMetadataTag = ([tag, attrs = {}]: readonly [string, Record<string, string>?, string?]): boolean =>
    PAGE_METADATA_RULES.some((rule) => {
        const value = attrs[rule.attr]
        if (tag !== rule.tag || value === undefined) return false
        if (rule.with && attrs[rule.with] === undefined) return false
        if (rule.except?.includes(value)) return false
        return rule.equals !== undefined ? value === rule.equals : value.startsWith(rule.prefix ?? '')
    })

/** Sent as `client_error.message` (an existing, allowlisted property) next to `docs_not_found`. */
export const KEPT_STATIC_MESSAGE = 'docs_page_kept_static'

const ELEMENT_NODE = 1
const TEXT_NODE = 3

interface NodeLike { nodeType: number }
interface AppRootLike {
    innerHTML: string
    childNodes: ArrayLike<NodeLike>
    querySelector(selector: string): unknown
}
interface MetaLike {
    getAttribute(name: string): string | null
    setAttribute(name: string, value: string): void
}
/** The part of `document` this module reads, so the rules run in unit tests without a DOM. */
export interface DocumentLike {
    title: string
    getElementById(id: string): AppRootLike | null
    querySelector(selector: string): MetaLike | null
}

export const captureServedPage = (doc: DocumentLike): ServedPage | null => {
    const app = doc.getElementById('app')
    // VitePress writes an empty #app into its own 404.html, and `vitepress dev` renders nothing
    // on the server: there is no served page to keep.
    if (!app || app.childNodes.length === 0) return null
    // Vue adopts a static vnode only when hydration starts on an element or a text node
    // (runtime-core hydrateNode, `case Static`); anything else would be a mismatch and a
    // client re-render, which is exactly what this exists to avoid.
    const first = app.childNodes[0].nodeType
    if (first !== ELEMENT_NODE && first !== TEXT_NODE) return null
    return {
        title: doc.title,
        description: doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
        html: app.innerHTML,
        nodeCount: app.childNodes.length,
        notFound: app.querySelector(NOT_FOUND_SELECTOR) !== null,
    }
}

/**
 * Keep the served markup only when all of these hold: the server rendered a real page (not
 * the 404 view, not an empty shell), the client could not load it (the router fell back to
 * the 404 data), and the address is one this container owns.
 */
export const shouldKeepServedPage = (
    served: ServedPage | null,
    route: { isNotFound?: boolean; path: string },
    segments?: readonly string[],
): served is ServedPage =>
    Boolean(served && route.isNotFound && !served.notFound && isContentPathname(route.path, segments))

/** Undo `useUpdateHead`'s "404" / "Not Found" with the values the server sent. */
export const restoreServedHead = (doc: DocumentLike, served: ServedPage): void => {
    if (doc.title !== served.title) doc.title = served.title
    if (served.description === null) return
    const meta = doc.querySelector('meta[name="description"]')
    if (meta && meta.getAttribute('content') !== served.description) {
        meta.setAttribute('content', served.description)
    }
}

/** The served page-level metadata elements (never a site-wide tag: see PAGE_METADATA_RULES). */
export const servedPageMetadata = (doc: Pick<Document, 'head'>): Element[] =>
    [...doc.head.querySelectorAll(PAGE_METADATA_SELECTOR)]
