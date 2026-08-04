#!/usr/bin/env node --experimental-strip-types
// Anti-doorway/scaled-content gate for the multilingual DareBay content tree.
//
// This file is the executable source of truth. It lives with the public corpus
// it validates; the fleet invokes this copy from each contests-docs worktree.
// There is deliberately no second implementation in darebay-seo-fleet.
//
// A "page" in the caps is a semantic id from docs/content-pages.json, not a
// translated file. Adding EN and UK versions of one article must not spend three
// slots or trip the total cap. Body similarity is compared within one locale and
// never against another translation of the same semantic page.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  PAGES,
  pagePath,
  sourceFile,
  localesOf,
} from '../docs/.vitepress/registry.ts'

export const CAP_NEW_PER_WAVE = 8
export const CAP_TOTAL = 60
export const DUP_THRESHOLD = 0.8

const FLEET_HUBS = new Set(['earnings', 'brands', 'help', 'about'])
const CONTENT_PATHS = [
  /^docs\/(zarabotok|brendam|pomoshch|o-proekte)\//,
  /^docs\/ua\/(zarobitok|brendam|dopomoha|pro-proekt)\//,
  /^docs\/en\/(earnings|for-brands|help|about)\//,
]

const REDIRECT_PATTERNS = [
  /http-equiv\s*=\s*["']?\s*refresh/i,
  /<meta[^>]+refresh/i,
  /window\.location/i,
  /location\.(href|replace|assign)/i,
  /(^|\n)\s*redirect\s*:\s*[\/"']/i,
  /(^|\n)\s*Redirect\s+30[12]\b/i,
]

const normalPath = (path) => path.replace(/\\/g, '/').replace(/^\.\//, '')
const isPotentialContentPath = (path) => CONTENT_PATHS.some((pattern) => pattern.test(normalPath(path)))

const registryBySource = new Map()
const sourcesBySemanticId = new Map()
for (const entry of PAGES) {
  for (const locale of localesOf(entry)) {
    const source = `docs/${sourceFile(entry, locale)}`
    const info = {
      entry,
      locale,
      semanticId: entry.id,
      source,
      url: pagePath(entry, locale),
      isHub: entry.slugs[locale] === '',
      validZone: FLEET_HUBS.has(entry.hub),
    }
    registryBySource.set(source, info)
    const siblings = sourcesBySemanticId.get(entry.id) ?? []
    siblings.push(source)
    sourcesBySemanticId.set(entry.id, siblings)
  }
}

function listMarkdown(dir) {
  const out = []
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name)
      const stat = statSync(path)
      if (stat.isDirectory()) walk(path)
      else if (name.endsWith('.md')) out.push(path)
    }
  }
  if (existsSync(dir)) walk(dir)
  return out
}

function parseFront(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/)
  const frontmatter = match ? match[1] : ''
  const body = match ? text.slice(match[0].length) : text
  const seo = /(^|\n)\s*seo:\s*true\b/.test(frontmatter)
  const provenance = frontmatter.match(
    /provenance\s*:\s*\{[^}]*snapshot_date\s*:\s*["']?(\d{4}-\d{2}-\d{2})/
  )
  return {
    body,
    seo,
    hasProvenance: Boolean(provenance),
  }
}

/** Resolve a source path through the semantic manifest, with a strict fallback
 * for a new file that has not yet been registered. */
export function pathInfo(path) {
  const norm = normalPath(path)
  const registered = registryBySource.get(norm)
  if (registered) {
    const slug = registered.isHub ? 'index' : norm.slice(norm.lastIndexOf('/') + 1, -3)
    return {
      isPage: true,
      norm,
      zone: registered.entry.hub,
      slug,
      validZone: registered.validZone,
      validSlug: slug === 'index' || /^[a-z0-9-]+$/.test(slug),
      url: registered.url,
      locale: registered.locale,
      semanticId: registered.semanticId,
      isHub: registered.isHub,
      registered: true,
    }
  }

  const match = norm.match(/^docs\/(?:(ua|en)\/)?([^/]+)\/([^/]+)\.md$/)
  if (!match) return { isPage: false, norm }
  const [, prefix, zone, slug] = match
  const locale = prefix === 'ua' ? 'uk' : prefix === 'en' ? 'en' : 'ru'
  const validZone = isPotentialContentPath(norm)
  const publicPrefix = prefix ? `/${prefix}` : ''
  return {
    isPage: true,
    norm,
    zone,
    slug,
    validZone,
    validSlug: slug === 'index' || /^[a-z0-9-]+$/.test(slug),
    url: slug === 'index' ? `${publicPrefix}/${zone}/` : `${publicPrefix}/${zone}/${slug}`,
    locale,
    semanticId: `unregistered:${norm}`,
    isHub: slug === 'index',
    registered: false,
  }
}

