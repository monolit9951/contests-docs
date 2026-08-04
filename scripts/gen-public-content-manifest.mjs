#!/usr/bin/env node --experimental-strip-types
// Publish the canonical URL manifest for other DareBay surfaces.
//
// The frontend footer must not grow a second, hand-maintained locale/path map:
// a translated slug rename would otherwise leave a valid-looking stale link.
// Importing registry.ts validates the strict schema before the exact source JSON
// is copied to the stable machine-readable endpoint.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'docs', 'content-pages.json')
const TARGET = join(ROOT, 'docs', 'public', '.well-known', 'darebay-content-pages.json')

const registry = await import(join(ROOT, 'docs', '.vitepress', 'registry.ts'))
const source = readFileSync(SOURCE, 'utf8')
const parsed = JSON.parse(source)
if (parsed.schemaVersion !== registry.CONTENT_MANIFEST_SCHEMA_VERSION) {
  throw new Error('public content manifest schemaVersion drifted from registry')
}

mkdirSync(dirname(TARGET), { recursive: true })
writeFileSync(TARGET, source.endsWith('\n') ? source : `${source}\n`)
console.log(`public content manifest: schema v${parsed.schemaVersion}, ${parsed.pages.length} semantic pages`)
