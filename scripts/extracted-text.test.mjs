import { describe, expect, it } from 'vitest'
import { TEXT_REGIONS, gluedTextFindings } from './extracted-text.mjs'

// The showcase blocks print figures and claims as much as a comparison table does: a tool card's
// price and its date, a phone's label and its tag, a chip's name and its count. Read as text they
// must not run together.
describe('glued text in the showcase blocks', () => {
  it('reads the blocks of a showcase landing as text regions', () => {
    for (const region of ['lp-flow', 'lp-features', 'lp-setup', 'lp-tools']) expect(TEXT_REGIONS).toContain(region)
  })

  it('finds two values run together across an element', () => {
    expect(gluedTextFindings('<section class="lp-tools"><li><a class="lp-tchip" href="#a">Монтаж <span>1</span></a></li><a class="lp-tchip" href="#b">ИИ-нарезка</a></section>')).toEqual([])
    expect(gluedTextFindings('<section class="lp-tools"><a href="#a">Монтаж <span>1</span></a><a href="#b">ИИ-нарезка</a></section>')).toEqual(['"1" runs into "ИИ-нарезка"'])
    expect(gluedTextFindings('<section class="lp-features"><div class="lp-phone"><i></i><b>копия 1</b><span>своя версия</span></div></section>')).toEqual(['"копия 1" runs into "своя версия"'])
    expect(gluedTextFindings('<section class="lp-features"><div class="lp-phone"><i></i><b>копия 1</b> <span>своя версия</span></div></section>')).toEqual([])
  })

  it('reads a price label and the date the price was checked as two values', () => {
    const card = (dt) => `<section class="lp-tools"><dl><div><dt>${dt}</dt><dd class="lp-money">от $15 в месяц</dd></div></dl></section>`
    expect(gluedTextFindings(card('Цена <a class="lp-tsrc" href="https://x.example/">на 29.09.2026</a>'))).toEqual([])
    expect(gluedTextFindings(card('Цена<a class="lp-tsrc" href="https://x.example/">на 29.09.2026</a>'))).toEqual(['"Цена" runs into "на 29.09.2026"'])
  })
})
