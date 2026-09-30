// The dist gate `hub-directory` (dist-seo-gates.mjs), as pure functions over the built markup and the
// registry's pages, so the rule is tested without a build.
//
// A hub index lists its section exactly once, whichever layout drew it: HubIndex above the Markdown,
// or LCatalog on a showcase index (after the Markdown, or where the Markdown placed it). Two lists
// double every link of the hub; none leaves its articles without their hub link. A hub with no
// article in this language has nothing to list, and a leaf lists nothing.

/** How many section catalogues (HubIndex's `<section class="hub-directory">`) a page's markup holds. */
export const sectionCatalogues = (markup) => (markup.match(/<section\b[^>]*\bclass="hub-directory"/g) ?? []).length

/** Whether a page lists its section: it is its hub's index, and the hub has an article in its language. */
export const listsSection = (page, locale, pages) =>
  page.slugs[locale] === '' && pages.some((entry) => entry.hub === page.hub && Boolean(entry.slugs[locale]))

/** What is wrong with a page's section catalogues, as a sentence, or null when nothing is. */
export function hubDirectoryFinding(markup, page, locale, pages) {
  const found = sectionCatalogues(markup)
  const expected = listsSection(page, locale, pages) ? 1 : 0
  return found === expected ? null : `${found} section catalogue(s), expected ${expected}`
}
