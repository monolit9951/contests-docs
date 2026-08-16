import { describe, expect, it } from 'vitest'
import { removeCoveredDuplicateH1 } from './coveredHeading'

const token = (type: string, tag = '', content = '') => ({ type, tag, content })

describe('covered heading renderer', () => {
  it('removes only the Markdown H1 duplicated by a cover', () => {
    const tokens = [
      token('html_block', '', '<div class="docs-cover"><h1>Visible</h1></div>\n'),
      token('heading_open', 'h1'),
      token('inline', '', 'Fallback'),
      token('heading_close', 'h1'),
      token('paragraph_open', 'p'),
    ]

    removeCoveredDuplicateH1(tokens)

    expect(tokens).toEqual([
      token('html_block', '', '<div class="docs-cover"><h1>Visible</h1></div>\n'),
      token('paragraph_open', 'p'),
    ])
  })

  it('leaves an ordinary Markdown H1 untouched', () => {
    const tokens = [
      token('heading_open', 'h1'),
      token('inline', '', 'Primary'),
      token('heading_close', 'h1'),
    ]

    removeCoveredDuplicateH1(tokens)

    expect(tokens).toHaveLength(3)
  })

  it('fails when a cover is no longer followed by its fallback H1', () => {
    const tokens = [
      token('html_block', '', '<div class="docs-cover"></div>\n'),
      token('paragraph_open', 'p'),
    ]

    expect(() => removeCoveredDuplicateH1(tokens)).toThrow(
      'docs-cover must be followed immediately by one Markdown H1 fallback'
    )
  })
})
