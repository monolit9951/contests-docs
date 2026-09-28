// Head assets whose shape depends on the page, shared by config.ts (which writes them),
// scripts/dist-seo-gates.mjs (which checks the built HTML) and the unit tests.

import type { Locale } from './registry'

export const FONT_DIR = '/content-assets/fonts'

/**
 * The font files each tree preloads: the ones its first screen cannot paint without.
 *
 * A subset file only covers its `unicode-range` (public/content-assets/fonts/*.css), and the
 * `latin` subset is also where the space, the digits and ASCII punctuation live. So a Russian
 * or Ukrainian hero headline in Unbounded needs the cyrillic file AND the latin one, while an
 * English page needs latin only. Every page used to preload Unbounded latin and Manrope cyrillic
 * whatever its language: the file a Cyrillic headline actually waits for was discovered late,
 * and English and Arabic pages fetched a Cyrillic body face they never render. The Arabic tree
 * has no display preload at all — landing.css sets its display face to Manrope, because
 * Unbounded has no Arabic — and its body text needs Manrope only for Latin names and digits.
 * latin-ext is never preloaded: 118 KB for the odd accented letter.
 */
export const FONT_PRELOADS: Record<Locale, readonly string[]> = {
  ru: ['manrope-400-cyrillic.woff2', 'unbounded-var-cyrillic.woff2', 'unbounded-var-latin.woff2'],
  uk: ['manrope-400-cyrillic.woff2', 'unbounded-var-cyrillic.woff2', 'unbounded-var-latin.woff2'],
  en: ['manrope-400-latin.woff2', 'unbounded-var-latin.woff2'],
  ar: ['manrope-400-latin.woff2'],
}

export const fontPreloadHrefs = (language: Locale): string[] =>
  FONT_PRELOADS[language].map((file) => `${FONT_DIR}/${file}`)

/** The preloads as VitePress head tags, for `frontmatter.head`. */
export const fontPreloadTags = (language: Locale): [string, Record<string, string>][] =>
  fontPreloadHrefs(language).map((href) => [
    'link',
    { rel: 'preload', href, as: 'font', type: 'font/woff2', crossorigin: '' },
  ])

/**
 * VitePress links `/vp-icons.css` from every page as a render-blocking stylesheet (the literal
 * line in its renderPage). The file holds the CSS of the iconify icons named in `socialLinks`;
 * ours is an inline SVG, so it is empty and the link costs a request on the critical path for
 * nothing. The file is still written — old cached HTML asks for it, and the host routes it
 * (CONTENT_ROOT_FILES in registry.ts) — and dist-seo-gates.mjs fails the build if it ever has
 * rules: they would go inline with the bundle (`inlineStylesheets`), never back into a link.
 */
export const VP_ICONS_LINK = /\n?[ \t]*<link rel="preload stylesheet" href="\/vp-icons\.css" as="style">/

export const stripVpIconsLink = (html: string): string => html.replace(VP_ICONS_LINK, '')

/**
 * VitePress's link to its CSS bundle, the literal line of its renderPage with the site's base '/'.
 * `inlineStylesheets` removes it; headAssets.test.ts holds it to what the installed VitePress writes.
 */
export const STYLE_BUNDLE_LINK = /\n?[ \t]*<link rel="preload stylesheet" href="(\/content-assets\/style\.[\w-]+\.css)" as="style">/

/**
 * The @font-face files: Manrope (every tree's body face) and Unbounded (the display face). The site
 * head links Manrope and every page's head links Unbounded, so `docs:dev` — which runs no
 * `transformHtml` — still has its fonts; the build carries their rules inline instead.
 */
export const FONT_FACE_STYLESHEETS: readonly string[] = [`${FONT_DIR}/manrope.css`, `${FONT_DIR}/unbounded.css`]

