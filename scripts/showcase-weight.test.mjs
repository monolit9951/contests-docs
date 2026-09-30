import { describe, expect, it } from 'vitest'
import { SHOWCASE_BUDGET, isShowcase, listingsOf, showcaseWeightFindings, wireBytes } from './showcase-weight.mjs'

const hero = '<section class="lp-hero lp-hero--hub lp-hero--show"><h1>x</h1></section>'
const page = (main, head = '') => `<!doctype html><html><head>${head}</head><body><main id="main-content">${main}</main></body></html>`

// Incompressible text (a fixed pseudo-random sequence over 64 characters) defeats gzip the way a
// heavy page does.
const noise = (length) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let text = ''
  for (let index = 0, state = 1; index < length; index++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0
    text += alphabet[(state >>> 16) & 63]
  }
  return text
}

// The two data listings the way LTools.vue and LCatalog.vue render them: nested groups included.
const card = (n) => `<article class="lp-tool"><div class="lp-tool-h"><h4>Сервис ${n}</h4></div><p>Монтаж на телефоне и в браузере, субтитры и озвучка текста.</p><dl><div><dt>Цена</dt><dd>от $15 в месяц</dd></div></dl></article>`
const tools = (cards) => `<section id="tools" class="lp-bleed lp-section lp-tools"><h2>Каталог</h2><div id="tools-results"><section id="tools-editing" class="lp-tgroup"><h3>Монтаж</h3><div class="lp-tgrid">${Array.from({ length: cards }, (_, n) => card(n)).join('')}</div></section></div></section>`
const catalog = (entries) => `<div class="lp-bleed lp-catalog"><section class="hub-directory"><div><div>${'<a href="/kontent-zavod/x">Статья раздела</a>'.repeat(entries)}</div></div></section></div>`

// Stylesheet-like text, the bulk of every document (the CSS is inlined): repeated selectors and
// declarations, the matches where the two zlib builds part ways.
const stylesheetLike = (rules) => {
  const names = ['lp', 'hero', 'tool', 'card', 'grid', 'flow', 'tile', 'phone', 'cta', 'btn', 'chip', 'meta', 'faq', 'setup', 'band', 'mono']
  const props = ['display: grid', 'gap: 12px', 'padding: 22px', 'border: 1px solid var(--lp-line)', 'border-radius: 22px', 'font-size: 14px', 'line-height: 1.6', 'color: var(--lp-muted)', 'margin-block-start: 8px', 'background: var(--lp-panel)', 'min-width: 0', 'align-items: center']
  let state = 11
  const next = () => (state = (Math.imul(state, 1103515245) + 12345) >>> 0) >>> 16
  return Array.from({ length: rules }, () => `.${names[next() % 16]}-${names[next() % 16]} .${names[next() % 16]} { ${Array.from({ length: 2 + (next() % 4) }, () => props[next() % 12]).join('; ')}; }`).join('\n')
}

describe('the wire measure', () => {
  // The size nginx sends: reference zlib 1.3.1, level 1, gzip framing. 11 224 is what the system
  // zlib gives for this text (python3 `zlib.compressobj(1, DEFLATED, 31)`, 2026-09-30); node:zlib 22,
  // Chromium's fork, gave 10 597. A compressor swapped for one that does not match nginx (node:zlib,
  // pako 3) fails here before it can pass a page the wire would refuse (showcase-weight.mjs).
  it('counts the bytes nginx sends, not what Node\'s own zlib would', () => {
    const text = stylesheetLike(800)
    expect(Buffer.byteLength(text)).toBe(73_217)
    expect(wireBytes(text)).toBe(11_224)
  })
})

describe('the showcase weight budget', () => {
  it('reads only showcase hub indexes', () => {
    expect(isShowcase(page(hero))).toBe(true)
    expect(isShowcase(page('<section class="lp-hero lp-hero--hub"><h1>x</h1></section>'))).toBe(false)
    // The class in the inlined stylesheet is not the page's hero.
    expect(isShowcase(page('<h1>x</h1>', '<style>.lp-hero--show{padding:0}</style>'))).toBe(false)
    expect(showcaseWeightFindings(page(`<img src="a.png">${'x'.repeat(50_000)}`))).toEqual([])
  })

  it('accepts a page within its budget', () => {
    expect(showcaseWeightFindings(page(`${hero}<p>${'Контент-завод. '.repeat(500)}</p>`))).toEqual([])
  })

  it('refuses own markup over 40 KB and a document over 85 KB on the wire', () => {
    const big = `${hero}<p>${'a'.repeat(SHOWCASE_BUDGET.mainBytes)}</p>`
    expect(showcaseWeightFindings(page(big)).join('\n')).toMatch(/<main> is \d+ bytes of the page's own markup \(its catalogues aside\), the budget is 40960/)
    expect(showcaseWeightFindings(page(hero, `<style>${noise(150_000)}</style>`)).join('\n')).toMatch(/at gzip level 1, the budget is 87040/)
  })

  // A data listing's markup repeats card after card: its raw bytes say little about the wire, which
  // the second budget counts in full. The page's own copy keeps its 40 KB (BRIEF G16).
  it('leaves the catalogues to the wire budget and holds the copy around them to 40 KB', () => {
    const listings = `${tools(120)}${catalog(400)}`
    expect(Buffer.byteLength(listings)).toBeGreaterThan(SHOWCASE_BUDGET.mainBytes)
    expect(listingsOf(`<main>${hero}${listings}<h2>FAQ</h2></main>`)).toEqual([tools(120), catalog(400)])
    expect(showcaseWeightFindings(page(`${hero}${listings}<p>Частые вопросы.</p>`))).toEqual([])
    // The copy around the listings still counts: the listings do not buy it room.
    const copy = `<p>${'a'.repeat(SHOWCASE_BUDGET.mainBytes)}</p>`
    expect(showcaseWeightFindings(page(`${hero}${tools(120)}${copy}`)).join('\n')).toMatch(/<main> is \d+ bytes of the page's own markup/)
    // A listing that does cost the wire its bytes fails there, catalogue or not.
    const heavy = `<section id="tools" class="lp-bleed lp-section lp-tools"><p>${noise(120_000)}</p></section>`
    expect(showcaseWeightFindings(page(`${hero}${heavy}`))).toEqual([expect.stringMatching(/at gzip level 1, the budget is 87040/)])
  })

  it('refuses anything the page would fetch to draw itself', () => {
    expect(showcaseWeightFindings(page(`${hero}<img src="/x.png" alt=""><iframe src="https://x.example/"></iframe>`))).toEqual([
      '<main> fetches media (img, iframe): draw with inline SVG or CSS instead',
    ])
  })
})
