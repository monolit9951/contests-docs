// The site-root links of a Markdown source, as `check-registry.mjs` judges them (gate 6c).

/**
 * Every `](/path)` link of a Markdown source, by its path alone: without a query or a fragment, as
 * VitePress's own dead-link check judges it. The registration link `/tasks?auth=signup` is the task
 * catalogue with the sign-up dialog open (`ctaHref('signup', …)` in links.ts), not an address of its
 * own, and `/zarabotok/x#y` is the page `/zarabotok/x`.
 */
export const rootLinkPaths = (markdown) => [...markdown.matchAll(/\]\((\/[^)#?\s]*)/g)].map(([, path]) => path)
