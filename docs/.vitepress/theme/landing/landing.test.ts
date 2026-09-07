import { readFileSync } from 'node:fs'
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
