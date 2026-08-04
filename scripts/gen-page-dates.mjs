#!/usr/bin/env node
// Generate the versioned date snapshot consumed by VitePress and Docker.
//
// `published` is the oldest commit that touched the file (following renames),
// `modified` is the newest. The Docker context intentionally excludes `.git`,
// so CD generates this artifact before `docker build`; inside an isolated image
// the committed/generated snapshot is validated and reused verbatim.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const TARGET = join(DOCS, 'page-dates.json')

const walk = (directory, files = []) => {
  for (const name of readdirSync(directory)) {
    if (name.startsWith('.') || name === 'public') continue
    const path = join(directory, name)
    if (statSync(path).isDirectory()) walk(path, files)
    else if (name.endsWith('.md')) files.push(path)
  }
  return files
}

const hasGit = () => {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd: ROOT, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const previous = (() => {
  if (!existsSync(TARGET)) return {}
  try {
    return JSON.parse(readFileSync(TARGET, 'utf8'))
  } catch (error) {
    console.error(`gen-page-dates: invalid ${relative(ROOT, TARGET)}: ${error.message}`)
    process.exit(1)
  }
})()

if (!hasGit()) {
  if (!Object.keys(previous).length) {
    console.error('gen-page-dates: git unavailable and page-dates.json is empty/missing')
    process.exit(1)
  }
  console.log(`gen-page-dates: git unavailable; using ${Object.keys(previous).length} versioned records`)
  process.exit(0)
}

const output = {}
for (const file of walk(DOCS).sort()) {
  const source = relative(DOCS, file).split(/[\\/]/).join('/')
  let commits = []
  try {
    commits = execFileSync(
      'git',
      ['log', '--follow', '--format=%cI', '--', relative(ROOT, file)],
      { cwd: ROOT, encoding: 'utf8' }
    )
      .split('\n')
      .map((date) => date.trim())
      .filter(Boolean)
  } catch {
    // A working-tree-only page has no commit date yet. Dev builds may omit its
    // dates; release CD runs this again after the page is committed.
  }

  if (commits.length) {
    output[source] = {
      published: commits.at(-1),
      modified: commits[0],
    }
  } else if (previous[source]) {
    output[source] = previous[source]
  }
}

writeFileSync(TARGET, `${JSON.stringify(output, null, 2)}\n`)
console.log(`gen-page-dates: ${Object.keys(output).length} records`)
