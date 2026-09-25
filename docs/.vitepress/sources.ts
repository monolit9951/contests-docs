// Explicit `.ts` extensions here and in everything this file imports: `check:sources` loads it with
// plain `node --experimental-strip-types`, whose resolver adds none. Vite and Vitest do add them,
// which is why the build and the tests stayed green while the manual tool could not start.
import { LANDING_COPY } from './theme/landing/copy.ts'
import { sitePathOf, sourceAnchor, sourceLabel } from './links.ts'
import { localeOfSourcePath, type Locale } from './registry.ts'

/**
 * Visible source references — the opt-in half of the citation trail.
 *
 * Every number this corpus quotes about somebody else's platform carries an invisible
 * `<!-- source: URL YYYY-MM-DD -->` comment next to the claim. That comment is the editorial
 * audit trail: it is what a reviewer greps to check where "$0.35 per 1000" came from and on
 * what day it was true. A reader sees none of it, and neither does an answer engine deciding
 * whether the page is worth quoting.
 *
 * A page that adds `sources: visible` to its frontmatter renders the same comments: a numbered
 * superscript where the claim is made, and one numbered list at the end of the article body.
 * Nothing about the comment changes — the audit trail stays the single source of truth, and the
 * flag only decides whether it is painted.
 *
 * OPT-IN BY DESIGN. Without the flag this module returns before it touches a single token, so a
 * page that does not carry it renders exactly the bytes it rendered before this file existed.
 * That is the contract the rollout depends on: the flag is enabled page by page, and every page
 * still waiting its turn must be provably untouched.
 */

/**
 * The comment shape, matched strictly.
 *
 * Strict because a page that has opted in and quietly kept a malformed comment invisible is the
 * one failure nobody would notice: the article looks finished, the superscripts renumber around
 * the gap, and the claim with no visible source is the one a reader wanted to check. So a
 * near-miss on a flagged page fails the build instead (see `installSourcesRule`). The comment is
 * left alone on every page without the flag, malformed or not — those are not this rule's
 * business.
 */
export const SOURCE_COMMENT = /<!--\s*source:\s*(\S+)\s+(\d{4}-\d{2}-\d{2})\s*-->/g

/** Anything that opens a `source:` comment, used only to catch the near-misses above. */
const SOURCE_COMMENT_OPENER = /<!--\s*source:/g

/**
 * Clipping marketplaces this corpus cites but never links to.
 *
 * A visible source list is an outbound-link surface, and these hosts are the platforms these
 * pages compete against for the same queries. Naming them keeps the claim checkable — a reader
 * can type the address in and read the same terms page we read. Linking them would hand a
 * competitor the link equity of every page that quotes its own fine print against it, on a
 * corpus whose whole point is to rank above them. So a competitor source renders as plain text:
 * same address, same date, same number, no `<a>`.
 *
 * Seeded from the comparison registry (`data/platforms.json`: whop / Whop Content Rewards, vyro,
 * clipping-net, vues, reach-cat, klipni, prime-oracles, clipping-io) plus `clipradar.co`, the
 * clipping-campaign rate board that aggregates the same offers across 18 platforms. Whop is two
 * entries because the product and its docs answer on different hosts.
 * Extended 2026-09-18 with the regional marketplaces the per-country pages cite: ClipGrow, Wondeed
 * and ClipConnect (India), both Cliptocash namesakes (.io for Africa, .com under French law),
 * ClippaPay (Nigeria), Klipbait (CIS) and Nashr (Saudi Arabia).
 * Extended again 2026-09-18 with the five Indonesian rupiah boards: Ternak Klip, Clippo, TryBuzzer, Konten.com, AyoKlip.
 * Extended 2026-09-19 with the local boards answer engines name per country: Dashrize, INDclipping, ClipAdda, Cluvi,
 * KANMITO and Reachr (India), Tsunami at sunaami.com (Pakistan), ClipperFC and Sky Kenya (Nigeria, Kenya), Wusul and
 * Clip2Earn (Arab countries); and, for the Indonesia and Philippines page, Clipink, Wefluence, Catrova, Indoclip,
 * Ternak Buzzer, Vouched and ClipFarm.
 * Extended 2026-09-24 for the English roundup of 21 platforms (`en/earnings/best-clipping-platforms`), so its trail can
 * be made visible without a live link to any board it names: Clipster, Ssemble, FindClout, Cut.Pro and Promote.fun from
 * its table (every other host of those 21 platforms was already here), and SideShift, Lumina Clippers, ClipFarm's
 * clipfarm.biz and Earnable (tryearnable.com), which its prose cites. Plus ClipAffiliates (clipaffiliates.com), the
 * board its section on other roundups names. A board added to `platforms.json` or cited only in prose is added here by
 * hand; `check:sources` prints each host of the pages it checks with the class this list gives it, so one missing from
 * here shows up as "linked".
 *
 * Matched by host, so `docs.whop.com` and `www.vyro.com` need no entry of their own. A trailing
 * `.*` means "this brand under any TLD" — `klipni.*` and `vues.*` are one small platform each and
 * would take their audience with them to another suffix; that is not a reason to start linking
 * them. When a new clipping marketplace enters the sources, add it HERE and nowhere else.
 */
