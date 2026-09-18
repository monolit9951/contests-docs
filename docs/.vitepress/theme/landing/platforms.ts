// Typed access to data/platforms.json. One file feeds every comparison page in
// every locale, so a number is refreshed in one place and cannot disagree
// between pages. Each field carries its own source URL and date.
import raw from '../../data/platforms.json'
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

export const DATA = raw as PlatformsData
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
/**
 * One entry per source url of a platform, in the order its fields declare them.
 *
 * `shown` is the fields the calling page renders; it only ever admits regional columns, never
 * removes anything else, so a page that shows none of them gets the list it got before regional
 * columns existed.
 */
export const sourcesOf = (p: Platform, shown: readonly string[] = []): Source[] => {
  const seen = new Map<string, Source>()
  for (const [key, f] of Object.entries(p.fields)) {
    if (REGION_FIELDS.includes(key) && !shown.includes(key)) continue
    if (f.source?.url && !seen.has(f.source.url)) seen.set(f.source.url, f.source)
  }
  return [...seen.values()]
}
/** stable index of a source url inside a platform, for superscript references */
export const sourceIndex = (p: Platform, url: string, shown: readonly string[] = []): number =>
  sourcesOf(p, shown).findIndex((s) => s.url === url) + 1
