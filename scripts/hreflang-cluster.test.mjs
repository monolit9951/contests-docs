import { describe, expect, it } from 'vitest'
import { parseHreflangCluster, sameHreflangMap } from './hreflang-cluster.mjs'

const link = (hreflang, href) => `<link rel="alternate" hreflang="${hreflang}" href="${href}">`

describe('hreflang cluster parser', () => {
  it('accepts x-default sharing the root-locale URL', () => {
    const parsed = parseHreflangCluster([
      link('ru', 'https://darebay.com/zarabotok/'),
      link('uk', 'https://darebay.com/ua/zarobitok/'),
      link('x-default', 'https://darebay.com/zarabotok/'),
    ].join(''))
    expect(parsed.errors).toEqual([])
  })

  it('detects duplicate languages, duplicate non-default targets and off-origin URLs', () => {
    const parsed = parseHreflangCluster([
      link('ru', 'https://darebay.com/a'),
      link('ru', 'https://darebay.com/b'),
      link('uk', 'https://darebay.com/b'),
      link('en', 'https://example.com/a'),
    ].join(''))
    expect(parsed.errors.join('\n')).toMatch(/duplicate hreflang/)
    expect(parsed.errors.join('\n')).toMatch(/duplicate non-default href/)
    expect(parsed.errors.join('\n')).toMatch(/off-origin/)
  })

  it('compares maps independent of tag order', () => {
    const a = new Map([['ru', 'https://darebay.com/a'], ['en', 'https://darebay.com/en/a']])
    const b = new Map([['en', 'https://darebay.com/en/a'], ['ru', 'https://darebay.com/a']])
    expect(sameHreflangMap(a, b)).toBe(true)
    b.set('ru', 'https://darebay.com/b')
    expect(sameHreflangMap(a, b)).toBe(false)
  })
})
