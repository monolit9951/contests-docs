#!/usr/bin/env node
// Build identity used by post-deploy jobs to wait for the exact content image,
// rather than assuming an SSH command makes a new reverse-proxy response
// immediately visible.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(ROOT, 'docs', 'public', '.well-known', 'darebay-content-release.txt')
const release = process.env.RELEASE_SHA || 'development'
if (release !== 'development' && !/^[a-f0-9]{7,40}$/i.test(release)) {
  throw new Error(`RELEASE_SHA is not a git revision: ${release}`)
}
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, `${release}\n`)
console.log(`content release marker: ${release}`)
