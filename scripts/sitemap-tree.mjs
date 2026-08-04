import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'

const xmlText = (value) => value
  .replaceAll('&amp;', '&')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&quot;', '"')
  .replaceAll('&apos;', "'")
  .trim()

const locsOf = (xml) => [...xml.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)].map((match) => xmlText(match[1]))

export const collectSitemapUrls = (rootUrl, load, options = {}) => {
  const expectedOrigin = new URL(options.origin ?? rootUrl).origin
  const maxFiles = options.maxFiles ?? 256
  const maxDepth = options.maxDepth ?? 8
  const pending = [{ url: new URL(rootUrl).href, depth: 0 }]
  const visited = new Set()
  const pages = new Set()

  const sameOrigin = (raw, parent) => {
    const url = new URL(raw, parent)
    if (url.origin !== expectedOrigin) throw new Error(`sitemap tree leaves ${expectedOrigin}: ${url.href}`)
    if (url.username || url.password || url.hash) throw new Error(`invalid sitemap URL: ${url.href}`)
    return url
  }

  while (pending.length) {
    const item = pending.shift()
    if (visited.has(item.url)) continue
    if (item.depth > maxDepth) throw new Error(`sitemap tree exceeds max depth ${maxDepth}: ${item.url}`)
    if (visited.size >= maxFiles) throw new Error(`sitemap tree exceeds max files ${maxFiles}`)
    visited.add(item.url)

    const xml = load(new URL(item.url))
    const locs = locsOf(xml)
    if (/<sitemapindex\b/i.test(xml)) {
      for (const raw of locs) {
        const child = sameOrigin(raw, item.url)
        if (!/\.xml$/i.test(child.pathname) || child.search) {
          throw new Error(`sitemapindex child is not a plain XML URL: ${child.href}`)
        }
        pending.push({ url: child.href, depth: item.depth + 1 })
      }
    } else if (/<urlset\b/i.test(xml)) {
      for (const raw of locs) pages.add(sameOrigin(raw, item.url).href)
    } else {
      throw new Error(`not a sitemapindex or urlset: ${item.url}`)
    }
  }

  return [...pages].sort()
}

export const readLocalSitemapTree = (dist, rootFile, options = {}) => {
  const origin = options.origin ?? 'https://darebay.com'
  const distRoot = resolve(dist)
  const rootUrl = new URL(rootFile.replace(/^\/+/, ''), `${origin}/`).href
  const load = (url) => {
    const pathname = decodeURIComponent(url.pathname)
    const file = resolve(distRoot, `.${pathname}`)
    if (file !== distRoot && !file.startsWith(`${distRoot}${sep}`)) {
      throw new Error(`sitemap path escapes dist: ${url.href}`)
    }
    return readFileSync(file, 'utf8')
  }
  return collectSitemapUrls(rootUrl, load, { ...options, origin })
}
