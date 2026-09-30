// Decorative pictures of the showcase hubs: the hero drawing of each section and the line icons of
// the feature tiles. Inline SVG, never an image file: nothing to request, nothing to lose on a
// throttled connection, and it scales with the text. Every picture is `aria-hidden` (LHero.vue,
// LFeatures.vue) and says nothing the page does not say in words; it carries no text, no number
// and no logo.
//
// Build-time only: config.ts hands a page the pictures it shows as page data (`landingArt` in
// landingFrontmatter.ts), so this module never reaches the theme chunk every page downloads.
// `showcase.test.ts` holds the budget (a hero drawing at most 2.5 KB) and that motion runs only for
// readers who have not asked for less.

// The dashed lines "flow" from the start of each path to its end, three runs and then they rest:
// motion that goes on for more than five seconds needs a way to pause it (WCAG 2.2.2), and a loop
// repainted the drawing forever on a weak laptop. The animation lives inside the drawing, so a page
// without one carries none of it.
const FLOW_STYLE =
  '<style>.lp-hero-art .lf{stroke-dasharray:3 7;stroke-width:1.6}@media (prefers-reduced-motion:no-preference){.lp-hero-art .lf{animation:lp-art-flow 1.4s linear 3}}@keyframes lp-art-flow{to{stroke-dashoffset:-20}}</style>'

const SVG_OPEN = '<svg viewBox="0 0 420 280" fill="none" stroke-linecap="round" stroke-linejoin="round" focusable="false">'

// Content farm: one task feeds several accounts, each with its own version of the clip, their
// views meet in one counter, and the counter pays into one wallet (gold: money). The versions differ
// by layout, not only by tint: the second is a split screen, the third carries a caption over the
// frame. DareBay's own measurement (docs/instrumenty/unikalizator-video.md) found that colour and
// speed leave a copy a copy, and a split screen does not; the picture must not teach the tint.

const FARM =
  SVG_OPEN +
  FLOW_STYLE +
  '<defs><g id="lp-art-phone"><rect width="46" height="76" rx="11" fill="#0c0f15" stroke="#f5f7fa" stroke-opacity=".2"/><rect x="5" y="9" width="36" height="58" rx="6" fill="currentColor" fill-opacity=".16"/><path d="M19 29v13l11-6.5z" fill="currentColor"/><rect x="10" y="53" width="22" height="3.5" rx="1.75" fill="currentColor" fill-opacity=".75"/><rect x="10" y="59" width="14" height="3.5" rx="1.75" fill="currentColor" fill-opacity=".35"/></g></defs>' +
  '<path class="lf" stroke="#c8f542" d="M102 140C136 140 134 52 168 52M102 140H168M102 140C136 140 134 228 168 228M214 52C246 52 244 140 276 140M214 140H276M214 228C246 228 244 140 276 140M338 140H356"/>' +
  '<rect x="10" y="92" width="92" height="96" rx="18" fill="#10131a" stroke="#f5f7fa" stroke-opacity=".14"/><rect x="26" y="108" width="28" height="28" rx="9" fill="#c8f542"/><path d="M36 115.5v13l10.5-6.5z" fill="#131807"/><rect x="26" y="148" width="60" height="7" rx="3.5" fill="#f5f7fa" fill-opacity=".32"/><rect x="26" y="162" width="38" height="7" rx="3.5" fill="#f5f7fa" fill-opacity=".16"/>' +
  '<use href="#lp-art-phone" x="168" y="14" color="#c8f542"/><use href="#lp-art-phone" x="168" y="102" color="#46d4ff"/><use href="#lp-art-phone" x="168" y="190" color="#4b7bff"/>' +
  '<rect x="173" y="146" width="36" height="23" rx="5" fill="#1c2331"/><rect x="178" y="156" width="26" height="4" rx="2" fill="#46d4ff" fill-opacity=".5"/><rect x="176" y="204" width="30" height="4" rx="2" fill="#f5f7fa" fill-opacity=".8"/>' +
  '<rect x="276" y="98" width="62" height="84" rx="18" fill="#10131a" stroke="#f5f7fa" stroke-opacity=".14"/><path d="M291 124s5.5-9 16-9 16 9 16 9-5.5 9-16 9-16-9-16-9Z" stroke="#f5f7fa" stroke-opacity=".8" stroke-width="1.6"/><circle cx="307" cy="124" r="3.2" fill="#f5f7fa"/><path d="M293 166v-7M302 166v-11M311 166v-15M320 166v-20" stroke="#c8f542" stroke-width="4"/>' +
  '<rect x="356" y="110" width="56" height="60" rx="14" fill="#10131a" stroke="#f7c95f" stroke-opacity=".7"/><path d="M356 126h56" stroke="#f7c95f" stroke-opacity=".3"/><circle cx="384" cy="148" r="10" fill="#f7c95f"/><circle cx="384" cy="148" r="5" stroke="#131807" stroke-opacity=".45" stroke-width="1.6"/>' +
  '</svg>'

