import { describe, expect, it, vi } from 'vitest'
import { collectSitemapUrls } from './sitemap-tree.mjs'

const origin = 'https://darebay.com'
const index = (...urls) => `<sitemapindex>${urls.map((url) => `<sitemap><loc>${url}</loc></sitemap>`).join('')}</sitemapindex>`
const urlset = (...urls) => `<urlset>${urls.map((url) => `<url><loc>${url}</loc></url>`).join('')}</urlset>`

describe('local sitemap tree walker', () => {
  it('walks nested indexes, deduplicates pages and terminates cycles', () => {
    const files = new Map([
      [`${origin}/sitemap.xml`, index(`${origin}/a.xml`, `${origin}/b.xml`, `${origin}/a.xml`)],
      [`${origin}/a.xml`, urlset(`${origin}/tasks/one`, `${origin}/tasks/one`)],
      [`${origin}/b.xml`, index(`${origin}/sitemap.xml`, `${origin}/c.xml`)],
      [`${origin}/c.xml`, urlset(`${origin}/store/two`)],
    ])
    const load = vi.fn((url) => files.get(url.href))
    expect(collectSitemapUrls(`${origin}/sitemap.xml`, load)).toEqual([
      `${origin}/store/two`,
      `${origin}/tasks/one`,
    ])
    expect(load).toHaveBeenCalledTimes(4)
  })

  it('rejects off-origin child indexes', () => {
    expect(() => collectSitemapUrls(`${origin}/sitemap.xml`, () => index('https://example.com/a.xml')))
      .toThrow(/leaves https:\/\/darebay\.com/)
  })

  it('fails closed when the file or depth bound is exceeded', () => {
    const chain = new Map([
      [`${origin}/sitemap.xml`, index(`${origin}/a.xml`)],
      [`${origin}/a.xml`, index(`${origin}/b.xml`)],
      [`${origin}/b.xml`, urlset(`${origin}/tasks/one`)],
    ])
    const load = (url) => chain.get(url.href)
    expect(() => collectSitemapUrls(`${origin}/sitemap.xml`, load, { maxFiles: 2 })).toThrow(/max files 2/)
    expect(() => collectSitemapUrls(`${origin}/sitemap.xml`, load, { maxDepth: 1 })).toThrow(/max depth 1/)
  })
})
