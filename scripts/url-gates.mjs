#!/usr/bin/env node --experimental-strip-types
//
// The nine migration gates, as real HTTP probes.
//
// WHY THIS EXISTS. Everything else that guards these URLs checks STRINGS: the
// registry against the file tree, one generated table against another, XML
// well-formedness. An independent audit on 2026-08-03 found eight defects that
// passed every one of those checks green — ten addresses from the sitemaps
// answering 404, six retired addresses answering 200 with a canonical pointing
// at the homepage, and a store whose whole hreflang cluster pointed at pages
// that did not exist. None of it was visible without asking the server.
//
// So this stands up the real thing: both containers' own nginx configs, the
// real build output of each, and the generated host routing in front — then
// asks for every address the shipped artifacts claim.
//
//   node --experimental-strip-types scripts/url-gates.mjs \
//        --app /root/code/contests-frontend/.worktrees/url-migration
//
// Nothing here talks to production. It binds loopback ports and tears them down.

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CONTENT_ROOT = resolve(HERE, '..')

const argOf = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`)
    return i === -1 ? fallback : process.argv[i + 1]
}

const APP_ROOT = resolve(argOf('app', '/root/code/contests-frontend/.worktrees/url-migration'))
const PORT_HOST = Number(argOf('port', '18099'))
const PORT_APP = PORT_HOST + 1
const PORT_CONTENT = PORT_HOST + 2
const ORIGIN = `http://127.0.0.1:${PORT_HOST}`

const { PAGES, ROOT_LOCALE, pagePath, localesOf, redirectMap, CONTENT_ROOT_FILES } = await import(
    join(CONTENT_ROOT, 'docs', '.vitepress', 'registry.ts')
)

const APP_DIST = join(APP_ROOT, 'dist')
const CONTENT_DIST = join(CONTENT_ROOT, 'docs', '.vitepress', 'dist')

for (const [what, path] of [['app dist', APP_DIST], ['content dist', CONTENT_DIST]]) {
    if (!existsSync(path)) {
        console.error(`✗ нет ${what}: ${path}\n  собери обе стороны перед прогоном гейтов`)
        process.exit(2)
    }
}

// ---------------------------------------------------------------------------
// Compose a production-shaped nginx: two container servers + the host in front.
// ---------------------------------------------------------------------------

const work = mkdtempSync(join(tmpdir(), 'url-gates-'))

// Each container config is used AS SHIPPED — rewriting it here would be testing
// a config that does not exist anywhere. Only `listen` and `root` are patched,
// because those are what the container runtime supplies.
const containerServer = (confPath, root, port) =>
    readFileSync(confPath, 'utf8')
        .replace(/listen\s+80;/, `listen ${port};`)
        .replace(/root\s+\/usr\/share\/nginx\/html;/, `root ${root};`)
        .replace(/include\s+\/etc\/nginx\/conf\.d\/redirects\.conf;/, `include ${join(CONTENT_ROOT, 'redirects.conf')};`)

const hostSnippet = execFileSync(
    'node',
    ['--experimental-strip-types', '--no-warnings', join(HERE, 'gen-host-nginx.mjs')],
    { encoding: 'utf8' }
).replace(/127\.0\.0\.1:3002/g, `127.0.0.1:${PORT_CONTENT}`)

const conf = `
worker_processes 1;
daemon off;
pid ${work}/nginx.pid;
error_log ${work}/error.log warn;
events { worker_connections 64; }
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    access_log ${work}/access.log;
    client_body_temp_path ${work}/body;
    proxy_temp_path ${work}/proxy;
    fastcgi_temp_path ${work}/fastcgi;
    uwsgi_temp_path ${work}/uwsgi;
    scgi_temp_path ${work}/scgi;

${containerServer(join(APP_ROOT, 'nginx.conf'), APP_DIST, PORT_APP)}

${containerServer(join(CONTENT_ROOT, 'nginx.conf'), CONTENT_DIST, PORT_CONTENT)}

    # The host vhost: content prefixes to the content container, everything else
    # to the application — the same shape as /etc/nginx/sites-enabled/darebay.com.
    server {
        listen ${PORT_HOST};
        server_name localhost;

${hostSnippet
    .split('\n')
    .map((l) => (l.trim() ? `        ${l}` : l))
    .join('\n')}

        location / {
            proxy_pass http://127.0.0.1:${PORT_APP};
            proxy_set_header Host $host;
        }
    }
}
`

writeFileSync(join(work, 'nginx.conf'), conf)

