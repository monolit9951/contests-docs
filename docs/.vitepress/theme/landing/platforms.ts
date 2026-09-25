// Typed access to data/platforms.json. One file feeds every comparison page in
// every locale, so a number is refreshed in one place and cannot disagree
// between pages. Each field carries its own source URL and date.
import raw from '../../data/platforms.json'
import { sourceAnchor } from '../../links'
import { textDirectionOf, type Locale } from '../../registry'

export type Localized = Record<Locale, string>
export interface Source { url: string; date: string }
export interface Field {
  /** display text per locale; empty string = not published */
  text: Partial<Localized>
  /** sortable number where it makes sense (rate min, threshold, cap, fee %, min payout) */
  value?: number | null
  /** yes | no | partial | unknown — for tri-state columns like `cis`, `escrow`, `followers` */
  state?: 'yes' | 'no' | 'partial' | 'unknown'
  source?: Source
}
export interface Platform {
  id: string
  name: string
  url: string
  home?: Partial<Localized>
  kind: string
  founded?: string
  operator?: string
  bestFor: Partial<Localized>
  summary: Partial<Localized>
  fields: Record<string, Field>
  pros: Partial<Record<Locale, string[]>>
  cons: Partial<Record<Locale, string[]>>
}
export interface PlatformsData { snapshot: string; platforms: Platform[] }

/** The columns a comparison table shows when its frontmatter names none. */
export const DEFAULT_COLUMNS = ['rate', 'threshold', 'cap', 'fee', 'minPayout', 'payoutMethods', 'cis', 'followers', 'escrow']

/**
 * Per-country columns: cited only by the page that asks for one.
 *
 * `sourcesOf` rolls a platform's whole fine print into one numbered list, which is right for the
 * eleven fields every comparison page is built on — a reader checking the rate is one click from
 * the page the threshold came from too. These eight are different. Each answers one regional
 * page's one question ("does it pay in Nigeria"), there are eight of them per platform, and the
 * twenty pages that will never print the column would otherwise carry up to eight more rows in
 * "how this comparison was built" for claims they do not make. So a regional field's source enters
 * the roll-up only when the page renders that column, and `sourcesOf(p)` with no argument is what
 * it always was: every field except these.
 *
 * Keep this in sync with the `columns` labels in `copy.ts` — a key here with no label prints the
 * raw key as a table heading.
 */
export const REGION_FIELDS: readonly string[] = ['india', 'pakistan', 'bangladesh', 'nigeria', 'kenya', 'mena', 'indonesia', 'philippines']

/**
 * Page-only columns: the same opt-in as REGION_FIELDS for the source roll-up, without its other
 * promise. A regional column exists on every platform (the per-country tests hold each one to a
 * state, a source and English text); a page-only column exists on the platforms of the page that
 * asked for it. `payoutSpeed` — when the money arrives, as a short phrase, with the typical days as
 * `value` where the platform states them — was read for the English roundup of 21 platforms. No
 * other comparison page prints that column, and its source would otherwise be a row in their "how
 * this comparison was built" for a claim they never make.
 *
 * Keep this in sync with the `columns` labels in `copy.ts`, as for REGION_FIELDS.
 */
export const PAGE_ONLY_FIELDS: readonly string[] = ['payoutSpeed']

/** A column whose source is cited only by a page that renders it: a regional or a page-only one. */
export const optIn = (key: string): boolean => REGION_FIELDS.includes(key) || PAGE_ONLY_FIELDS.includes(key)

export const DATA = raw as PlatformsData
/**
 * The "Updated" date a comparison page prints: its own `hero.updated` when its figures were re-read
 * after the catalog snapshot, otherwise the snapshot itself. The hero and "how this comparison was
 * built" both show it, so the two can never disagree on one page.
 */
export const comparisonUpdated = (frontmatter: { hero?: { updated?: string } | null }): string =>
  frontmatter.hero?.updated ?? DATA.snapshot
