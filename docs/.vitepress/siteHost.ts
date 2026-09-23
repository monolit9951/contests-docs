// Which hosts are this site. One rule, read by both sides of the link contract:
//
//  * `links.ts` (`sourceAnchor`) turns an address on these hosts into a plain relative link in the
//    reader's language, and cites every other host as somebody else's page (`nofollow`, new tab);
//  * `scripts/internal-links.mjs` (the `check:dist` gate) fails the build on a `nofollow` link to
//    these hosts.
//
// Two copies of the rule disagreed once: the gate counted every *.darebay.com host as ours while the
// helper counted only the apex and www, so a comparison source on a subdomain would have come out of
// the helper `nofollow` and failed the release on a link no template could render any other way.
// Keeping the rule here keeps the two in lockstep; `scripts/internal-links.test.mjs` checks that
// every anchor the helper renders passes the gate.
//
// darebay.com and its www alias are ours. A subdomain is another origin (the dev.darebay.com preview
// of this same site is noindex): a link to it cannot be made relative, and nothing of ours is lost
// by citing it like any other site. Plain TypeScript with no imports: the gate loads it through
// `node --experimental-strip-types`.

/** The host the site is served from. */
export const SITE_HOST = 'darebay.com'

/** Whether `hostname` (as `URL#hostname` spells it) is this site: darebay.com or www.darebay.com. */
export const isSiteHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return host === SITE_HOST || host === `www.${SITE_HOST}`
}
