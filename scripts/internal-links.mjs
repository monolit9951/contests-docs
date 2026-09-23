// Internal link hygiene of the BUILT site: what a crawler actually receives, not what a template
// meant to emit. Pure functions over HTML strings; `dist-seo-gates.mjs` applies them to `dist`,
// `internal-links.test.mjs` pins them on small documents.
//
// The invariant here is about the link equity that stays inside darebay.com:
//
//  1. NO INTERNAL NOFOLLOW. `rel="nofollow"` tells a crawler not to pass anything through a link.
//     On a citation of a competitor's terms page that is the point; on a link to our own page it
//     throws away the one ranking signal we fully control. It shipped: the comparison templates
//     cited our own pages ("darebay.com/en/help/what-commission") with the same
//     `rel="nofollow noopener" target="_blank"` as every external source — 604 anchors on 36 pages
//     (crawl of 2026-09-23). The templates now go through `sourceAnchor` (links.ts); this is the
//     check that no other path brings the attribute back.

/** The site's own host. Its subdomains are ours too: a nofollow to dev.darebay.com is as wrong. */
export const SITE_HOST = 'darebay.com'

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
