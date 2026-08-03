#!/usr/bin/env node
//
// Post-build fixups that VitePress cannot do itself.
//
// 1. Rename sitemap.xml -> sitemap-content.xml.
//
//    The content sitemap cannot keep the default name. With base '/', it would be
//    written to the one address the APPLICATION's sitemap already owns — the one
//    indexing contests, the store and the landings — and whichever container the
//    host routed `/sitemap.xml` to would silently win, hiding the other half of
//    the site from Google. robots.txt (served by the app) names both.
//
//    This runs as a build step and NOT in the config's `buildEnd` hook: VitePress
//    generates the sitemap AFTER buildEnd, so a rename there finds no file and
//    fails silently — which it did, on the first attempt.

import { existsSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', '.vitepress', 'dist')

const from = join(DIST, 'sitemap.xml')
const to = join(DIST, 'sitemap-content.xml')

if (!existsSync(from)) {
  console.error('finalize-dist: sitemap.xml не найден — сборка не сгенерировала сайтмап')
  process.exit(1)
}
renameSync(from, to)
console.log('finalize-dist: sitemap.xml -> sitemap-content.xml')