export const COMPETITOR_SOURCE_HOSTS: readonly string[] = [
  'whop.com',
  'contentrewards.com',
  'klipni.*',
  'vyro.com',
  'vues.*',
  'reach.cat',
  'clipping.net',
  'clipping.io',
  'primeoracles.com',
  'clipradar.co',
  'clipgrow.in',
  'wondeed.com',
  'clipconnect.in',
  'cliptocash.io',
  'cliptocash.com',
  'klipbait.com',
  'clippapay.com',
  'nashrapp.com',
  'dashrize.com',
  'indclipping.com',
  'clipadda.com',
  'cluvi.io',
  'kanmito.com',
  'reachr.in',
  'sunaami.com',
  'clipperfc.com',
  'skycontentrewards.com',
  'wusulclips.com',
  'clip2earn.money',
  'ternakklip.com',
  'clippo.id',
  'trybuzzer.com',
  'konten.com',
  'ayoklip.com',
  'clipink.id',
  'wefluence.id',
  'catrova.com',
  'indoclip.id',
  'ternakbuzzer.id',
  'vouched.ph',
  'clipfarm.ph',
  'clipster.gg',
  'ssemble.com',
  'findclout.com',
  'cut.pro',
  'promote.fun',
  'sideshift.app',
  'luminaclippers.com',
  'clipfarm.biz',
  'tryearnable.com',
  'clipaffiliates.com',
]

/** The host as a reader would say it — what `LPlatforms.vue` already prints for the same sources. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Whether this host is one of the platforms above.
 *
 * Subdomains count (`docs.whop.com` is Whop). A `brand.*` entry matches the brand label anywhere
 * but last, so `klipni.com`, `klipni.ru` and `legal.klipni.com` all match while `notklipni.com`
 * does not. The match deliberately errs wide: over-matching costs a link we did not have to give,
 * under-matching hands a competitor a followed one.
 */
export function isCompetitorHost(hostname: string): boolean {
  const host = String(hostname).toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
  const labels = host.split('.')
  return COMPETITOR_SOURCE_HOSTS.some((entry) => {
    const pattern = entry.toLowerCase()
    if (pattern.endsWith('.*')) {
      const brand = pattern.slice(0, -2)
      return labels.indexOf(brand) >= 0 && labels.indexOf(brand) < labels.length - 1
    }
    return host === pattern || host.endsWith(`.${pattern}`)
  })
}

/**
 * How the Sources list prints a citation of this URL: `competitor` is named with no link at all,
 * `own` is one of our pages (an internal link in the reader's language), `source` is anybody else's
 * page (a `nofollow` link). `sourceItemHtml` renders exactly these three; `check:sources` prints each
 * host with its class, which is how an editor spots a clipping board that is about to be linked.
 */
export type SourceLinkClass = 'competitor' | 'own' | 'source'

export function sourceLinkClass(url: string): SourceLinkClass {
  if (isCompetitorHost(hostOf(url))) return 'competitor'
  return sitePathOf(url) === null ? 'source' : 'own'
}

/**
 * The locale a page's sources speak, from its path.
 *
 * The same rule the rest of the site uses, from the registry's one table of locale directories:
 * Russian is the unprefixed root, `ua/` is Ukrainian, `en/` English, `ar/` Arabic. Taken from the
 * path rather than from `localeIndex` so the heading is right in a unit test that has only a
 * filename, and so it cannot disagree with the address the page ships on.
 */
export function localeFromPath(path: string): Locale {
  return localeOfSourcePath(path)
}

/** «Источники» / «Джерела» / "Sources" — the label the compare cards already print. */
export function sourcesHeading(locale: Locale): string {
  return LANDING_COPY[locale].sources
}

