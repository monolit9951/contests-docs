// Internal link hygiene of the BUILT site: what a crawler actually receives, not what a template
// meant to emit. Pure functions over HTML strings; `dist-seo-gates.mjs` applies them to `dist`,
// `internal-links.test.mjs` pins them on small documents.
//
// Two invariants, both about the link equity that stays inside darebay.com:
//
//  1. NO INTERNAL NOFOLLOW. `rel="nofollow"` tells a crawler not to pass anything through a link.
//     On a citation of a competitor's terms page that is the point; on a link to our own page it
//     throws away the one ranking signal we fully control. It shipped: the comparison templates
//     cited our own pages ("darebay.com/en/help/what-commission") with the same
//     `rel="nofollow noopener" target="_blank"` as every external source — 604 anchors on 36 pages
//     (crawl of 2026-09-23). The templates now go through `sourceAnchor` (links.ts); this is the
//     check that no other path brings the attribute back.
//
//  2. NO STARVED PAGE. A page that only its hub links to is a page a crawler finds once and then
//     files as not worth indexing. The "more in this section" block used to break ties by hub
//     order, so the same early-alphabet articles were recommended everywhere and late ones by
//     nobody: /brendam/narezki-ili-reklama-chto-deshevle had exactly one editorial inbound link,
//     its hub. Every content page must now be recommended or cited by at least MIN_INBOUND other
//     content pages — counting only what a reader would call a recommendation (see
//     `editorialAnchors`), never the header menu, the language switcher, the page's own outline or
//     the hub's catalogue.

/** The site's own host. Its subdomains are ours too: a nofollow to dev.darebay.com is as wrong. */
export const SITE_HOST = 'darebay.com'

/**
 * The floor the gate holds every content page to. Two, not three: the related block recommends
 * three pages, so three would be the average and could only be met by a perfectly flat graph.
 * Raise it once the data shows it holds per topic and language.
 */
export const MIN_INBOUND = 2

