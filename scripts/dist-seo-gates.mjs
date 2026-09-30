#!/usr/bin/env node --experimental-strip-types
// Validate the artifacts a crawler actually receives, not only their sources.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gluedTextFindings, sourceMarkerFindings, tableNumberingFindings } from './extracted-text.mjs'
import { MIN_INBOUND, inboundSources, inboundVerdict, internalNofollowAnchors } from './internal-links.mjs'
import { showcaseWeightFindings } from './showcase-weight.mjs'
import { hubDirectoryFinding } from './hub-directory.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const DIST = join(DOCS, '.vitepress', 'dist')
const {
  CONTENT_MANIFEST_SCHEMA_VERSION,
  LOCALES,
  ORIGIN,
  PAGES,
  hreflangCluster,
  localeAxis,
  localesOf,
  pagePath,
  sourceFile,
} = await import(join(DOCS, '.vitepress', 'registry.ts'))
const { ABSOLUTE_URL, FONT_FACE_STYLESHEETS, HEAD_END, REQUEST_TAG, cssUrls, fontPreloadHrefs } = await import(join(DOCS, '.vitepress', 'headAssets.ts'))

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

// config.ts strips VitePress's `/vp-icons.css` link because the file is empty (headAssets.ts).
// Should it ever carry icon rules, the build fails here: they belong inline with the bundle
// (inlineStylesheets), because the `inline-css` gate below allows no linked stylesheet at all.
const vpIconsPath = join(DIST, 'vp-icons.css')
const vpIconsHasRules = existsSync(vpIconsPath) && readFileSync(vpIconsPath, 'utf8').trim() !== ''
if (vpIconsHasRules) fail('vp-icons', 'vp-icons.css has rules: inline them with the bundle (inlineStylesheets in headAssets.ts)')

// Every page carries the CSS bundle and the @font-face files at the end of its head, followed only by
// the tags that start requests (inlineStylesheets in headAssets.ts): a linked stylesheet is the request
// the TSPU leaves hanging, and a blank page. The built files are what each page must hold, byte for
// byte, so a stale or partial copy fails too. Inline, a relative url() would resolve against the page's
// address and an @import would be a request again.
const bundleFiles = readdirSync(join(DIST, 'content-assets')).filter((name) => /^style\.[\w-]+\.css$/.test(name))
if (bundleFiles.length !== 1) fail('inline-css', `expected one CSS bundle in content-assets, found [${bundleFiles.join(', ')}]`)
const inlineTexts = [
  ...bundleFiles.map((name) => readFileSync(join(DIST, 'content-assets', name), 'utf8')),
  FONT_FACE_STYLESHEETS.map((href) => readFileSync(join(DIST, href), 'utf8')).join('\n'),
]
for (const text of inlineTexts) {
  if (/@import/i.test(text)) fail('inline-css', 'an inlined stylesheet has an @import')
  for (const target of cssUrls(text)) {
    if (!ABSOLUTE_URL.test(target)) fail('inline-css', `an inlined stylesheet has a relative url(${target})`)
  }
}
const inlineStyles = inlineTexts.map((text) => `<style>${text}</style>`).join('')
// Markup only, for the scans below that look for ids and links: the inlined CSS holds SVG in data:
// urls and attribute selectors, and neither is part of the page.
// One pass, the way a browser reads raw text: "<style" inside a script is text of that script.
const markupOf = (html) => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')

