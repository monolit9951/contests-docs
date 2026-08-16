#!/usr/bin/env node --experimental-strip-types
// Validate the artifacts a crawler actually receives, not only their sources.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const DIST = join(DOCS, '.vitepress', 'dist')
const {
  CONTENT_MANIFEST_SCHEMA_VERSION,
  LOCALES,
  ORIGIN,
  PAGES,
  hreflangCluster,
  localesOf,
  pagePath,
  sourceFile,
} = await import(join(DOCS, '.vitepress', 'registry.ts'))

const hostname = process.env.DOCS_ENV === 'prod' ? ORIGIN : 'https://dev.darebay.com'
const dates = JSON.parse(readFileSync(join(DOCS, 'page-dates.json'), 'utf8'))
const failures = []
const fail = (gate, detail) => failures.push(`[${gate}] ${detail}`)

const htmlPath = (publicPath) => {
  const relative = publicPath.replace(/^\//, '')
  return publicPath.endsWith('/')
    ? join(DIST, relative, 'index.html')
    : join(DIST, `${relative}.html`)
}
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]
const tags = (html, tagName) => [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))].map((match) => match[0])

const expectedUrls = new Map()
for (const page of PAGES) {
  for (const locale of localesOf(page)) {
    const path = pagePath(page, locale)
    const file = htmlPath(path)
    const source = sourceFile(page, locale)
    expectedUrls.set(`${hostname}${path}`, { page, locale, path, file, source })
    if (!existsSync(file)) {
      fail('html-exists', `${path} -> missing ${file}`)
      continue
    }
    const html = readFileSync(file, 'utf8')

    const h1Tags = tags(html, 'h1')
    if (h1Tags.length !== 1) fail('h1-count', `${path}: ${h1Tags.length}`)

    const documentLanguage = html.match(/<html\b[^>]*\blang="([^"]+)"/i)?.[1]
    if (documentLanguage !== locale) fail('html-lang', `${path}: ${documentLanguage ?? 'missing'} != ${locale}`)

    const canonicalTags = tags(html, 'link').filter((tag) => attr(tag, 'rel') === 'canonical')
    const expectedCanonical = `${hostname}${path}`
    if (canonicalTags.length !== 1 || attr(canonicalTags[0], 'href') !== expectedCanonical) {
      fail('canonical', `${path}: expected exactly ${expectedCanonical}`)
    }

    const robotsTags = tags(html, 'meta').filter((tag) => attr(tag, 'name')?.toLowerCase() === 'robots')
    const expectedRobots = process.env.DOCS_ENV === 'prod'
      ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
      : 'noindex, follow'
    if (robotsTags.length !== 1 || attr(robotsTags[0], 'content') !== expectedRobots) {
      fail('robots', `${path}: expected exactly one ${JSON.stringify(expectedRobots)} directive`)
    }

    const ogTitle = tags(html, 'meta').filter((tag) => attr(tag, 'property') === 'og:title')
    const ogImageAlt = tags(html, 'meta').filter((tag) => attr(tag, 'property') === 'og:image:alt')
    const twitterImageAlt = tags(html, 'meta').filter((tag) => attr(tag, 'name') === 'twitter:image:alt')
    const expectedImageAlt = ogTitle.length === 1 ? attr(ogTitle[0], 'content') : undefined
    if (!expectedImageAlt) fail('social-image-alt', `${path}: expected exactly one og:title`)
    if (ogImageAlt.length !== 1 || attr(ogImageAlt[0], 'content') !== expectedImageAlt) {
      fail('social-image-alt', `${path}: expected exactly one og:image:alt matching the page title`)
    }
    if (twitterImageAlt.length !== 1 || attr(twitterImageAlt[0], 'content') !== expectedImageAlt) {
      fail('social-image-alt', `${path}: expected exactly one twitter:image:alt matching the page title`)
    }

    const actualAlternates = new Map(
      tags(html, 'link')
        .filter((tag) => attr(tag, 'rel') === 'alternate' && attr(tag, 'hreflang'))
        .map((tag) => [attr(tag, 'hreflang'), attr(tag, 'href')])
    )
    const expectedAlternates = new Map(
      hreflangCluster(page).map(({ hreflang, href }) => [hreflang, href.replace(ORIGIN, hostname)])
    )
    if (actualAlternates.size !== expectedAlternates.size) {
      fail('hreflang-size', `${path}: ${actualAlternates.size} != ${expectedAlternates.size}`)
    }
    for (const [language, href] of expectedAlternates) {
      if (actualAlternates.get(language) !== href) {
        fail('hreflang-target', `${path} [${language}]: ${actualAlternates.get(language) ?? 'missing'} != ${href}`)
      }
    }

    const schemaBlocks = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    if (schemaBlocks.length !== 1) {
      fail('jsonld-count', `${path}: ${schemaBlocks.length}`)
      continue
    }
    let schema
    try {
      schema = JSON.parse(schemaBlocks[0][1])
    } catch (error) {
      fail('jsonld-parse', `${path}: ${error.message}`)
      continue
    }
    if (schema['@context'] !== 'https://schema.org' || !Array.isArray(schema['@graph'])) {
      fail('jsonld-graph', `${path}: expected one schema.org @graph`)
      continue
    }
    const byType = (type) => schema['@graph'].filter((node) => node['@type'] === type)
    const organization = byType('Organization')[0]
    const website = byType('WebSite')[0]
    const logo = schema['@graph'].find((node) => node['@id'] === `${ORIGIN}/#logo`)
    if (organization?.['@id'] !== `${ORIGIN}/#organization`) fail('jsonld-entity', `${path}: Organization @id`)
    if (website?.['@id'] !== `${ORIGIN}/#website`) fail('jsonld-entity', `${path}: WebSite @id`)
    if (organization?.logo?.['@id'] !== `${ORIGIN}/#logo`) fail('jsonld-logo', `${path}: Organization logo reference`)
    if (
      logo?.['@type'] !== 'ImageObject' ||
      logo?.url !== `${ORIGIN}/android-chrome-512x512.png` ||
      logo?.contentUrl !== `${ORIGIN}/android-chrome-512x512.png` ||
      logo?.width !== 512 ||
      logo?.height !== 512
    ) {
      fail('jsonld-logo', `${path}: canonical 512x512 logo node`)
    }

    const isHub = page.slugs[locale] === ''
    const isArticle = !isHub && page.hub !== 'legal'
    const ogTypeTags = tags(html, 'meta').filter((tag) => attr(tag, 'property') === 'og:type')
    const expectedOgType = isArticle ? 'article' : 'website'
    if (ogTypeTags.length !== 1 || attr(ogTypeTags[0], 'content') !== expectedOgType) {
      fail('open-graph-type', `${path}: expected exactly one og:type=${expectedOgType}`)
    }
    const publishedMeta = tags(html, 'meta').filter((tag) => attr(tag, 'property') === 'article:published_time')
    const modifiedMeta = tags(html, 'meta').filter((tag) => attr(tag, 'property') === 'article:modified_time')
    const pageDatesForMeta = dates[source]
    if (isArticle) {
      if (
        pageDatesForMeta?.published &&
        (publishedMeta.length !== 1 || attr(publishedMeta[0], 'content') !== new Date(pageDatesForMeta.published).toISOString())
      ) {
        fail('open-graph-date', `${path}: article:published_time`)
      }
      if (
        pageDatesForMeta?.modified &&
        (modifiedMeta.length !== 1 || attr(modifiedMeta[0], 'content') !== new Date(pageDatesForMeta.modified).toISOString())
      ) {
        fail('open-graph-date', `${path}: article:modified_time`)
      }
    } else if (publishedMeta.length || modifiedMeta.length) {
      fail('open-graph-date', `${path}: non-Article page exposes article:* timestamps`)
    }
    if (isHub) {
      if (byType('CollectionPage').length !== 1 || byType('ItemList').length !== 1) {
        fail('jsonld-hub', `${path}: expected CollectionPage + ItemList`)
      }
    } else if (page.hub === 'legal') {
      const webPage = byType('WebPage')[0]
      const pageDates = dates[source]
      if (!webPage) fail('jsonld-legal', `${path}: WebPage missing`)
      else {
        if (webPage.publisher?.['@id'] !== `${ORIGIN}/#organization`) {
          fail('jsonld-legal', `${path}: publisher must reference Organization`)
        }
        if (pageDates?.modified && webPage.dateModified !== pageDates.modified.slice(0, 10)) {
          fail('jsonld-modified', `${path}: ${webPage.dateModified} != ${pageDates.modified.slice(0, 10)}`)
        }
        if ('datePublished' in webPage) fail('jsonld-legal', `${path}: WebPage must not claim Article publication date`)
      }
      if (byType('Article').length) fail('jsonld-legal', `${path}: legal leaf must not be Article`)
    } else {
      const article = byType('Article')[0]
      const pageDates = dates[source]
      if (!article) fail('jsonld-article', `${path}: Article missing`)
      else {
        if (article.image?.['@id'] !== `${hostname}${path}#primaryimage`) fail('jsonld-image', `${path}: primary image id`)
        if (pageDates?.published && article.datePublished !== pageDates.published.slice(0, 10)) {
          fail('jsonld-published', `${path}: ${article.datePublished} != ${pageDates.published.slice(0, 10)}`)
        }
        if (pageDates?.modified && article.dateModified !== pageDates.modified.slice(0, 10)) {
          fail('jsonld-modified', `${path}: ${article.dateModified} != ${pageDates.modified.slice(0, 10)}`)
        }
      }
    }
  }
}

