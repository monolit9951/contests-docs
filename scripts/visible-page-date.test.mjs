import { describe, expect, it } from 'vitest'
import { visiblePageDateFindings } from './visible-page-date.mjs'

const hero = (day) => '<div class="lp-hero-meta"><span class="lp-updated">Updated <b><time datetime="' + day + '">' + day + '</time></b></span><a class="lp-updated lp-byline">By author</a></div>'

describe('visible page date delivery', () => {
  it('accepts the canonical page day while source snapshots keep their older dates', () => {
    const html = hero('2026-10-01') + '<section id="method"><time datetime="2026-09-29">2026-09-29</time></section>'
    expect(visiblePageDateFindings(html, '2026-10-01')).toEqual([])
  })
  it('rejects the old hero/source date even when the metadata was updated', () => {
    expect(visiblePageDateFindings(hero('2026-09-29'), '2026-10-01')).toEqual([
      'hero update 2026-09-29 != page modification 2026-10-01',
    ])
  })
  it('rejects a missing or duplicated hero update date', () => {
    expect(visiblePageDateFindings('<div class="lp-hero-meta"></div>', '2026-10-01')).toEqual([
      'expected exactly one visible hero update date, found 0',
    ])
    expect(visiblePageDateFindings(hero('2026-10-01').replace('</div>', '<time datetime="2026-10-01"></time></div>'), '2026-10-01')).toEqual([
      'expected exactly one visible hero update date, found 2',
    ])
  })
})