export const byId = (id: string): Platform | undefined => DATA.platforms.find((p) => p.id === id)
export const pick = (ids: string[]): Platform[] => ids.map(byId).filter((p): p is Platform => Boolean(p))
export const text = (p: Platform, field: string, lang: Locale): string => p.fields[field]?.text?.[lang] ?? p.fields[field]?.text?.en ?? ''
/** The language `text()` answered in: the page's own when the field has it, English when it fell back. */
export const textLang = (p: Platform, field: string, lang: Locale): Locale =>
  p.fields[field]?.text?.[lang] !== undefined ? lang : 'en'
/**
 * Attributes for a value written in `valueLang` on a page in `pageLang` — only when the two run in
 * opposite directions. An English fallback inside an Arabic table has to be laid out as an English
 * run: left to the Arabic line around it, "$1–$2 per 1,000 views" comes out as "per 1,000 views
 * $2–$1" and a closing period jumps to the front. Same-direction values get nothing, so the
 * left-to-right trees render exactly the markup they rendered before Arabic existed.
 */
export const bidiAttrs = (valueLang: Locale, pageLang: Locale): { lang?: Locale; dir?: 'ltr' | 'rtl' } =>
  textDirectionOf(valueLang) === textDirectionOf(pageLang) ? {} : { lang: valueLang, dir: textDirectionOf(valueLang) }
/** What a source opens on a page in `locale`, or its url as written when no page is named. */
const addressOf = (url: string, locale?: Locale): string => (locale === undefined ? url : sourceAnchor(url, locale).href)
/**
 * One entry per source of a platform, in the order its fields declare them.
 *
 * `shown` is the fields the calling page renders; it only ever admits regional and page-only
 * columns, never removes anything else, so a page that shows none of them gets the list it got
 * before either existed.
 *
 * `locale` is the language of the page that prints the list. Two sources are one entry when they
 * open the same address there: our own pages are cited in whichever language a number was read
 * in, and `sourceAnchor` sends the reader to their own version, so on an English page the Russian
 * "DareBay in numbers" and its English original both open /en/about/darebay-at-a-glance — listed
 * separately, one address was printed twice. The entry kept is the first field's, exactly as when
 * two fields cite one url. Without `locale` the key is the url as written.
 */
export const sourcesOf = (p: Platform, shown: readonly string[] = [], locale?: Locale): Source[] => {
  const seen = new Map<string, Source>()
  for (const [key, f] of Object.entries(p.fields)) {
    if (optIn(key) && !shown.includes(key)) continue
    if (!f.source?.url) continue
    const address = addressOf(f.source.url, locale)
    if (!seen.has(address)) seen.set(address, f.source)
  }
  return [...seen.values()]
}
/**
 * Stable index of a source inside a platform, for superscript references: the number of the entry
 * of `sourcesOf(p, shown, locale)` that opens the same address, so a table cell and the list it
 * points at always agree.
 */
export const sourceIndex = (p: Platform, url: string, shown: readonly string[] = [], locale?: Locale): number => {
  const address = addressOf(url, locale)
  return sourcesOf(p, shown, locale).findIndex((s) => addressOf(s.url, locale) === address) + 1
}
/**
 * The source list of "How this comparison was built" (`LMethod`): every source of every platform on
 * the page, platform by platform, each numbered within its platform. `n` is the number the table
 * prints in that platform's row (`sourceIndex` with the same columns and language: both count the
 * same `sourcesOf` list), so "[3]" in the ClipGrow row is "ClipGrow [3]" here. The list printed no
 * numbers until 2026-09-24, and a table "[3]" read as text pointed at nothing, or at the article's
 * own "[3]" in its Sources list, which is a different source. The count restarts per platform
 * because the table numbers each platform's own sources; one running count down the list would
 * disagree with every row after the first.
 */
export const methodSources = (
  platforms: readonly Platform[],
  shown: readonly string[],
  locale: Locale
): (Source & { name: string; n: number })[] =>
  platforms.flatMap((p) => sourcesOf(p, shown, locale).map((s, k) => ({ name: p.name, n: k + 1, ...s })))