const expectedUrls = new Map()
const idsByPath = new Map()
const anchorLinks = []
// Each table row's or card's link to our review of the platform (reviewPath); checked as `review-link` after the loop.
const reviewLinks = []
// Content pages (hub indexes excluded) with their built HTML, for the `inbound-links` gate.
const leafPages = []
const decodeFragment = (value) => { try { return decodeURIComponent(value) } catch { return value } }
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
    if (page.slugs[locale] !== '') leafPages.push({ path, html, group: `${page.hub}/${locale}` })

    // The page's anchors and the links aiming at them; checked as `anchor-target` after the loop.
    const markup = markupOf(html)
    idsByPath.set(path, new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => decodeFragment(match[1]))))
    for (const match of markup.matchAll(/\bhref="([^"#]*)#([^"]+)"/g)) {
      const [, target, fragment] = match
      if (target === '' || target.startsWith('/')) anchorLinks.push({ from: path, target: target || path, fragment: decodeFragment(fragment) })
    }
    for (const match of html.matchAll(/class="lp-review"><a href="([^"]*)"/g)) reviewLinks.push({ from: path, locale, target: match[1] })

    // The page as text, the way it is copied, read aloud or quoted (scripts/extracted-text.mjs):
    // every source marker is " [n]" apart from its figure, every table number is the one "How this
    // comparison was built" lists under that platform, and no two words of a table, a card, a
    // source list or a calculator run together across an element.
    for (const finding of sourceMarkerFindings(html)) fail('source-marker', `${path}: ${finding}`)
    for (const finding of tableNumberingFindings(html)) fail('table-number', `${path}: ${finding}`)
    for (const finding of gluedTextFindings(html)) fail('glued-text', `${path}: ${finding}`)

    const h1Tags = tags(html, 'h1')
    if (h1Tags.length !== 1) fail('h1-count', `${path}: ${h1Tags.length}`)

    // A hub index lists its section exactly once, whichever layout drew it (hub-directory.mjs).
    const directory = hubDirectoryFinding(markup, page, locale, PAGES)
    if (directory) fail('hub-directory', `${path}: ${directory}`)

    // A showcase hub index keeps to the weight a stalling connection still delivers: 40 KB of its own
    // markup, 85 KB on the wire, nothing fetched to draw it (scripts/showcase-weight.mjs).
    for (const finding of showcaseWeightFindings(html)) fail('showcase-weight', `${path}: ${finding}`)

    const documentLanguage = html.match(/<html\b[^>]*\blang="([^"]+)"/i)?.[1]
    if (documentLanguage !== locale) fail('html-lang', `${path}: ${documentLanguage ?? 'missing'} != ${locale}`)
    // The tree's writing direction, from the same registry axis: an Arabic page rendered
    // left to right reverses every sentence that mixes in a number or a Latin name.
    const documentDirection = html.match(/<html\b[^>]*\bdir="([^"]+)"/i)?.[1]
    const expectedDirection = localeAxis(locale).dir
    if (documentDirection !== expectedDirection) {
      fail('html-dir', `${path}: ${documentDirection ?? 'missing'} != ${expectedDirection}`)
    }

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

    // Exactly the fonts this language paints first (FONT_PRELOADS): a preload the page never
    // renders costs the reader bandwidth, a missing one costs the headline a late swap. That
    // includes the stock theme's Inter, which no page uses.
    const fontPreloads = tags(html, 'link')
      .filter((tag) => attr(tag, 'rel') === 'preload' && attr(tag, 'as') === 'font')
      .map((tag) => attr(tag, 'href'))
      .sort()
    const expectedFontPreloads = fontPreloadHrefs(locale).sort()
    if (fontPreloads.join(' ') !== expectedFontPreloads.join(' ')) {
      fail('font-preload', `${path}: [${fontPreloads.join(', ')}] != [${expectedFontPreloads.join(', ')}]`)
    }
    // vp-icons.css included (see vpIconsHasRules above): no page links any stylesheet.
    const linkedStylesheets = tags(markupOf(html), 'link').filter((tag) => /\bstylesheet\b/.test(attr(tag, 'rel') ?? ''))
    if (linkedStylesheets.length) fail('inline-css', `${path}: links ${linkedStylesheets.map((tag) => attr(tag, 'href')).join(', ')}`)
    // Behind every meta tag, the canonical, hreflang and JSON-LD (link unfurlers read only the first
    // kilobytes of a page), and in front of every tag that starts a request.
    const markupHeadEnds = markupOf(html).split('</head>').length - 1
    const stylesAt = html.indexOf(inlineStyles)
    const headEnd = html.indexOf(HEAD_END)
    const afterStyles = stylesAt < 0 || headEnd < stylesAt ? null : html.slice(stylesAt + inlineStyles.length, headEnd).replace(REQUEST_TAG, '')
    if (markupHeadEnds !== 1 || afterStyles === null || afterStyles.trim() !== '' || html.indexOf(inlineStyles, stylesAt + 1) >= 0) {
      fail('inline-css', `${path}: the head does not end with the CSS bundle and the @font-face rules, then the request tags`)
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

// A link to a heading that does not exist is silently dead: the browser stays put and the
// reader never learns the section was meant to be there. VitePress slugifies headings, and the
// slug is not always what an author would type — `ї` collapses to `і`, so a hand-written
// `#_7-комісії` pointed at nothing while the heading carried `#_7-комісіі`.
for (const { from, target, fragment } of anchorLinks) {
  const ids = idsByPath.get(target)
  if (!ids) continue // external or non-page target; addresses are covered by the URL gates
  if (!ids.has(fragment)) fail('anchor-target', `${from} -> ${target}#${fragment}: no such id on the target page`)
}

// A review link opens a page of the manifest in the reader's own language, and never the page it is on.
const localeByPath = new Map([...expectedUrls.values()].map(({ path, locale }) => [path, locale]))
for (const { from, locale, target } of reviewLinks) {
  if (target === from) fail('review-link', `${from}: links to itself`)
  else if (localeByPath.get(target) !== locale) fail('review-link', `${from} -> ${target}: not a ${locale} page of the manifest`)
}

// The theme is imported without fonts: Inter must not come back through another import.
const interFiles = readdirSync(join(DIST, 'content-assets'), { recursive: true })
  .filter((file) => /(?:^|\/)inter-[^/]*\.woff2$/.test(String(file)))
if (interFiles.length) fail('inter-font', `unused Inter files ship: ${interFiles.join(', ')}`)

// Internal link equity (scripts/internal-links.mjs explains both rules).
//
// `internal-nofollow`: no shipped HTML file — content page, hub, 404 — carries a nofollow link to
// darebay.com. Our own pages are linked through `sourceAnchor` (links.ts); a nofollow on one of
// them discards the signal the whole corpus exists to build.
for (const file of readdirSync(DIST, { recursive: true }).map(String).filter((name) => name.endsWith('.html'))) {
  for (const anchor of internalNofollowAnchors(readFileSync(join(DIST, file), 'utf8'))) {
    fail('internal-nofollow', `${file}: ${anchor.tag}`)
  }
}

// `inbound-links`: every content page is recommended or cited by at least MIN_INBOUND other
// content pages — body links, comparison sources, "more in this section" cards; never the menus,
// the language switcher, the page's own outline or its hub's catalogue. The floor drops only where
// the registry itself makes it unreachable: a section with n pages in a language can recommend a
// page from at most n - 1 others. Those pages are printed below on every build, with the reason.
const groupSizes = new Map()
for (const page of PAGES) {
  for (const locale of localesOf(page)) {
    if (page.slugs[locale] === '') continue
    const group = `${page.hub}/${locale}`
    groupSizes.set(group, (groupSizes.get(group) ?? 0) + 1)
  }
}
const inbound = inboundSources(leafPages, leafPages.map(({ path }) => path))
const inboundResult = inboundVerdict(
  leafPages.map(({ path, group }) => ({ path, group, groupSize: groupSizes.get(group) })),
  inbound,
)
for (const { path, group, groupSize, count, floor } of inboundResult.failures) {
  fail('inbound-links', `${path}: linked from ${count} other content page(s), needs ${floor} (${group} has ${groupSize} pages)`)
}
if (inboundResult.exempt.length) {
  console.log(`inbound links: ${inboundResult.exempt.length} page(s) below ${MIN_INBOUND}, held to a lower floor because their section is too small in that language:`)
  for (const { path, group, groupSize, count, floor } of inboundResult.exempt) {
    console.log(`  ${path}: ${count} (floor ${floor}: ${group} has ${groupSize} page(s), so "more in this section" can recommend it from at most ${groupSize - 1})`)
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
  if (!new RegExp(`<html\\b[^>]*dir="${locale.dir}"`).test(html)) fail('404-dir', locale.language)
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
// The analytics beacon reports the same identity as `releaseSha` (config.ts defines it for the
// client). That wiring was once missing unnoticed, and every docs event shipped without one.
if (expectedRelease !== 'development') {
  const bundles = readdirSync(DIST, { recursive: true }).filter((file) => file.endsWith('.js'))
  if (!bundles.some((file) => readFileSync(join(DIST, file), 'utf8').includes(expectedRelease))) {
    fail('release-beacon', `no client bundle carries ${expectedRelease}`)
  }
}

if (failures.length) {
  console.error(`dist SEO gates failed: ${failures.length}`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}
console.log(`dist SEO gates: ${expectedUrls.size} localized URLs, ${PAGES.length} semantic pages, 0 findings`)
console.log(`internal links: 0 nofollow to darebay.com; ${leafPages.length} content pages linked from >= ${MIN_INBOUND} others or their section's maximum`)
