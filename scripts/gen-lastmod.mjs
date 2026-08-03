#!/usr/bin/env node
//
// Writes docs/.vitepress/lastmod.json — the real last-edit date of every page,
// taken from the commit that last touched it.
//
// WHY NOT VitePress's own `lastUpdated`. It shells out to git at build time, and
// the build happens inside a Docker image where `.git` is excluded from the
// context on purpose (see .dockerignore) and `git` is not installed at all. The
// first attempt therefore died with `spawn git ENOENT` on the first page — a
// failure that only appears in CI, because every local build has both.
//
// So the date is computed where git exists and committed as data. A generated
// artifact in the tree is a cost; a sitemap with no `<lastmod>` on 129 URLs is a
// bigger one, and a `lastmod` that LIES is worse than either — Google stops
// trusting the signal for the whole site, not just the page.
//
// Runs as part of `prebuild`. Where git is missing it does nothing and leaves the
// committed file in place, which is exactly what the image build needs.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const DOCS = join(ROOT, 'docs')
const TARGET = join(DOCS, '.vitepress', 'lastmod.json')

const gitWorks = () => {
    try {
        execFileSync('git', ['rev-parse', '--git-dir'], { cwd: ROOT, stdio: 'pipe' })
        return true
    } catch {
        return false
    }
}

if (!gitWorks()) {
    console.log('gen-lastmod: git недоступен — оставляю закоммиченный lastmod.json')
    process.exit(0)
}

const walk = (dir, acc = []) => {
    if (!existsSync(dir)) return acc
    for (const name of readdirSync(dir)) {
        if (name.startsWith('.') || name === 'public') continue
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full, acc)
        else if (name.endsWith('.md')) acc.push(full)
    }
    return acc
}

const out = {}
for (const file of walk(DOCS)) {
    const rel = relative(DOCS, file).split(/[\\/]/).join('/')
    try {
        const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], {
            cwd: ROOT,
            encoding: 'utf8',
        }).trim()
        // A file that has never been committed has no date to state. Leaving it
        // out is honest; inventing "now" would put a fresh date on a page that
        // has not changed, which is the lie this exists to avoid.
        if (iso) out[rel] = iso
    } catch {
        // Ignore: same reasoning as above.
    }
}

writeFileSync(TARGET, `${JSON.stringify(out, null, 2)}\n`)
console.log(`gen-lastmod: ${Object.keys(out).length} страниц`)