export interface SourceRef {
  /** 1-based, in the order the page first cites the URL. */
  readonly number: number
  readonly url: string
  /** The date the claim was snapped, from the comment that introduced this URL. */
  readonly date: string
}

/**
 * Collects one numbered entry per URL, in first-citation order.
 *
 * Dedupes by URL, not by host: two different pages of the same terms site are two different
 * claims to check. A URL cited again — including with a later snapshot date, which happens when
 * an editor re-checks one claim of a page and not the others — reuses its first number and its
 * first date, so the list reads as "here is where this came from" rather than as a changelog.
 */
class SourceIndex {
  private readonly byUrl = new Map<string, SourceRef>()

  /** The number this URL has on this page, assigning it one the first time. */
  number(url: string, date: string): number {
    const known = this.byUrl.get(url)
    if (known) return known.number
    const ref: SourceRef = { number: this.byUrl.size + 1, url, date }
    this.byUrl.set(url, ref)
    return ref.number
  }

  get refs(): readonly SourceRef[] {
    return [...this.byUrl.values()]
  }
}

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * The marker that replaces the comment, pointing at the list item below.
 *
 * A hair space and a bracketed number, both inside the `<sup>`. The raised position is only
 * paint: copied, read aloud or extracted by an answer engine, a bare `1` after a figure becomes
 * its last digit — "$1–$4 per 1,000 views1", "10%1". The marker's text is " [1]", its space a
 * U+200A, so the figure keeps its own digits. LCompare.vue renders the same shape.
 *
 * The marker is set right after the claim. Editors write `claim <!-- source: … -->` with a space,
 * and that space was a line-break point outside the marker: at phone width "[11]" wrapped alone
 * onto the next line, and extracted text read "views  [1]", two gaps. So `installSourcesRule`
 * drops the spaces in front of the comment, the hair space inside the `<sup>` takes their place,
 * and `white-space: nowrap` on the `<sup>` (landing.css) keeps the marker whole.
 */
export const sourceRefHtml = (number: number): string =>
  `<sup class="src-ref">&#8202;<a href="#src-${number}">[${number}]</a></sup>`

/**
 * One list item.
 *
 * It opens with its own number as text, `<span class="src-n">[3]</span>`, the same "[3]" the marker
 * in the article prints. The number used to exist only as the list's CSS marker, and copied text,
 * `innerText`, `textContent` and every HTML-to-text extractor drop that marker: an answer engine
 * read "[3]" in a sentence and then an unnumbered list of hosts, in which one host can be items 2,
 * 10, 11 and 12. landing.css turns the CSS marker off, so the number is not printed twice.
 *
 * It names the address, not the host (`sourceLabel`, what "How this comparison was built" prints):
 * `facebook.com/business/help/1049081556813520`, not a fourth `facebook.com`. Two pages of one site
 * are two sources, and a reader, or a model, told only the host could not say which page a number
 * came from. A competitor's address is printed as text all the same, still with no link.
 *
 * `rel="nofollow noopener"` and no `target`: these are citations, not recommendations, and a
 * source list is exactly where an automated link audit would otherwise find dozens of followed
 * outbound links. No `target` because VitePress routes every same-origin `<a>` without one
 * client-side and these are all cross-origin, so the attribute would only take the reader's tab
 * away from the article they were checking.
 *
 * A citation of one of OUR pages is not an outbound link and must not be marked as one: it goes
 * through `sourceAnchor` (links.ts) like every source the comparison templates render — relative,
 * in the page's language, followed. No page cites itself today; this keeps the first one that does
 * from shipping a nofollow that `check:dist` would then reject.
 */
export function sourceItemHtml(ref: SourceRef, locale: Locale): string {
  const label = escapeText(sourceLabel(ref.url, locale))
  const kind = sourceLinkClass(ref.url)
  const own = kind === 'own' ? sourceAnchor(ref.url, locale) : null
  const target = own?.target ? ` target="${escapeAttribute(own.target)}"` : ''
  const name =
    kind === 'competitor'
      ? label
      : own
        ? `<a href="${escapeAttribute(own.href)}"${target}>${label}</a>`
        : `<a href="${escapeAttribute(ref.url)}" rel="nofollow noopener">${label}</a>`
  return `<li id="src-${ref.number}"><span class="src-n">[${ref.number}]</span> ${name} — ${escapeText(ref.date)}</li>`
}

