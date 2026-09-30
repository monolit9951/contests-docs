// The weight budget of a showcase hub index (`showcase: true`, LandingLayout.vue), read off the
// built HTML by the dist gates (`showcase-weight` in dist-seo-gates.mjs).
//
// A showcase index is the page a first visit from search lands on, and from Russian networks one
// HTTP/2 connection to the host stalls after about 100 KB (the TSPU, measured 2026-09-27/28: median
// 102 KB, p10 68 KB). The shell alone costs about 63 KB of every document before the page's own
// markup (inlined CSS, head, site data), so the whole document stays within 85 KB as the container
// sends it (gzip level 1, nginx.conf: no `gzip_comp_level`, so nginx's default). That is the hard
// ceiling, and it counts every byte. And the page fetches nothing to draw itself: no picture,
// video, frame or embed; its drawings are inline SVG (art.ts).
//
// Inside that ceiling the page's own markup (hero, Markdown, blocks) keeps to 40 KB raw: the copy a
// landing writes stays a landing's. Its two data listings are not counted there: the tools
// catalogue (`<section id="tools">`, LTools.vue, drawn from data/tools.json) and the section's
// catalogue of articles (`<div class="lp-bleed lp-catalog">`, LCatalog.vue, drawn from the
// manifest). Both grow with their data, and their markup repeats card after card, so raw bytes
// overstate what they cost on the wire: measured 2026-09-30 on /instrumenty/, 39 tool cards are
// 45 KB raw and add 9.9 KB to the document at gzip level 1. The phase-1 decision base set exactly
// this split (BRIEF G16: the 40 KB is the target, the 85 KB on the wire the ceiling); held to 40 KB
// raw, the Russian catalogue of 39 tools could not ship at all.
//
// THE WIRE IS MEASURED WITH THE REFERENCE ZLIB, the one nginx links (zlib 1.3.1 on the host and in
// the nginx:alpine container), through pako 2.1.0, its line-by-line JavaScript port. Node's own
// `zlib` is Chromium's fork (`1.3.0.1-motley`): its level 1 finds different matches, and on these
// pages it came out 2.3-4.0 % smaller than what nginx sends (and 1 % larger on a few). Checked
// 2026-09-30 against three live documents fetched with `Accept-Encoding: gzip`:
//   /zarabotok/                            wire 71 680 B = pako 71 680, node:zlib 70 010
//   /zarabotok/kak-delat-narezki           wire 72 986 B = pako 72 986, node:zlib 71 057
//   /en/earnings/best-clipping-platforms   wire 116 831 B = pako 116 831, node:zlib 113 346
// and on all 255 documents of that day's build pako equalled the system zlib (python3 `zlib`)
// byte for byte. With node:zlib the gate passed /instrumenty/ at 85 129 B while nginx sent 87 982 B,
// over the ceiling. pako 3 is not a drop-in: it reproduces node:zlib, not nginx, which is why the
// version is pinned exactly and `showcase-weight.test.mjs` pins a size only the reference zlib gives.

import pako from 'pako'

export const SHOWCASE_BUDGET = Object.freeze({ mainBytes: 40 * 1024, wireBytes: 85 * 1024, wireLevel: 1 })

/** The bytes nginx sends for `html` at gzip `level`: the reference zlib, gzip framing included. */
export const wireBytes = (html, level = SHOWCASE_BUDGET.wireLevel) => pako.gzip(html, { level }).length

/** Whether a built page is a showcase hub index: its hero carries the showcase class. */
export const isShowcase = (html) => /<section\b[^>]*\bclass="[^"]*\blp-hero--show\b/.test(html)

/** The page's own markup: its one `<main>` element, or '' without one. */
const mainOf = (html) => html.match(/<main\b[\s\S]*?<\/main>/)?.[0] ?? ''

/** How each data listing opens (see the header): the tools catalogue, the section's catalogue. */
const LISTINGS = [/<section id="tools"[\s>]/, /<div class="lp-bleed lp-catalog"[\s>]/]

/** The element that opens at `start`, through its balanced closing tag. */
const elementAt = (html, start) => {
  const name = html.slice(start + 1).match(/^[a-z]+/i)[0]
  const tags = new RegExp(`<(/?)${name}\\b[^>]*>`, 'gi')
  tags.lastIndex = start
  let depth = 0
  for (let match; (match = tags.exec(html)); ) {
    depth += match[1] ? -1 : 1
    if (depth === 0) return html.slice(start, match.index + match[0].length)
  }
  return html.slice(start)
}

/** The data listings a `<main>` holds, as markup. */
export const listingsOf = (main) => LISTINGS.flatMap((opening) => {
  const start = main.search(opening)
  return start < 0 ? [] : [elementAt(main, start)]
})

/** Every way a showcase page breaks its budget, as a sentence each. Empty for any other page. */
export function showcaseWeightFindings(html, budget = SHOWCASE_BUDGET) {
  if (!isShowcase(html)) return []
  const findings = []
  const main = mainOf(html)
  const listings = listingsOf(main)
  const ownBytes = Buffer.byteLength(main) - listings.reduce((sum, listing) => sum + Buffer.byteLength(listing), 0)
  if (ownBytes > budget.mainBytes) findings.push(`<main> is ${ownBytes} bytes of the page's own markup (its catalogues aside), the budget is ${budget.mainBytes}`)
  const wire = wireBytes(html, budget.wireLevel)
  if (wire > budget.wireBytes) findings.push(`the document is ${wire} bytes at gzip level ${budget.wireLevel}, the budget is ${budget.wireBytes}`)
  const media = [...new Set((main.match(/<(img|picture|video|audio|iframe|embed|object)\b/gi) ?? []).map((tag) => tag.slice(1).toLowerCase()))]
  if (media.length) findings.push(`<main> fetches media (${media.join(', ')}): draw with inline SVG or CSS instead`)
  return findings
}
