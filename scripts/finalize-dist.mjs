#!/usr/bin/env node --experimental-strip-types
// Post-build normalization VitePress cannot express in its config.
//
// - keeps the content sitemap away from the application's /sitemap.xml;
// - makes HTML the one hreflang authority (VitePress emits only partial
//   sitemap alternates for this translated-slug topology);
// - emits locale-correct, noindex 404 documents for nginx error_page handling.

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'docs', '.vitepress', 'dist')
const { LOCALES, PAGES, pagePath } = await import(join(ROOT, 'docs', '.vitepress', 'registry.ts'))
const { CHROME_COPY } = await import(join(ROOT, 'docs', '.vitepress', 'chrome.ts'))

const sitemapSource = join(DIST, 'sitemap.xml')
const sitemapTarget = join(DIST, 'sitemap-content.xml')
if (!existsSync(sitemapSource)) {
  console.error('finalize-dist: sitemap.xml not found; VitePress did not generate a sitemap')
  process.exit(1)
}
renameSync(sitemapSource, sitemapTarget)

// The rendered HTML has a complete reciprocal cluster from the semantic
// registry. VitePress's sitemap locale inference follows directory names and
// emitted xhtml:link only for a subset of hub pages. Two conflicting sources
// are worse than one complete source, so sitemap alternates are removed.
const sitemap = readFileSync(sitemapTarget, 'utf8')
  .replace(/\s+xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '')
  .replace(/\s*<xhtml:link\b[^>]*\/>/g, '')
writeFileSync(sitemapTarget, sitemap)

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const home = PAGES.find((page) => page.id === 'earnings-hub')
if (!home) throw new Error('finalize-dist: earnings-hub missing from content manifest')

for (const locale of LOCALES) {
  const copy = CHROME_COPY[locale.language].notFound
  const homePath = pagePath(home, locale.language)
  if (!homePath) throw new Error(`finalize-dist: earnings-hub missing ${locale.language}`)
  const html = `<!doctype html>
<html lang="${locale.language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, follow">
  <title>${escapeHtml(`${copy.code} — ${copy.title}`)}</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#111;color:#f5f5f5}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
    main{max-width:680px;text-align:center}.code{font-size:clamp(72px,18vw,150px);font-weight:800;line-height:.9;margin:0;color:#ff4f8b}
    h1{font-size:clamp(28px,6vw,48px);margin:24px 0 12px}p{font-size:18px;line-height:1.6;color:#b8b8c2;margin:0 0 28px}
    a{display:inline-block;border:1px solid #ff4f8b;border-radius:999px;padding:12px 20px;color:#fff;text-decoration:none;font-weight:700}
    a:focus-visible{outline:3px solid #fff;outline-offset:4px}
  </style>
</head>
<body>
  <main>
    <p class="code" aria-hidden="true">${escapeHtml(copy.code)}</p>
    <h1>${escapeHtml(copy.title)}</h1>
    <p>${escapeHtml(copy.quote)}</p>
    <a href="${escapeHtml(homePath)}" aria-label="${escapeHtml(copy.linkLabel)}">${escapeHtml(copy.linkText)}</a>
  </main>
</body>
</html>
`
  writeFileSync(join(DIST, `404.${locale.language}.html`), html)
}

console.log('finalize-dist: sitemap-content.xml + localized 404 documents')
