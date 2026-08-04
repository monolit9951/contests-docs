#!/usr/bin/env node --experimental-strip-types
// Post-deploy probes through the public host. These prove that the generated
// host snippet was installed; a healthy docs container alone is insufficient.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const expectedSha = process.argv[2]
if (!expectedSha || !/^[a-f0-9]{7,40}$/i.test(expectedSha)) throw new Error('usage: probe-live-routing.mjs <git-sha>')
const expectedManifest = JSON.parse(readFileSync(join(ROOT, 'docs', 'content-pages.json'), 'utf8'))
const { CONTENT_ROOT_FILES, CONTENT_SEGMENTS, PAGES, localesOf, pagePath } = await import(
  join(ROOT, 'docs', '.vitepress', 'registry.ts')
)
const origin = 'https://darebay.com'
const failures = []
const fail = (detail) => failures.push(detail)
const request = async (path, method = 'GET') => {
  try {
    return await fetch(`${origin}${path}`, {
      method,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    fail(`${path}: ${error instanceof Error ? error.message : error}`)
    return null
  }
}

for (const file of CONTENT_ROOT_FILES) {
  const response = await request(`${file}?release=${expectedSha}`, 'HEAD')
  if (response && response.status !== 200) fail(`${file}: HTTP ${response.status}`)
}

const manifestResponse = await request(`/.well-known/darebay-content-pages.json?release=${expectedSha}`)
if (manifestResponse) {
  const contentType = manifestResponse.headers.get('content-type') ?? ''
  const cacheControl = manifestResponse.headers.get('cache-control') ?? ''
  if (manifestResponse.status !== 200) fail(`public manifest: HTTP ${manifestResponse.status}`)
  if (!/^application\/json\b/i.test(contentType)) fail(`public manifest: content-type ${contentType}`)
  if (!/no-cache/i.test(cacheControl) || !/must-revalidate/i.test(cacheControl)) {
    fail(`public manifest: cache-control ${cacheControl}`)
  }
  if (!/nosniff/i.test(manifestResponse.headers.get('x-content-type-options') ?? '')) {
    fail('public manifest: X-Content-Type-Options nosniff missing')
  }
  try {
    const actual = JSON.parse(await manifestResponse.text())
    if (JSON.stringify(actual) !== JSON.stringify(expectedManifest)) fail('public manifest differs from deployed source')
  } catch (error) {
    fail(`public manifest: invalid JSON (${error.message})`)
  }
}

const markerResponse = await request(`/.well-known/darebay-content-release.txt?release=${expectedSha}`)
if (markerResponse) {
  const marker = (await markerResponse.text()).trim()
  if (markerResponse.status !== 200 || marker !== expectedSha) {
    fail(`release marker: HTTP ${markerResponse.status}, body=${JSON.stringify(marker)}`)
  }
  if (!/no-store/i.test(markerResponse.headers.get('cache-control') ?? '')) fail('release marker: no-store missing')
}

// One actual page per generated host prefix. A new locale/hub therefore cannot
// pass merely because its files exist inside the container.
const paths = PAGES.flatMap((page) => localesOf(page).map((locale) => pagePath(page, locale)))
for (const segment of CONTENT_SEGMENTS) {
  const prefix = `/${segment}/`
  const page = paths.find((path) => path === prefix || path.startsWith(prefix))
  if (!page) {
    fail(`no registry page for host segment ${segment}`)
    continue
  }
  const response = await request(page, 'HEAD')
  if (response && response.status !== 200) fail(`${page}: HTTP ${response.status}`)
}

const leaf = paths.find((path) => !path.endsWith('/'))
if (leaf) {
  const response = await request(`${leaf}.html`, 'HEAD')
  if (response && (response.status !== 301 || new URL(response.headers.get('location'), origin).pathname !== leaf)) {
    fail(`${leaf}.html: expected one 301 to ${leaf}`)
  }
}

// Guard the root key owned by the frontend while replacing the content snippet.
const indexNowKey = 'f54f4783c3e2566c84087cd19b829ddc'
const keyResponse = await request(`/${indexNowKey}.txt`)
if (keyResponse) {
  const body = (await keyResponse.text()).trim()
  if (keyResponse.status !== 200 || body !== indexNowKey) {
    fail(`root IndexNow key: HTTP ${keyResponse.status}, body=${JSON.stringify(body)}`)
  }
}

if (failures.length) {
  console.error(`live routing probes failed: ${failures.length}`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}
console.log(`live routing probes: ${CONTENT_SEGMENTS.length} prefixes, ${CONTENT_ROOT_FILES.length} root files, manifest JSON OK`)