const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', '#39': "'", '#x27': "'" }
const decodeEntities = (value) =>
  value.replace(/&(amp|quot|apos|lt|gt|#39|#x27);/gi, (_, name) => ENTITIES[name.toLowerCase()])

/**
 * Markup a crawler reads as markup. VitePress embeds its site data — including the footer message,
 * which holds real `<a href=…>` text — inside `<script>` as an escaped string; that is not a link on
 * the page, and neither is anything inside a comment.
 */
const markupOnly = (html) =>
  html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

const attrOf = (tag, name) => {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'))
  if (!match) return undefined
  return decodeEntities(match[1] ?? match[2] ?? match[3])
}

const tokens = (value) => String(value ?? '').toLowerCase().split(/\s+/).filter(Boolean)

/** Every `<a>` start tag of a document, with the attributes these gates read. */
export function anchorsOf(html) {
  return [...markupOnly(html).matchAll(/<a\b[^>]*>/gi)].map(([tag]) => ({
    tag,
    href: attrOf(tag, 'href'),
    rel: tokens(attrOf(tag, 'rel')),
    classes: tokens(attrOf(tag, 'class')),
    target: attrOf(tag, 'target'),
  }))
}

const isSiteHost = (hostname) => {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return host === SITE_HOST || host.endsWith(`.${SITE_HOST}`)
}

/**
 * Whether a link stays on darebay.com: any relative reference (`/x`, `x`, `#x`, `?x`) or an
 * absolute http(s) URL on darebay.com or a subdomain of it. `mailto:`, `tel:` and every other
 * scheme are not page links and are never internal.
 */
export function isInternalHref(href) {
  if (href === undefined) return false
  const value = href.trim()
  if (value.startsWith('//')) {
    try {
      return isSiteHost(new URL(`https:${value}`).hostname)
    } catch {
      return false
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    if (!/^https?:/i.test(value)) return false
    try {
      return isSiteHost(new URL(value).hostname)
    } catch {
      return false
    }
  }
  return true
}

/** Anchors that point at darebay.com and still carry `nofollow`. Each one is a finding. */
export function internalNofollowAnchors(html) {
  return anchorsOf(html).filter((anchor) => anchor.rel.includes('nofollow') && isInternalHref(anchor.href))
}

/**
 * Anchor classes that are page chrome, not a recommendation of another page: the skip link, logo
 * and header button; the breadcrumb and byline (the same two targets on every article); the
 * page's own outline and heading permalinks; the "all pages of this section" link and the hub
 * catalogue cards; the product buttons. The language switcher and the section menu live in
 * `<header>`, outside `<main>`, and never reach this filter.
 */
export const NON_EDITORIAL_CLASSES = [
  'lp-skip',
  'lp-logo',
  'lp-header-cta',
  'lp-breadcrumb',
  'lp-byline',
  'lp-outline-link',
  'header-anchor',
  'lp-more-link',
  'hub-card',
  'hub-feature',
  'lp-hero-action',
  'lp-btn',
]

/** The `<main>` element of a document (the landing shell renders exactly one), or '' without one. */
export function mainOf(html) {
  const start = html.search(/<main\b/i)
  if (start < 0) return ''
  const end = html.indexOf('</main>', start)
  return end < 0 ? html.slice(start) : html.slice(start, end)
}

/**
 * The links a page gives to other pages as content: its article body, its comparison and source
 * sections, its "more in this section" cards. Everything in `<main>` except page chrome.
 */
export function editorialAnchors(html) {
  return anchorsOf(mainOf(html)).filter(
    (anchor) =>
      anchor.href !== undefined &&
      !anchor.rel.includes('author') &&
      !anchor.classes.some((name) => NON_EDITORIAL_CLASSES.includes(name)),
  )
}

/**
 * The origin-less path an internal link lands on, as the registry spells page paths — decoded,
 * without query, fragment or a `.html` suffix — or null for an external link.
 */
export function sitePathOf(href, fromPath = '/') {
  if (!isInternalHref(href)) return null
  let url
  try {
    url = new URL(href.trim(), `https://${SITE_HOST}${fromPath}`)
  } catch {
    return null
  }
  let path
  try {
    path = decodeURI(url.pathname)
  } catch {
    path = url.pathname
  }
  return path.replace(/\/index\.html$/, '/').replace(/\.html$/, '')
}

/**
 * Who links to whom, editorially.
 *
 * `documents` are the pages whose links count — the caller passes content pages only, so a hub's
 * catalogue (which lists every page of its section by construction) and the 404 page never lend
 * anyone a link. `targets` are the page paths to count for. A path is matched with and without its
 * trailing slash; a page linking to itself does not count. Returns target → the set of distinct
 * source paths, so ten links from one page are one inbound page.
 */
export function inboundSources(documents, targets) {
  const known = new Set(targets)
  const canonical = (path) => {
    if (path === null) return null
    if (known.has(path)) return path
    const other = path.endsWith('/') ? path.slice(0, -1) : `${path}/`
    return known.has(other) ? other : null
  }
  const inbound = new Map([...known].map((target) => [target, new Set()]))
  for (const { path, html } of documents) {
    for (const anchor of editorialAnchors(html)) {
      const target = canonical(sitePathOf(anchor.href, path))
      if (target === null || target === path) continue
      inbound.get(target).add(path)
    }
  }
  return inbound
}

/**
 * The floor one page is held to. The related block recommends pages of the same hub in the same
 * language, so a page whose group has `groupSize` pages can be recommended by at most
 * `groupSize - 1` of them: an Arabic section with a single article cannot reach two, whatever the
 * tie-break does. Such a page is held to what its group CAN deliver — derived from the registry on
 * every build, never a hand-kept list of exceptions that outlives the reason for it.
 */
export function inboundFloor(groupSize, minimum = MIN_INBOUND) {
  return Math.max(0, Math.min(minimum, groupSize - 1))
}

/**
 * Applies the floor. `pages` are `{ path, group, groupSize }`; `inbound` is `inboundSources`.
 * Returns the failures (below their floor) and the exemptions actually used (below MIN_INBOUND but
 * at or above the lower floor their group size allows) — the gate prints the second list on every
 * build, with its reason, so an exemption is never a silent pass.
 */
export function inboundVerdict(pages, inbound, minimum = MIN_INBOUND) {
  const failures = []
  const exempt = []
  for (const { path, group, groupSize } of pages) {
    const count = inbound.get(path)?.size ?? 0
    const floor = inboundFloor(groupSize, minimum)
    if (count < floor) failures.push({ path, group, groupSize, count, floor })
    else if (count < minimum) exempt.push({ path, group, groupSize, count, floor })
  }
  return { failures, exempt }
}
