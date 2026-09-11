import { describe, expect, it } from 'vitest'
import { modifiedFrom, parseHistory, readerVisible } from './gen-page-dates.mjs'

describe('readerVisible', () => {
  it('keeps the body and the rendered frontmatter, drops the service keys', () => {
    const page =
      '---\ntitle: A page\ndescription: the lede\nprovenance: { snapshot_date: "2026-09-11", source: "darebay-prod" }\nnumbers_used: []\nseo: true\n---\n\n# A page\n\nBody text.\n'
    expect(readerVisible(page)).toBe('title: A page description: the lede # A page Body text.')
  })

  it('ignores provenance and gate flags, including their indented continuation lines', () => {
    const a = '---\ntitle: T\nhead:\n  - - meta\n    - { name: x }\nseo: true\nprovenance: { snapshot_date: "2026-08-15" }\n---\nBody   here\n'
    const b = '---\ntitle: T\nseo: false\nprovenance: { snapshot_date: "2026-09-11" }\n---\nBody here\n\n'
    expect(readerVisible(a)).toBe(readerVisible(b))
  })

  it('treats a description, a hero takeaway or a title edit as reader-visible', () => {
    const base = '---\ntitle: Old\ndescription: one\nhero:\n  takeaways:\n    - first\n---\nBody\n'
    expect(readerVisible(base)).not.toBe(readerVisible(base.replace('title: Old', 'title: New')))
    expect(readerVisible(base)).not.toBe(readerVisible(base.replace('description: one', 'description: two')))
    expect(readerVisible(base)).not.toBe(readerVisible(base.replace('- first', '- second')))
  })
})

describe('parseHistory', () => {
  it('reads newest-first records with the path the file had at each commit', () => {
    const log =
      '\x1ec3\x1f2026-09-07T00:00:00+02:00\n\ndocs/zarabotok/new-slug.md\n' +
      '\x1ec2\x1f2026-09-04T00:00:00Z\n\ndocs/zarabotok/old-slug.md\n' +
      '\x1ec1\x1f2026-08-16T00:00:00Z\n'
    expect(parseHistory(log)).toEqual([
      { sha: 'c3', date: '2026-09-07T00:00:00+02:00', path: 'docs/zarabotok/new-slug.md' },
      { sha: 'c2', date: '2026-09-04T00:00:00Z', path: 'docs/zarabotok/old-slug.md' },
    ])
  })

  it('returns nothing for an untracked file', () => {
    expect(parseHistory('')).toEqual([])
  })
})

describe('modifiedFrom', () => {
  const entries = [
    { sha: 'c3', date: '2026-09-07T00:00:00Z' },
    { sha: 'c2', date: '2026-09-04T00:00:00Z' },
    { sha: 'c1', date: '2026-08-16T00:00:00Z' },
  ]

  it('returns the newest commit that changed what the reader sees', () => {
    const content = { c3: 'same', c2: 'same', c1: 'older' }
    expect(modifiedFrom(entries, (e) => content[e.sha])).toBe('2026-09-04T00:00:00Z')
  })

  it('returns the newest commit when it changed the page', () => {
    const content = { c3: 'new', c2: 'same', c1: 'same' }
    expect(modifiedFrom(entries, (e) => content[e.sha])).toBe('2026-09-07T00:00:00Z')
  })

  it('falls back to the first commit when nothing visible ever changed', () => {
    const content = { c3: 'same', c2: 'same', c1: 'same' }
    expect(modifiedFrom(entries, (e) => content[e.sha])).toBe('2026-08-16T00:00:00Z')
  })

  it('counts an unreadable older version as a change', () => {
    const content = { c3: 'same', c2: null, c1: 'same' }
    expect(modifiedFrom(entries, (e) => content[e.sha])).toBe('2026-09-07T00:00:00Z')
  })
})
