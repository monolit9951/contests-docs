import { appPathFor, appSectionOf, localesOf, pagePath, PAGES, type Locale } from './registry'

// Single source of truth for the outbound links the docs site owns: the product itself, the
// business page, the Telegram channel and the founder's own Telegram. The product has one explicit
// route per locale. Keeping the route here — instead of scattering bare `https://darebay.com` links
// through the theme — prevents a reader from being thrown back into Russian when they leave an
// EN/UK article.
//
// Which application tree a docs locale leads into is the registry's call (`appPathFor`): the same
// language where the application has it, English where it does not — an Arabic article's buttons
// open the English interface. The addresses below are that one rule applied, not a table per
// language that could say otherwise.
//
// TELEGRAM is the channel, not the bot: `@darebay_app_bot` is the mini-app entry point and belongs
// in product surfaces, not in a docs "follow us" slot.
export const HOMEPAGE = 'https://darebay.com'
export const TELEGRAM = 'https://t.me/darebay_app'
/** The founder's personal Telegram: the contact a brand is sent to, and `Person.sameAs`. */
export const FOUNDER_TELEGRAM = 'https://t.me/ruslanbwork'

/** Product homepage in the application tree of the current content page. */
export const productUrlForLocale = (locale: Locale): string => `${HOMEPAGE}${appPathFor(locale, '')}`

// The open-task catalogue. Every page of this corpus answers a question about earning on DareBay,
// and the reader who finished it wants the list of tasks, not the landing that sells the platform
// again. Measured 11.09: 63% of search visitors reached the app through the homepage anyway; the
// button now skips that hop.

/** Open-task catalogue in the application tree of the current content page. */
export const tasksUrlForLocale = (locale: Locale): string => `${HOMEPAGE}${appPathFor(locale, 'tasks')}`

// The brands section answers a business deciding whether to fund a task. Its reader has no use
// for the creators' catalogue: from 11.09 to 13.09 the only buttons on those pages led there, and
// the page that explains the launch and reaches the founder sat in a text link.

/** The business page in the application tree of the current content page. */
export const businessUrlForLocale = (locale: Locale): string => `${HOMEPAGE}${appPathFor(locale, 'for-business')}`

// ---------------------------------------------------------------------------
// Links the templates render to addresses they did not write: a comparison's source column, a
// platform's own site. The data (`data/platforms.json`) spells every one as a full URL, ours
// included — DareBay's row cites its own pages ("the threshold is on darebay.com/…") exactly like
// a competitor's row cites the competitor's terms. Rendering both the same way was the bug: our
// own pages went out as `rel="nofollow noopener" target="_blank"`, 604 anchors on 36 pages, and
// every EN page cited the RUSSIAN "DareBay in numbers" because that is the address the data had.
//
// So one helper decides, and every template asks it:
//   * darebay.com (or a relative address) is our own site: a plain relative link in the READER'S
//     language — the same page's version in that language when the registry has one, the address
//     as written when it does not. No nofollow, no new tab.
//   * anything else is a citation of somebody else's page: `nofollow noopener` in a new tab, as
//     before.
// `scripts/internal-links.mjs` (run by `check:dist`) fails the build on any nofollow link that
// still points at darebay.com, whichever template it came from.
// ---------------------------------------------------------------------------

/** The attributes of one rendered link; an absent attribute is not rendered (`v-bind`). */
export interface SourceAnchor {
  readonly href: string
  readonly rel?: string
  readonly target?: string
}

const SITE_HOST = new URL(HOMEPAGE).hostname

/**
 * The address of a link on our own site, origin removed (`/en/help/what-commission`), or null for
 * any other site. Relative references are ours by definition; an absolute one is ours on
 * darebay.com or www.darebay.com over http(s).
 */
export const sitePathOf = (url: string): string | null => {
  const value = url.trim()
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value)
  if (!hasScheme && !value.startsWith('//')) return value
  try {
    const parsed = new URL(value.startsWith('//') ? `https:${value}` : value)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    if (parsed.hostname.replace(/^www\./, '') !== SITE_HOST) return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

/**
 * One of our own addresses, moved into the reader's language.
 *
 * A docs page becomes its version in `locale` when it has one (the fragment is dropped when the
 * language changes: heading anchors are slugs of translated headings) and stays as written when it
 * does not — a live page in another language beats a guessed address. An application address is
 * re-aimed at the application tree this reader is sent to (`appPathFor`). Anything else is kept.
 * `docsPage` says whether the target is a page of this site, which VitePress may route itself.
 */
export const localizedSitePath = (path: string, locale: Locale): { href: string; docsPage: boolean } => {
  if (!path.startsWith('/')) return { href: path, docsPage: false }
  const { pathname, search, hash } = new URL(path, HOMEPAGE)
  const bare = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  for (const entry of PAGES) {
    for (const language of localesOf(entry)) {
      const written = pagePath(entry, language)!
      if (written !== pathname && written.replace(/\/$/, '') !== bare) continue
      const own = pagePath(entry, locale)
      if (own === null || own === written) return { href: `${written}${search}${hash}`, docsPage: true }
      return { href: `${own}${search}`, docsPage: true }
    }
  }
  const section = appSectionOf(pathname)
  if (section !== null) return { href: `${appPathFor(locale, section)}${search}${hash}`, docsPage: false }
  return { href: path, docsPage: false }
}

/**
 * How a template renders a link to `url` on a page in `locale` — see the block comment above.
 *
 * An address outside the docs (the application, anything unknown) also gets `target="_self"`:
 * VitePress routes every same-origin `<a>` without a target inside the docs app, which for an
 * application route means its own 404. That is the same attribute every product button of the
 * site carries, and it opens nothing new.
 */
export const sourceAnchor = (url: string, locale: Locale): SourceAnchor => {
  const path = sitePathOf(url)
  if (path === null) return { href: url, rel: 'nofollow noopener', target: '_blank' }
  const { href, docsPage } = localizedSitePath(path, locale)
  return docsPage ? { href } : { href, target: '_self' }
}

/** What a source list prints for a link: the address without its scheme, ours as the reader's version. */
export const sourceLabel = (url: string, locale: Locale): string => {
  const anchor = sourceAnchor(url, locale)
  if (anchor.rel !== undefined) return url.replace(/^https?:\/\/(www\.)?/, '')
  return anchor.href.startsWith('/') ? `${SITE_HOST}${anchor.href}` : anchor.href
}
