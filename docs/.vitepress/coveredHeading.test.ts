import { describe, expect, it } from 'vitest'
import { removeCoveredDuplicateH1 } from './coveredHeading'

const token = (type: string, tag = '', content = '') => ({ type, tag, content })

describe('hero-owned heading renderer', () => {
  it('removes a legacy cover block and the Markdown H1 that followed it', () => {
    const tokens = [
      token('html_block', '', '<div class="docs-cover"><h1>Visible</h1></div>\n'),
      token('heading_open', 'h1'),
      token('inline', '', 'Fallback'),
      token('heading_close', 'h1'),
      token('paragraph_open', 'p'),
    ]

    removeCoveredDuplicateH1(tokens)

    expect(tokens).toEqual([token('paragraph_open', 'p')])
  })

  it('removes the first Markdown H1 of an ordinary page (the hero renders the title)', () => {
    const tokens = [
      token('heading_open', 'h1'),
      token('inline', '', 'Primary'),
      token('heading_close', 'h1'),
      token('paragraph_open', 'p'),
      token('heading_open', 'h2'),
      token('inline', '', 'Section'),
      token('heading_close', 'h2'),
    ]

    removeCoveredDuplicateH1(tokens)

    expect(tokens.map((t) => t.type + ':' + t.tag)).toEqual([
      'paragraph_open:p',
      'heading_open:h2',
      'inline:',
      'heading_close:h2',
    ])
  })

  it('leaves a page without an H1 untouched and keeps a second H1 for the dist gate to catch', () => {
    const none = [token('paragraph_open', 'p')]
    removeCoveredDuplicateH1(none)
    expect(none).toHaveLength(1)

    const two = [
      token('heading_open', 'h1'), token('inline', '', 'One'), token('heading_close', 'h1'),
      token('heading_open', 'h1'), token('inline', '', 'Two'), token('heading_close', 'h1'),
    ]
    removeCoveredDuplicateH1(two)
    expect(two).toHaveLength(3)
    expect(two[1].content).toBe('Two')
  })

  it('fails closed on a malformed H1 token triplet', () => {
    const tokens = [token('heading_open', 'h1'), token('paragraph_open', 'p')]
    expect(() => removeCoveredDuplicateH1(tokens)).toThrow('a Markdown H1 must be a plain heading')
  })
})