// Tools: the kit around one reel. Editing, captions and voice on one side, AI, versions and timing
// on the other, all running into the vertical video in the middle.
const CYAN = '#46d4ff'
const TILES: readonly (readonly [number, number, string])[] = [
  [22, 20, '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>'],
  [22, 114, '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 10.3a2.3 2.3 0 1 0 0 3.4M16.5 10.3a2.3 2.3 0 1 0 0 3.4"/>'],
  [22, 208, '<path d="M3 12h1M7 8v8M11 5v14M15 9v6M19 7v10"/>'],
  [344, 20, '<path stroke="#c8f542" d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9ZM19 15.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8Z"/>'],
  [344, 114, '<path d="M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5"/>'],
  [344, 208, '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'],
]
const TOOLS =
  SVG_OPEN +
  FLOW_STYLE +
  `<path class="lf" stroke="${CYAN}" d="M76 47C126 47 124 112 172 112M76 141H172M76 235C126 235 124 170 172 170M344 47C294 47 296 112 248 112M344 141H248M344 235C294 235 296 170 248 170"/>` +
  `<g fill="#10131a" stroke="#f5f7fa" stroke-opacity=".14">${TILES.map(([x, y]) => `<rect x="${x}" y="${y}" width="54" height="54" rx="16"/>`).join('')}</g>` +
  `<g stroke="${CYAN}" stroke-width="1.8">${TILES.map(([x, y, icon]) => `<g transform="translate(${x + 15} ${y + 15})">${icon}</g>`).join('')}</g>` +
  `<rect x="172" y="62" width="76" height="156" rx="18" fill="#0c0f15" stroke="#f5f7fa" stroke-opacity=".2"/><rect x="178" y="72" width="64" height="136" rx="11" fill="${CYAN}" fill-opacity=".13"/><path d="M200 124v26l22-13z" fill="${CYAN}"/><rect x="186" y="176" width="48" height="5" rx="2.5" fill="#f5f7fa" fill-opacity=".75"/><rect x="194" y="186" width="32" height="5" rx="2.5" fill="#f5f7fa" fill-opacity=".4"/><rect x="186" y="198" width="48" height="3" rx="1.5" fill="#f5f7fa" fill-opacity=".14"/><rect x="186" y="198" width="30" height="3" rx="1.5" fill="#c8f542"/>` +
  '</svg>'

// Line icons of the feature tiles, drawn on a 24px grid in the tile's accent (`currentColor`).
const ICONS: Readonly<Record<string, string>> = {
  views: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  sale: '<path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  persona: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  setup: '<path d="M3 7l9-4 9 4v10l-9 4-9-4V7Z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  copies: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  accounts: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a6.5 6.5 0 0 1 3.5 6.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  calc: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  team: '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2.2"/><circle cx="19" cy="10" r="2.2"/><path d="M7 20a5 5 0 0 1 10 0M1.5 19a3.6 3.6 0 0 1 5-3.3M22.5 19a3.6 3.6 0 0 0-5-3.3"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9.5h8M8 12.5h5"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 13.5h2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/><path d="M8.5 12l2.5 2.5L16 9.5"/>',
  store: '<path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  tools: '<path d="M14.5 6.5a4 4 0 0 0-5 5L3 18l3 3 6.5-6.5a4 4 0 0 0 5-5l-2.5 2.5-3-3 2.5-2.5Z"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M19 15.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8Z"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5L10 9.5Z"/>',
  captions: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 10.3a2.3 2.3 0 1 0 0 3.4M16.5 10.3a2.3 2.3 0 1 0 0 3.4"/>',
  telegram: '<path d="M21 4 3 11l6 2 2 6 3-4 5 4 2-15Z"/><path d="m9 13 8-6"/>',
}

/** The icon names a feature tile may ask for (`features.items[].icon`). */
export const ICON_NAMES: readonly string[] = Object.keys(ICONS)

const icon = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths}</svg>`

/** Every picture by name: `farm` and `tools` for a hero, `i-<name>` for a tile icon. */
export const ART: Readonly<Record<string, string>> = {
  farm: FARM,
  tools: TOOLS,
  ...Object.fromEntries(Object.entries(ICONS).map(([name, paths]) => [`i-${name}`, icon(paths)])),
}