const sitemapPath = join(DIST, 'sitemap-content.xml')
if (!existsSync(sitemapPath)) fail('sitemap-exists', sitemapPath)
else {
  const xml = readFileSync(sitemapPath, 'utf8')
  if (/xhtml:link|xmlns:xhtml/.test(xml)) fail('sitemap-hreflang', 'partial xhtml alternates must not ship')
  const records = new Map(
    [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?\s*<\/url>/g)]
      .map((match) => [match[1], match[2]])
  )
  if (records.size !== expectedUrls.size) fail('sitemap-size', `${records.size} != ${expectedUrls.size}`)
  for (const [url, page] of expectedUrls) {
    if (!records.has(url)) fail('sitemap-url', `${url} missing`)
    const expectedDate = dates[page.source]?.modified
    const actualDate = records.get(url)
    if (expectedDate && Date.parse(actualDate) !== Date.parse(expectedDate)) {
      fail('sitemap-lastmod', `${url}: ${actualDate ?? 'missing'} != ${expectedDate}`)
    }
  }
}

for (const locale of LOCALES) {
  const file = join(DIST, `404.${locale.language}.html`)
  if (!existsSync(file)) {
    fail('404-exists', file)
    continue
  }
  const html = readFileSync(file, 'utf8')
  if (!new RegExp(`<html\\b[^>]*lang="${locale.language}"`).test(html)) fail('404-lang', locale.language)
  if (!/<meta name="robots" content="noindex, follow">/.test(html)) fail('404-robots', locale.language)
  if (/rel="canonical"/.test(html)) fail('404-canonical', locale.language)
}