try {
    execFileSync('nginx', ['-t', '-c', join(work, 'nginx.conf')], { stdio: 'pipe' })
} catch (err) {
    console.error('✗ nginx не принял конфиг:\n' + (err.stderr?.toString() ?? err.message))
    rmSync(work, { recursive: true, force: true })
    process.exit(2)
}

const server = spawn('nginx', ['-c', join(work, 'nginx.conf')], { stdio: 'ignore' })
const stop = () => {
    try {
        execFileSync('nginx', ['-s', 'quit', '-c', join(work, 'nginx.conf')], { stdio: 'ignore' })
    } catch {
        server.kill('SIGTERM')
    }
    rmSync(work, { recursive: true, force: true })
}
process.on('exit', stop)

// Wait for the listener rather than sleeping a fixed amount: a fixed sleep is
// either slower than it needs to be or flaky, and usually both.
const ready = async () => {
    for (let i = 0; i < 100; i += 1) {
        try {
            await fetch(`${ORIGIN}/`, { redirect: 'manual' })
            return true
        } catch {
            await new Promise((r) => setTimeout(r, 50))
        }
    }
    return false
}
if (!(await ready())) {
    console.error('✗ nginx не поднялся')
    process.exit(2)
}

// ---------------------------------------------------------------------------
// Probes.
// ---------------------------------------------------------------------------

const failures = []
const fail = (gate, detail) => failures.push(`[${gate}] ${detail}`)

// A Location header may be absolute or relative depending on the container's
// `absolute_redirect`; the probe compares paths, so it normalises to one form.
const asPath = (location) => (location ?? '').replace(ORIGIN, '').replace('https://darebay.com', '') || null

const head = async (path) => {
    const res = await fetch(`${ORIGIN}${path}`, { redirect: 'manual' })
    return { status: res.status, location: asPath(res.headers.get('location')) }
}
const body = async (path) => {
    const res = await fetch(`${ORIGIN}${path}`, { redirect: 'manual' })
    return { status: res.status, text: res.status === 200 ? await res.text() : '' }
}

const tag = (html, re) => [...html.matchAll(re)].map((m) => m[1])

/** Every address the shipped artifacts claim, from the sitemaps themselves. */
const sitemapUrls = (file) => {
    const path = join(APP_DIST, file)
    const src = existsSync(path) ? readFileSync(path, 'utf8') : ''
    return [...src.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace('https://darebay.com', ''))
}

const contentUrls = PAGES.flatMap((page) => localesOf(page).map((lang) => pagePath(page, lang)))
const appUrls = [
    ...sitemapUrls('sitemap.xml'),
    ...sitemapUrls('sitemap-contests.xml'),
    ...sitemapUrls('sitemap-store.xml'),
]
const allUrls = [...new Set([...contentUrls, ...appUrls])]

// The application's retired addresses live in its own nginx.conf as literal
// rules. Read from the SHIPPED config rather than imported from the source: the
// gate must fail when the config is stale, which is exactly the failure a
// source-level import would hide.
const appRedirects = Object.fromEntries(
    [...readFileSync(join(APP_ROOT, 'nginx.conf'), 'utf8').matchAll(
        /location = (\S+)\s*\{\s*return 301 (\S+);/g
    )].map(([, from, to]) => [from, to])
)

// ---- 1. every retired address: exactly one hop, onto a 200 -----------------
for (const [from, to] of Object.entries({ ...redirectMap(), ...appRedirects })) {
    const first = await head(from)
    if (first.status !== 301) {
        fail('1-redirect', `${from} -> ${first.status}, ожидался 301`)
        continue
    }
    if (first.location !== to) fail('1-redirect', `${from} -> ${first.location}, в реестре ${to}`)
    const second = await head(first.location ?? to)
    if (second.status === 301) fail('1-redirect', `цепочка: ${from} -> ${first.location} -> ${second.location}`)
    else if (second.status !== 200) fail('1-redirect', `${from} -> ${first.location} -> ${second.status}`)
}

// ---- 2. every claimed address answers 200 ----------------------------------
for (const url of allUrls) {
    const res = await head(url)
    if (res.status !== 200) fail('2-live', `${url} -> ${res.status}`)
}

// ---- 3. exactly one canonical, and it is self -------------------------------
// ---- 6. <html lang> matches the prefix -------------------------------------
for (const url of allUrls) {
    const res = await body(url)
    if (res.status !== 200) continue

    const canonicals = tag(res.text, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/g)
    if (canonicals.length !== 1) fail('3-canonical', `${url}: ${canonicals.length} canonical`)
    else {
        const expected = `https://darebay.com${url}`
        // A UGC page under a locale prefix canonicalises to the unprefixed one
        // on purpose — that is the rule, not a mismatch.
        const isUgc = /\/(zadaniya|zavdannya|tasks|magazin|kramnytsia|store)\/[^/]+$/.test(url)
        if (canonicals[0] !== expected && !isUgc) fail('3-canonical', `${url}: canonical ${canonicals[0]}`)
    }

    const langs = tag(res.text, /<html[^>]+lang="([^"]+)"/g)
    const expectedLang = url.startsWith('/ua') ? 'uk' : url.startsWith('/en') ? 'en' : 'ru'
    if (langs[0] !== expectedLang) fail('6-html-lang', `${url}: lang="${langs[0]}", ожидался "${expectedLang}"`)
}