/** Every url() target of a stylesheet, whether quoted with either quote or bare. */
export const cssUrls = (css: string): string[] =>
  [...css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^'"\s)][^)]*?))\s*\)/g)].map((match) => (match[1] ?? match[2] ?? match[3] ?? '').trim())

/**
 * A url() that means the same inside a page as in a linked file: a root-relative path, a scheme
 * (`data:`, `https:`) or a fragment (an SVG's own `#id`, percent-encoded inside a data: url). A path
 * relative to the stylesheet would resolve against the page's address once the rules sit in the page.
 */
export const ABSOLUTE_URL = /^(\/|#|%23|[a-z][a-z0-9+.-]*:)/i

/** A head tag VitePress renders from `['link', { rel: 'stylesheet', href }]`, with its line. */
const stylesheetLinkLine = (href: string): RegExp =>
  new RegExp(`\\n?[ \\t]*<link rel="stylesheet" href="${href.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}">`)

/**
 * Where VitePress's renderPage ends the head and starts the body. The styles go right before it: the
 * first `</head>` of the file is not always the head's end, because the meta description and the
 * JSON-LD carry page text unescaped, and a literal "</head>" in either would have taken the styles.
 */
export const HEAD_END = '\n  </head>\n  <body>'

/**
 * The head tags that start a request of their own: the app's module script, the module preloads of
 * its chunks and the font preloads. `inlineStylesheets` moves them behind the styles, so the preload
 * scanner of a throttled connection meets them only once the document has delivered its CSS.
 */
export const REQUEST_TAG = /\n?[ \t]*(<script type="module" src="\/content-assets\/[^"]+\.js"><\/script>|<link rel="modulepreload" href="\/content-assets\/[^"]+\.js">|<link rel="preload" href="\/content-assets\/fonts\/[^"]+\.woff2" as="font" type="font\/woff2" crossorigin="">)/g

/**
 * Every page carries its stylesheets inside the document instead of linking them.
 *
 * In Russia the TSPU freezes an HTTP/2 connection to this host after about 100 KB (nginx
 * `prod.access.json.log`, 23–26.09.2026: median 102 KB, p10 68 KB); whatever is still in flight then
 * hangs until nginx's 60-second `send_timeout`. A page came as a 35–42 KB document followed by three
 * render-blocking stylesheets — the 37 KB bundle and the two @font-face files — that shared the rest
 * of that budget with ~210 KB of scripts and ~96 KB of preloaded fonts. The document arrived, the
 * bundle did not, and the inline theme script behind the pending stylesheet held the parser in
 * <head>: no body at all, a blank screen for a minute. On 24–28.09 a quarter to a third of the
 * readers Yandex sent to these pages never got the bundle, and a reader who goes back to the results
 * is what a search engine counts. Inside the document the styles arrive with it: scripts and fonts
 * may still hang (text then shows in a fallback face, `font-display: swap`), the page no longer does.
 *
 * The head ends as: every meta tag, the canonical, hreflang and JSON-LD (link unfurlers read only the
 * first kilobytes of a page; Slack stops at 32 KB), then the styles (~155 KB of text), then the
 * REQUEST_TAG tags. Every link to the bundle and to the @font-face files goes; the files are still
 * written and served, for HTML cached before this change. `read(href)` returns a built file's text.
 * A page without the bundle link is left as it is — the `inline-css` dist gate fails any built page
 * that still links a stylesheet or does not end its head this way.
 */
export const inlineStylesheets = (html: string, read: (href: string) => string): string => {
  const bundle = html.match(STYLE_BUNDLE_LINK)?.[1]
  if (bundle === undefined) return html
  const css = (href: string): string => {
    const text = read(href)
    // A literal closing tag inside the text would end the <style> element early.
    if (/<\/style/i.test(text)) throw new Error(`inlineStylesheets: ${href} contains "</style"`)
    return text
  }
  const styles = `<style>${css(bundle)}</style><style>${FONT_FACE_STYLESHEETS.map(css).join('\n')}</style>`
  const end = html.indexOf(HEAD_END)
  if (end < 0 || html.indexOf(HEAD_END, end + 1) >= 0) throw new Error('inlineStylesheets: expected exactly one end of <head>')
  let head = html.slice(0, end).replace(STYLE_BUNDLE_LINK, '')
  for (const href of FONT_FACE_STYLESHEETS) head = head.replace(stylesheetLinkLine(href), '')
  const moved: string[] = []
  head = head.replace(REQUEST_TAG, (_line: string, tag: string) => {
    moved.push(tag)
    return ''
  })
  return `${head}\n    ${styles}${moved.map((tag) => `\n    ${tag}`).join('')}${html.slice(end)}`
}