function shingles(body) {
  const words = body
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const set = new Set()
  for (let i = 0; i + 5 <= words.length; i += 1) set.add(words.slice(i, i + 5).join(' '))
  return set
}

function jaccard(left, right) {
  if (left.size === 0 && right.size === 0) return 0
  let intersection = 0
  for (const value of left) if (right.has(value)) intersection += 1
  return intersection / (left.size + right.size - intersection)
}

export function runLint({
  corpusDir,
  changedFiles,
  root = process.cwd(),
  addedFiles = null,
  enforceWaveCap = true,
}) {
  const violations = []
  const fail = (rule, file, message) => violations.push({ rule, file, msg: message })

  if (!corpusDir) return { fatal: 'missing --corpus', violations }
  const corpusRoot = resolve(root, corpusDir)
  if (!existsSync(corpusRoot)) return { fatal: `--corpus not found: ${corpusDir}`, violations }
  const corpusFiles = listMarkdown(corpusRoot)
  if (!corpusFiles.length) return { fatal: `--corpus empty: ${corpusDir}`, violations }

  const urlMap = new Map()
  const corpusPages = []
  const semanticSeoIds = new Set()
  const semanticFiles = new Map()

  for (const file of corpusFiles) {
    const rel = normalPath(relative(root, file))
    const info = pathInfo(rel)
    const parsed = parseFront(readFileSync(file, 'utf8'))
    if (info.isPage) {
      const paths = urlMap.get(info.url) ?? []
      paths.push(rel)
      urlMap.set(info.url, paths)
      const semanticPaths = semanticFiles.get(info.semanticId) ?? []
      semanticPaths.push(rel)
      semanticFiles.set(info.semanticId, semanticPaths)
      if (parsed.seo) semanticSeoIds.add(info.semanticId)
    }
    corpusPages.push({ rel, info, parsed, shingles: shingles(parsed.body) })
  }

  const inspectedSemanticIds = new Set()
  const newSemanticIds = new Set()
  let inspected = 0
  const skipped = { deleted: 0, nonpage: 0, otherzone: 0 }

  for (const changed of changedFiles.map(normalPath)) {
    const info = pathInfo(changed)
    const gated = isPotentialContentPath(changed)
    if (!info.isPage) {
      if (gated) fail('path', changed, 'content path must be docs/<locale?>/<hub>/<slug>.md with exactly one slug segment')
      else skipped.nonpage += 1
      continue
    }
    if (!info.validZone) {
      if (gated) fail('path', changed, `zone "${info.zone}" is not a fleet content hub`)
      else skipped.otherzone += 1
      continue
    }

    const absolute = resolve(root, changed)
    if (!existsSync(absolute)) {
      skipped.deleted += 1
      continue
    }

    const text = readFileSync(absolute, 'utf8')
    const parsed = parseFront(text)
    for (const pattern of REDIRECT_PATTERNS) {
      if (pattern.test(text)) {
        fail('redirect', changed, `doorway redirect pattern matched: ${pattern}`)
        break
      }
    }

    if (!info.validSlug) fail('path', changed, `slug "${info.slug}" must match ^[a-z0-9-]+$`)
    if (!info.registered) {
      fail('registry', changed, 'page is absent from docs/content-pages.json')
    }

    const others = (urlMap.get(info.url) ?? []).filter((path) => resolve(root, path) !== absolute)
    if (others.length) fail('uniqueness', changed, `URL ${info.url} collides with ${others.join(', ')}`)

    if (!info.isHub && !parsed.hasProvenance) {
      fail('provenance', changed, 'missing frontmatter provenance.snapshot_date')
    }

    const isAdded = addedFiles === null || addedFiles.has(changed)
    if (parsed.seo && isAdded) {
      const siblings = semanticFiles.get(info.semanticId) ?? []
      const existedBefore = addedFiles !== null && siblings.some((path) => !addedFiles.has(path))
      if (!existedBefore) newSemanticIds.add(info.semanticId)
    }

    const currentShingles = shingles(parsed.body)
    let worst = { file: null, similarity: 0 }
    for (const candidate of corpusPages) {
      if (!candidate.info.isPage || candidate.rel === changed) continue
      if (candidate.info.locale !== info.locale) continue
      if (candidate.info.semanticId === info.semanticId) continue
      const similarity = jaccard(currentShingles, candidate.shingles)
      if (similarity > worst.similarity) worst = { file: candidate.rel, similarity }
    }
    if (worst.similarity > DUP_THRESHOLD) {
      fail(
        'duplicate',
        changed,
        `near-duplicate of ${worst.file} in ${info.locale} (jaccard=${worst.similarity.toFixed(2)} > ${DUP_THRESHOLD})`
      )
    }

    inspected += 1
    inspectedSemanticIds.add(info.semanticId)
  }

  if (enforceWaveCap && newSemanticIds.size > CAP_NEW_PER_WAVE) {
    fail('cap', '(branch)', `${newSemanticIds.size} new semantic SEO pages > ${CAP_NEW_PER_WAVE} per wave`)
  }
  if (semanticSeoIds.size > CAP_TOTAL) {
    fail('cap', '(corpus)', `${semanticSeoIds.size} semantic SEO pages > ${CAP_TOTAL}`)
  }

  return {
    fatal: null,
    violations,
    inspected,
    skipped,
    stats: {
      changed: changedFiles.length,
      semanticInspected: inspectedSemanticIds.size,
      semanticNew: newSemanticIds.size,
      semanticTotal: semanticSeoIds.size,
    },
  }
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--corpus') args.corpus = argv[++i]
    else if (argv[i] === '--base') args.base = argv[++i]
    else if (argv[i] === '--changed') args.changed = argv[++i]
    else if (argv[i] === '--root') args.root = argv[++i]
    else if (argv[i] === '--skip-wave-cap') args.skipWaveCap = true
  }
  return args
}