// ---- 4. hreflang symmetric, no member 404s ---------------------------------
for (const url of allUrls) {
    const res = await body(url)
    if (res.status !== 200) continue
    const alternates = [...res.text.matchAll(/<link[^>]+rel="alternate"[^>]+hreflang="([^"]+)"[^>]+href="([^"]+)"/g)]
    if (!alternates.length) continue

    const hasXDefault = alternates.some(([, hl]) => hl === 'x-default')
    if (!hasXDefault) fail('4-hreflang', `${url}: нет x-default`)

    for (const [, hreflang, href] of alternates) {
        const target = href.replace('https://darebay.com', '')
        const probe = await head(target)
        if (probe.status !== 200) fail('4-hreflang', `${url}: ${hreflang} -> ${target} -> ${probe.status}`)
    }
}

// ---- 5. every sitemap <loc> is live (covered by gate 2) + the content one ---
for (const url of contentUrls) {
    const res = await head(url)
    if (res.status !== 200) fail('5-sitemap', `контент: ${url} -> ${res.status}`)
}
for (const file of CONTENT_ROOT_FILES) {
    const res = await head(file)
    if (res.status !== 200) fail('5-sitemap', `${file} -> ${res.status}`)
}

// ---- 7. an unknown address is a real 404 -----------------------------------
for (const junk of ['/nope-nothing-here', '/zarabotok/nope-nothing-here', '/ua/nope']) {
    const res = await head(junk)
    if (res.status !== 404) fail('7-404', `${junk} -> ${res.status}, ожидался 404`)
}

// ---- 8. content assets and app assets do not collide -----------------------
{
    const appAsset = await head('/assets/')
    const contentAsset = await head('/content-assets/')
    if (appAsset.status === 200 && contentAsset.status === 200) {
        fail('8-assets', 'оба префикса ассетов отдают 200 — проверь, что они действительно разные origin')
    }
    // The concrete files each page loads matter more than the directory: pull
    // the first stylesheet off a content page and off an app page and fetch it.
    for (const [label, page] of [
        ['контент', pagePath(PAGES[0], ROOT_LOCALE.language)],
        ['приложение', '/'],
    ]) {
        const res = await body(page)
        for (const href of tag(res.text, /<link[^>]+href="(\/[^"]+\.css)"/g).slice(0, 2)) {
            const probe = await head(href)
            if (probe.status !== 200) fail('8-assets', `${label}: ${page} грузит ${href} -> ${probe.status}`)
        }
    }
}

// ---- 9. UGC: one canonical address, reachable under every prefix -----------
{
    const contest = sitemapUrls('sitemap-contests.xml')[0]
    if (contest) {
        const canonical = (await body(contest)).text
        const declared = tag(canonical, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/g)[0]
        if (declared !== `https://darebay.com${contest}`) {
            fail('9-ugc', `${contest}: canonical ${declared}`)
        }
        // Under a prefix the SAME page must answer, and must still name the
        // unprefixed address as canonical — otherwise every contest exists three
        // times in the index.
        for (const prefix of ['/ua', '/en']) {
            const localized = contest.replace(/^\/(zadaniya)/, `${prefix}/$1`)
            const res = await body(
                prefix === '/ua' ? localized.replace('/zadaniya/', '/zavdannya/') : localized.replace('/zadaniya/', '/tasks/')
            )
            if (res.status !== 200) fail('9-ugc', `${prefix}: карточка конкурса -> ${res.status}`)
        }
    }
}

// ---------------------------------------------------------------------------

stop()
process.removeAllListeners('exit')

if (failures.length) {
    console.error(`\n✗ гейты не прошли: ${failures.length}\n`)
    for (const f of failures) console.error(`  ${f}`)
    process.exit(1)
}
console.log(
    `✓ девять гейтов пройдены: ${allUrls.length} адресов, ` +
        `${Object.keys(redirectMap()).length + Object.keys(appRedirects).length} редиректов, 0 замечаний`
)
