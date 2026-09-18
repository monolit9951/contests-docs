import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(import.meta.dirname, 'landing.css'), 'utf8')
const ruleFor = (selectorFragment: string) =>
  css.split('\n').filter((line) => line.startsWith('.') && line.includes(selectorFragment))

/**
 * VitePress styles Markdown output through `.vp-doc`. Every page here renders in the landing
 * shell instead, so anything the Markdown pipeline can emit is unstyled until this file claims
 * it — and unstyled does not mean "plain", it means broken: a code block with no box stuck to
 * the left edge of the window and stretched the document to 1627px on three pages.
 */
describe('landing shell owns what Markdown emits', () => {
  it('gives VitePress code blocks a box and puts the scroll on pre', () => {
    const container = ruleFor('div[class*="language-"]')
    expect(container.length).toBeGreaterThan(0)
    // The box holds the width; `pre` scrolls inside it. Scrolling the container instead would
    // repeat the table bug: sections of a wide element sized independently of each other.
    expect(container.some((rule) => rule.includes(' pre {') && rule.includes('overflow-x: auto'))).toBe(true)
    expect(container.some((rule) => /width:\s*min\(/.test(rule))).toBe(true)
  })

  it('never gives thead or tbody their own table box', () => {
    // Two table boxes run the column algorithm separately, and the header labels drift off the
    // cells they name. This shipped on the country-by-country tables.
    for (const rule of css.split('\n').filter((line) => /^\.lp-content[^{]*(thead|tbody)/.test(line))) {
      expect(rule).not.toMatch(/display:\s*table\b/)
    }
  })

  it('lets the header fall into rows on a narrow screen', () => {
    // Logo + language switcher + CTA need ~525px in one row; below that the header used to push
    // the whole document sideways on every page of the corpus.
    const narrow = css.slice(css.indexOf('@media (max-width: 640px)'))
    expect(narrow).toContain('.lp-header-in')
    expect(narrow).toMatch(/\.lp-header-in\s*{[^}]*flex-wrap:\s*wrap/)
  })
})

/**
 * The same shell renders the right-to-left Arabic tree (`<html dir="rtl">`). A logical property
 * (`margin-inline-start`, `text-align: start`, `inset-inline-start`) mirrors with the page and is
 * its physical twin in a left-to-right one, so the Russian, Ukrainian and English pages render
 * exactly as they did. A physical `left`/`right` does not mirror: the sticky platform column
 * stuck to the wrong edge, list markers on the wrong side, the calculator divider between the
 * wrong halves. Direction-specific exceptions live in the `[dir='rtl']` block, never as physical
 * sides.
 */
describe('landing shell mirrors for a right-to-left tree', () => {
  const physical =
    /(?:^|[\s;{"])(?:(?:margin|padding|border)-(?:left|right)(?:-[a-z]+)?|left|right|float)\s*:|text-align\s*:\s*(?:left|right)\b/

  it('styles with logical properties, never physical left or right', () => {
    expect(css.split('\n').filter((line) => physical.test(line))).toEqual([])
  })

  it('keeps the inline styles of the components logical too', () => {
    const dir = import.meta.dirname
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.vue'))) {
      const source = readFileSync(join(dir, file), 'utf8')
      for (const [, style] of source.matchAll(/style="([^"]*)"/g)) expect(`${file}: ${style}`).not.toMatch(physical)
    }
  })

  it('isolates data inside Arabic lines and keeps code left to right', () => {
    const rtl = css.slice(css.indexOf('right-to-left (Arabic)'))
    expect(rtl).toMatch(/\[dir='rtl'\] \.lp :is\([^)]*\.lp-calc-val[^)]*\btime\)/)
    // A table cell holds a whole phrase: forced left to right, an Arabic one reads backwards.
    expect(rtl).not.toMatch(/\[dir='rtl'\][^{]*\.lp-money/)
    expect(rtl).toMatch(/unicode-bidi: isolate/)
    expect(rtl).toMatch(/\[dir='rtl'\] \.lp-content div\[class\*="language-"\] \{ direction: ltr; \}/)
    // Tracking pulls a cursive script apart.
    expect(rtl).toMatch(/\.lp:lang\(ar\)[^{]*\{ letter-spacing: normal/)
  })
})