function refExists(root, ref) {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}^{commit}`], { cwd: root, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function resolveBase(args, root) {
  if (args.changed !== undefined) return null
  const requested = args.base || 'origin/develop'
  if (refExists(root, requested)) return requested
  if (refExists(root, 'origin/develop')) return 'origin/develop'
  throw new Error(`base ref unreachable: ${requested} (and origin/develop)`)
}

function gitDiffPaths(root, base, diffFilter = null) {
  const args = ['diff', '--name-only']
  if (diffFilter) args.push(`--diff-filter=${diffFilter}`)
  args.push(`${base}...HEAD`, '--', 'docs')
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map((path) => path.trim())
    .filter(Boolean)
}

function resolveChanged(args, root, base) {
  if (args.changed !== undefined) {
    return args.changed.split(',').map((path) => path.trim()).filter(Boolean)
  }
  return gitDiffPaths(root, base).filter((path) => path.endsWith('.md') && isPotentialContentPath(path))
}

function resolveAdded(root, base) {
  if (!base) return null
  return new Set(gitDiffPaths(root, base, 'A'))
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const root = args.root ? resolve(args.root) : process.cwd()
  if (!args.corpus) {
    console.error('FATAL: --corpus <dir> is required')
    process.exit(2)
  }

  let changed
  let added
  try {
    const base = resolveBase(args, root)
    changed = resolveChanged(args, root, base)
    added = resolveAdded(root, base)
  } catch (error) {
    console.error(`FATAL: cannot resolve changed files: ${error.message}`)
    process.exit(2)
  }

  const result = runLint({
    corpusDir: args.corpus,
    changedFiles: changed,
    root,
    addedFiles: added,
    enforceWaveCap: !args.skipWaveCap,
  })
  if (result.fatal) {
    console.error(`FATAL: ${result.fatal}`)
    process.exit(2)
  }
  if (result.violations.length) {
    console.error(`anti-doorway-lint: ${result.violations.length} violation(s):`)
    for (const violation of result.violations) {
      console.error(`  [${violation.rule}] ${violation.file}: ${violation.msg}`)
    }
    process.exit(1)
  }

  const skipped = result.skipped
  console.log(
    'anti-doorway-lint: OK ' +
      `(changed=${result.stats.changed} inspected=${result.inspected} ` +
      `deleted=${skipped.deleted} nonpage=${skipped.nonpage} otherzone=${skipped.otherzone} ` +
      `semantic_inspected=${result.stats.semanticInspected} semantic_new=${result.stats.semanticNew} ` +
      `semantic_total=${result.stats.semanticTotal})`
  )
}

if (import.meta.url === `file://${process.argv[1]}`) main()