/**
 * The block appended to the article body.
 *
 * It is the LAST thing inside the Markdown, which puts it after the whole article and before
 * "more in this section" and the product CTA — both rendered by the landing shell AFTER
 * `<Content />` (see `LandingLayout.vue`). Emitted as one HTML block rather than as a Markdown
 * heading plus list on purpose: a real heading token would enter the page outline and the anchor
 * machinery, and the numbering here has to line up with `src-N` ids, not with a slug.
 */
export function sourcesSectionHtml(refs: readonly SourceRef[], locale: Locale): string {
  const items = refs.map((ref) => sourceItemHtml(ref, locale)).join('\n')
  return [
    `<section class="db-sources" id="db-sources">`,
    `<h2>${escapeText(sourcesHeading(locale))}</h2>`,
    `<ol class="db-sources-list">`,
    items,
    `</ol>`,
    `</section>`,
    '',
  ].join('\n')
}

/**
 * Replaces every source comment in one chunk of raw HTML with its marker.
 *
 * Works on a token's content because markdown-it hands the comment over as raw HTML — one
 * `html_inline` token per comment mid-sentence (including inside a table cell), one `html_block`
 * for a comment that starts its own line, which may hold several. Rewriting token content is also
 * what keeps this off the rendered page: no pass over the finished HTML, where a `<!-- -->` inside
 * a code fence is indistinguishable from a citation.
 */
function rewriteComments(content: string, index: SourceIndex): string {
  return content.replace(SOURCE_COMMENT, (_match, url: string, date: string) =>
    sourceRefHtml(index.number(url, date))
  )
}

interface SourcesToken {
  readonly type: string
  content: string
  readonly children?: SourcesToken[] | null
}

interface SourcesState {
  readonly tokens: SourcesToken[]
  readonly env?: { readonly frontmatter?: Record<string, unknown>; readonly relativePath?: string; readonly path?: string }
  readonly Token: new (type: string, tag: string, nesting: number) => SourcesToken
}

interface MarkdownRenderer {
  readonly core: {
    readonly ruler: {
      push(ruleName: string, rule: (state: SourcesState) => void): void
    }
  }
}

/**
 * Turns the citation comments of a flagged page into visible references.
 *
 * Registered at the END of the core chain so the inline tokens are already parsed: a comment
 * inside a sentence only exists as an `html_inline` child of an `inline` token after the `inline`
 * core rule has run, and a rule that looked earlier would see the paragraph as one opaque string.
 */
export function installSourcesRule(md: MarkdownRenderer): void {
  md.core.ruler.push('darebay-visible-sources', (state) => {
    const env = state.env ?? {}
    // The whole opt-in, in one line. Everything below this point is unreachable for a page
    // without the flag, which is what makes "unflagged pages are byte-identical" a fact about
    // the code and not a hope about the tests.
    if (env.frontmatter?.sources !== 'visible') return

    const index = new SourceIndex()
    for (const token of state.tokens) {
      if (token.type === 'html_block') {
        token.content = rewriteComments(token.content, index)
        assertNoMalformedComment(token.content, env)
        continue
      }
      if (token.type !== 'inline' || !token.children) continue
      token.children.forEach((child, position, children) => {
        if (child.type !== 'html_inline') return
        const marked = rewriteComments(child.content, index)
        // One `html_inline` is one comment, so a changed token was a citation: the marker goes
        // right after the claim, and the spaces written before the comment go (`sourceRefHtml`).
        const before = children[position - 1]
        if (marked !== child.content && before?.type === 'text') before.content = before.content.replace(/[ \t]+$/, '')
        child.content = marked
        assertNoMalformedComment(child.content, env)
      })
    }

    const refs = index.refs
    // A page can carry the flag before its sources are written, and an empty «Источники» heading
    // is worse than none. `check:sources` is what reports the flag with nothing under it.
    if (!refs.length) return

    const section = new state.Token('html_block', '', 0)
    section.content = sourcesSectionHtml(refs, localeFromPath(env.relativePath ?? env.path ?? ''))
    state.tokens.push(section)
  })
}

/** See `SOURCE_COMMENT`: on a flagged page a comment that did not match is an error, not a no-op. */
function assertNoMalformedComment(content: string, env: { readonly relativePath?: string }): void {
  SOURCE_COMMENT_OPENER.lastIndex = 0
  if (!SOURCE_COMMENT_OPENER.test(content)) return
  throw new Error(
    `sources: ${env.relativePath ?? 'page'} has \`sources: visible\` and a source comment that ` +
      `is not \`<!-- source: URL YYYY-MM-DD -->\`: ${content.trim()}. ` +
      `Fix the comment or the claim it marks ships with no visible source.`
  )
}
