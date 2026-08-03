#!/usr/bin/env node --experimental-strip-types
//
// Generates the host-nginx snippet that routes content addresses to this
// container, from the registry.
//
// The host config (/etc/nginx/sites-enabled/darebay.com) proxies `/` to the
// application and a handful of prefixes elsewhere. Before the 2026-08 migration
// the content prefix was one line — `location ^~ /docs/`. Now it is one line per
// hub per locale, and a hand-maintained list would go stale the first time a hub
// is added: the hub would build, appear in the sitemap, and 404 in production,
// because the only thing that knew about it was a file nobody edited.
//
//   node --experimental-strip-types scripts/gen-host-nginx.mjs > /etc/nginx/snippets/darebay-content.conf
//
// The snippet is `include`d from inside the `server` block of the HTTPS vhost,
// BEFORE `location / {}`. nginx matches the longest `^~` prefix regardless of
// order, so placement only matters relative to regex locations.

import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const { CONTENT_SEGMENTS, CONTENT_ROOT_FILES } = await import(join(HERE, '..', 'docs', '.vitepress', 'registry.ts'))

const UPSTREAM = 'http://127.0.0.1:3002'

const proxy = (indent = '    ') =>
    [
        `${indent}proxy_pass          ${UPSTREAM};`,
        `${indent}proxy_http_version  1.1;`,
        '',
        `${indent}proxy_set_header    Host               $host;`,
        `${indent}proxy_set_header    X-Real-IP          $remote_addr;`,
        `${indent}proxy_set_header    X-Forwarded-For    $proxy_add_x_forwarded_for;`,
        `${indent}proxy_set_header    X-Forwarded-Proto  https;`,
        `${indent}proxy_set_header    X-Forwarded-Host   $host;`,
        `${indent}proxy_set_header    X-Forwarded-Port   443;`,
        '',
        `${indent}proxy_read_timeout  60;`,
    ].join('\n')

const out = []

out.push('# ⚙️ GENERATED — do not edit.')
out.push('#   node --experimental-strip-types scripts/gen-host-nginx.mjs (in contests-docs)')
out.push('#')
out.push('# Routes the content site to its container. One block per hub per locale, derived')
out.push('# from docs/.vitepress/registry.ts — a hub that exists in the registry is a hub')
out.push('# nginx serves, with no second list to forget.')
out.push('#')
out.push('# Only locales that HAVE pages appear here. Routing an empty Ukrainian branch')
out.push('# would answer a reader with the content container 404 instead of the app one,')
out.push('# and would show a crawler a section with nothing in it.')
out.push('')

for (const segment of CONTENT_SEGMENTS) {
    // Bare `/zarabotok` must reach the container too — it redirects to the
    // slashed form there. Sending it to the SPA instead would render the app's
    // 404 for an address that exists.
    out.push(`location = /${segment} {`)
    out.push(proxy())
    out.push('}')
    out.push(`location ^~ /${segment}/ {`)
    out.push(proxy())
    out.push('}')
    out.push('')
}

out.push('# Static assets of the content build. A distinct prefix and NOT /assets/,')
out.push("# which the application's bundles already own — see `assetsDir` in config.ts.")
out.push('location ^~ /content-assets/ {')
out.push(proxy())
out.push('}')
out.push('')

out.push('# Files the content build writes to its output root. Matched exactly: anything')
out.push('# under the domain root that is not one of these belongs to the application.')
for (const file of CONTENT_ROOT_FILES) {
    out.push(`location = ${file} {`)
    out.push(proxy())
    out.push('}')
}
out.push('')

out.push('# The retired /docs tree. It serves nothing now — every address under it is a')
out.push('# permanent redirect emitted by the container (redirects.conf). Kept forever:')
out.push('# these are the addresses Google has indexed for months.')
out.push('location = /docs {')
out.push(proxy())
out.push('}')
out.push('location ^~ /docs/ {')
out.push(proxy())
out.push('}')

console.log(out.join('\n'))
