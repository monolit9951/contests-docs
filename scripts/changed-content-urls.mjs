#!/usr/bin/env node
// Resolve a git diff to canonical production URLs through the versioned content
// manifest. Translations share one semantic page id but keep distinct URLs.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)
  return index < 0 ? fallback : process.argv[index + 1]
}
const git = (args) => execFileSync('git', args, {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})
const manifestAt = (revision) => {
  try {
    return JSON.parse(git(['show', `${revision}:docs/content-pages.json`]))
  } catch {
    return null
  }
}

const topology = (manifest, fallback) => ({
  origin: manifest.origin ?? fallback.origin ?? 'https://darebay.com',
  locales: manifest.locales ?? fallback.locales,
  hubs: manifest.hubs ?? fallback.hubs,
})
export const pathsForManifest = (manifest, fallback = manifest) => {
  if (!manifest) return { bySource: new Map(), all: new Set(), retired: new Set() }
  const { origin, locales, hubs } = topology(manifest, fallback)
  const bySource = new Map()
  const all = new Set()
  const retired = new Set()
  for (const page of manifest.pages ?? []) {
    for (const [locale, slug] of Object.entries(page.slugs ?? {})) {
      const axis = locales[locale]
      const hub = hubs[page.hub]?.[locale]
      if (!axis || !hub) continue
      const prefix = axis.prefix ?? ''
      const path = slug === '' ? `${prefix}/${hub}/` : `${prefix}/${hub}/${slug}`
      const dir = axis.vitepressKey === 'root' ? '' : `${axis.vitepressKey}/`
      const source = slug === '' ? `${dir}${hub}/index.md` : `${dir}${hub}/${slug}.md`
      const url = `${origin}${path}`
      bySource.set(`docs/${source}`, url)
      all.add(url)
    }
    for (const path of page.retired ?? []) retired.add(`${origin}${path}`)
  }
  return { bySource, all, retired }
}

export const isGlobalSurface = (path) =>
  path === 'docs/content-pages.json' ||
  path === 'docs/page-dates.json' ||
  path.startsWith('docs/.vitepress/') ||
  path === 'package.json' ||
  path === 'package-lock.json' ||
  path === 'nginx.conf' ||
  path.startsWith('scripts/finalize-dist.') ||
  path.startsWith('scripts/gen-llms.')

export const urlsForChanges = ({ lines, oldManifest, newManifest }) => {
  const oldPaths = pathsForManifest(oldManifest, newManifest)
  const newPaths = pathsForManifest(newManifest, newManifest)
  const urls = new Set()

  for (const line of lines) {
    const [status, ...paths] = line.split('\t')
    if (paths.includes('docs/content-pages.json')) {
      // A manifest edit can create, rename, delete or retire URLs. Notify both
      // sides of the topology, including redirect-only addresses. This also
      // makes the first manifest-backed release safe when no previous manifest
      // exists in git: the new manifest's historical `retired` set still tells
      // crawlers which old URLs changed.
      for (const url of oldPaths.all) urls.add(url)
      for (const url of oldPaths.retired) urls.add(url)
      for (const url of newPaths.all) urls.add(url)
      for (const url of newPaths.retired) urls.add(url)
      continue
    }
    if (paths.some(isGlobalSurface)) {
      // Config/build changes affect the currently deployed documents. A
      // separate manifest diff, when present, handles its old topology above.
      for (const url of newPaths.all) urls.add(url)
      continue
    }
    if (status.startsWith('R') || status.startsWith('C')) {
      const [from, to] = paths
      if (oldPaths.bySource.has(from)) urls.add(oldPaths.bySource.get(from))
      if (newPaths.bySource.has(to)) urls.add(newPaths.bySource.get(to))
      continue
    }
    const [path] = paths
    if (!path?.endsWith('.md')) continue
    if (status === 'D') {
      if (oldPaths.bySource.has(path)) urls.add(oldPaths.bySource.get(path))
    } else if (newPaths.bySource.has(path)) {
      urls.add(newPaths.bySource.get(path))
    }
  }
  return [...urls].sort()
}

const main = () => {
  const base = arg('base', 'HEAD^')
  const head = arg('head', 'HEAD')
  const currentManifest = JSON.parse(readFileSync(join(ROOT, 'docs', 'content-pages.json'), 'utf8'))
  const oldManifest = manifestAt(base)
  const lines = git(['diff', '--name-status', '-M', base, head]).trim().split('\n').filter(Boolean)
  for (const url of urlsForChanges({ lines, oldManifest, newManifest: currentManifest })) console.log(url)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
