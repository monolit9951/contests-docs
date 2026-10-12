// Git-derived reader-visible changes own the page's update date. Source snapshots
// keep their own dates even when an article is edited after the sources were checked.
export interface PageDates { readonly published: string; readonly modified: string }

export const modifiedDay = (dates?: PageDates | null): string | null =>
  dates?.modified?.slice(0, 10) ?? null

export const visibleUpdatedDate = (frontmatter: {
  updated?: string | null; isHub?: boolean; showcase?: boolean
}): string | null =>
  frontmatter.isHub && frontmatter.showcase ? null : frontmatter.updated ?? null
