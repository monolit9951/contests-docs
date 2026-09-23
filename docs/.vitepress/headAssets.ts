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
 * rules while the link is gone.
 */
export const VP_ICONS_LINK = /\n?[ \t]*<link rel="preload stylesheet" href="\/vp-icons\.css" as="style">/

export const stripVpIconsLink = (html: string): string => html.replace(VP_ICONS_LINK, '')