const llms = readFileSync(join(DIST, 'llms.txt'), 'utf8')
for (const url of expectedUrls.keys()) if (!llms.includes(url.replace(hostname, ORIGIN))) fail('llms-url', url)

const sourceManifest = JSON.parse(readFileSync(join(DOCS, 'content-pages.json'), 'utf8'))
const publicManifestPath = join(DIST, '.well-known', 'darebay-content-pages.json')
if (!existsSync(publicManifestPath)) fail('public-manifest', 'missing /.well-known/darebay-content-pages.json')
else {
  const publicManifest = JSON.parse(readFileSync(publicManifestPath, 'utf8'))
  if (publicManifest.schemaVersion !== CONTENT_MANIFEST_SCHEMA_VERSION) fail('public-manifest-schema', publicManifest.schemaVersion)
  if (JSON.stringify(publicManifest) !== JSON.stringify(sourceManifest)) fail('public-manifest-drift', 'public copy differs from source')
}

const releaseMarker = join(DIST, '.well-known', 'darebay-content-release.txt')
const expectedRelease = process.env.RELEASE_SHA || 'development'
if (!existsSync(releaseMarker)) fail('release-marker', 'missing release identity')
else if (readFileSync(releaseMarker, 'utf8').trim() !== expectedRelease) {
  fail('release-marker', `${readFileSync(releaseMarker, 'utf8').trim()} != ${expectedRelease}`)
}

if (failures.length) {
  console.error(`dist SEO gates failed: ${failures.length}`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}
console.log(`dist SEO gates: ${expectedUrls.size} localized URLs, ${PAGES.length} semantic pages, 0 findings`)
