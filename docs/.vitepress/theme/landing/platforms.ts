// Typed access to data/platforms.json. One file feeds every comparison page in
// every locale, so a number is refreshed in one place and cannot disagree
// between pages. Each field carries its own source URL and date.
import raw from '../../data/platforms.json'
import type { Locale } from '../../registry'

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

export const DATA = raw as PlatformsData
export const byId = (id: string): Platform | undefined => DATA.platforms.find((p) => p.id === id)
export const pick = (ids: string[]): Platform[] => ids.map(byId).filter((p): p is Platform => Boolean(p))
export const text = (p: Platform, field: string, lang: Locale): string => p.fields[field]?.text?.[lang] ?? p.fields[field]?.text?.en ?? ''
export const sourcesOf = (p: Platform): Source[] => {
  const seen = new Map<string, Source>()
  for (const f of Object.values(p.fields)) if (f.source?.url && !seen.has(f.source.url)) seen.set(f.source.url, f.source)
  return [...seen.values()]
}
/** stable index of a source url inside a platform, for superscript references */
export const sourceIndex = (p: Platform, url: string): number => sourcesOf(p).findIndex((s) => s.url === url) + 1
