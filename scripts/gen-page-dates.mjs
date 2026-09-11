#!/usr/bin/env node
// Generate the versioned date snapshot consumed by VitePress and Docker.
//
// `published` is the oldest commit that touched the file (following renames).
// `modified` is the newest commit that changed what a reader sees: the body and
// every frontmatter key that renders (title, description, hero, cta, glossary,
// compare, facts, …). Only the service keys — provenance, numbers_used, seo,
// landing, app, head — are ignored. It used to be the newest commit of any kind,
// so a provenance or `seo` sweep stamped one date on a hundred pages at once and
// `lastmod` stopped meaning anything to a crawler. The Docker context
// intentionally excludes `.git`, so CD generates this artifact before
// `docker build`; inside an isolated image the committed/generated snapshot is
// validated and reused verbatim.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const TARGET = join(DOCS, 'page-dates.json')

/** Frontmatter keys that never reach the page: build inputs and gate flags. */
const SERVICE_KEYS = new Set(['provenance', 'numbers_used', 'seo', 'landing', 'app', 'head'])

const walk = (directory, files = []) => {
  for (const name of readdirSync(directory)) {
    if (name.startsWith('.') || name === 'public') continue
    const path = join(directory, name)
    if (statSync(path).isDirectory()) walk(path, files)
    else if (name.endsWith('.md')) files.push(path)
  }
  return files
}

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

const hasGit = () => {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd: ROOT, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * What a reader (or a crawler reading the markup) can see: the body plus the
 * frontmatter minus the service keys, with whitespace collapsed. A service key
 * owns every indented continuation line that follows it.
 */
export const readerVisible = (markdown) => {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  const frontmatter = match ? match[1] : ''
  const body = match ? markdown.slice(match[0].length) : markdown
  const kept = []
  let skipping = false
  for (const line of frontmatter.split(/\r?\n/)) {
    const key = line.match(/^([A-Za-z_][\w-]*):/)
    if (key) skipping = SERVICE_KEYS.has(key[1])
    else if (!/^\s/.test(line) && line.trim() !== '') skipping = false
    if (!skipping) kept.push(line)
  }
  return `${kept.join('\n')}\n${body}`.replace(/\s+/g, ' ').trim()
}

/**
 * `git log --follow --format=%x1e%H%x1f%cI --name-only` → newest first, each
 * commit with the path the file had there (renames follow the path).
 */
export const parseHistory = (log) =>
  log
    .split('\x1e')
    .filter((record) => record.trim())
    .map((record) => {
      const [head, ...rest] = record.split('\n')
      const [sha, date] = head.split('\x1f')
      const path = rest.map((line) => line.trim()).find(Boolean)
      return { sha, date, path }
    })
    .filter((entry) => entry.sha && entry.date && entry.path)

const history = (file) =>
  parseHistory(git(['log', '--follow', '--format=%x1e%H%x1f%cI', '--name-only', '--', relative(ROOT, file)]))

const contentCache = new Map()
const contentAt = (entry) => {
  const key = `${entry.sha}:${entry.path}`
  if (!contentCache.has(key)) {
    let value = null
    try {
      value = readerVisible(git(['show', key]))
    } catch {
      value = null
    }
    contentCache.set(key, value)
  }
  return contentCache.get(key)
}

/** The newest commit whose reader-visible content differs from the version before it. */
export const modifiedFrom = (entries, contentOf) => {
  for (let i = 0; i < entries.length - 1; i += 1) {
    const current = contentOf(entries[i])
    const older = contentOf(entries[i + 1])
    if (current === null || older === null || current !== older) return entries[i].date
  }
  return entries.at(-1).date
}

const readPrevious = () => {
  if (!existsSync(TARGET)) return {}
  try {
    return JSON.parse(readFileSync(TARGET, 'utf8'))
  } catch (error) {
    console.error(`gen-page-dates: invalid ${relative(ROOT, TARGET)}: ${error.message}`)
    process.exit(1)
  }
}

const main = () => {
  const previous = readPrevious()
  if (!hasGit()) {
    if (!Object.keys(previous).length) {
      console.error('gen-page-dates: git unavailable and page-dates.json is empty/missing')
      process.exit(1)
    }
    console.log(`gen-page-dates: git unavailable; using ${Object.keys(previous).length} versioned records`)
    return
  }

  const output = {}
  for (const file of walk(DOCS).sort()) {
    const source = relative(DOCS, file).split(/[\\/]/).join('/')
    let entries = []
    try {
      entries = history(file)
    } catch {
      // A working-tree-only page has no commit date yet. Dev builds may omit its
      // dates; release CD runs this again after the page is committed.
    }

    if (entries.length) {
      output[source] = {
        published: entries.at(-1).date,
        modified: modifiedFrom(entries, contentAt),
      }
    } else if (previous[source]) {
      output[source] = previous[source]
    }
  }

  writeFileSync(TARGET, `${JSON.stringify(output, null, 2)}\n`)
  console.log(`gen-page-dates: ${Object.keys(output).length} records`)
}

const invokedDirectly = (() => {
  try {
    return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
})()

if (invokedDirectly) main()
