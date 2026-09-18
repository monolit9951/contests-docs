import { describe, expect, it } from 'vitest'
import { parseHreflangCluster, sameHreflangMap } from './hreflang-cluster.mjs'

const link = (hreflang, href) => `<link rel="alternate" hreflang="${hreflang}" href="${href}">`

describe('hreflang cluster parser', () => {
  it('accepts x-default sharing a language URL, including a page that has one language', () => {
    // x-default is a duplicate href by construction: it always repeats whichever
    // language version it stands for. Only a repeated NON-default target is a
    // mistake.
    const twoLanguages = parseHreflangCluster([
      link('ru', 'https://darebay.com/zarabotok/'),
      link('uk', 'https://darebay.com/ua/zarobitok/'),
      link('x-default', 'https://darebay.com/zarabotok/'),
    ].join(''))
    expect(twoLanguages.errors).toEqual([])

    // The whole cluster of a page that exists in one language — ru-only, or
    // EN-only since 2026-09-18: the page names itself and stands in for every
    // reader it has no version for. Two links, one address, and no error.
    const oneLanguage = parseHreflangCluster([
      link('en', 'https://darebay.com/en/earnings/who-pays-clippers-in-india'),
      link('x-default', 'https://darebay.com/en/earnings/who-pays-clippers-in-india'),
    ].join(''))
    expect(oneLanguage.errors).toEqual([])
    expect([...oneLanguage.map.keys()]).toEqual(['en', 'x-default'])
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
