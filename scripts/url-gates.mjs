#!/usr/bin/env node --experimental-strip-types
//
// The migration gates, as real HTTP probes.
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
//        --app /root/code/contests-frontend
//
// ⚠️ ONE THING THIS DOES NOT COVER, and it cost a production outage. The probes
// compose their OWN nginx config out of both containers' `server` blocks. The
// real images do not: the base nginx image auto-includes every
// `/etc/nginx/conf.d/*.conf` at the HTTP level, so a file meant for a `server`
// block gets parsed a second time where its directives are illegal. That killed
// the content container on boot while every gate here was green.
//
// `scripts/image-boot-check.mjs` covers it by building and running the actual
// image. Keep both: this file is fast and checks addresses, that one is slow and
// checks that the thing even starts.
//
// Nothing here talks to production. It binds loopback ports and tears them down.

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FACT_IDS, FACTS_PUBLIC_PATH } from './gen-facts-json.mjs'
import { parseHreflangCluster, sameHreflangMap } from './hreflang-cluster.mjs'
import { readLocalSitemapTree } from './sitemap-tree.mjs'
import { appHtmlArtifactPath, expectedHtmlLocale } from './url-gate-locale.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CONTENT_ROOT = resolve(HERE, '..')

const argOf = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`)
    return i === -1 ? fallback : process.argv[i + 1]
}

const APP_ROOT = resolve(argOf('app', '/root/code/contests-frontend'))
const PORT_HOST = Number(argOf('port', '18099'))
const PORT_APP = PORT_HOST + 1
const PORT_CONTENT = PORT_HOST + 2
const ORIGIN = `http://127.0.0.1:${PORT_HOST}`

const {
    PAGES,
    HUBS,
    LOCALES,
    ROOT_LOCALE,
    pagePath,
    localesOf,
    hubIndexPath,
    redirectMap,
    CONTENT_ROOT_FILES,
    LEGACY_ROUTE_PREFIXES,
} = await import(join(CONTENT_ROOT, 'docs', '.vitepress', 'registry.ts'))
const { contestCanonicalForLocale } = await import(
    join(APP_ROOT, 'scripts', 'contest-seo-locales.mjs')
)
const { splitLocalePath: splitAppLocalePath } = await import(
    join(APP_ROOT, 'src', 'domain', 'i18n', 'localeRoute.ts')
)
const { routeFile: appRouteFile } = await import(
    join(APP_ROOT, 'scripts', 'seo-routes.mjs')
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
// a config that does not exist anywhere. Only runtime wiring is patched:
// listen/root, Docker's `backend` service DNS, and the cache directory. The
// directives and routing logic under test remain byte-for-byte shipped.
const containerServer = (confPath, root, port) =>
    readFileSync(confPath, 'utf8')
        .replace(/listen\s+80;/, `listen ${port};`)
        .replace(/root\s+\/usr\/share\/nginx\/html;/, `root ${root};`)
        .replaceAll('http://backend:8080', 'http://127.0.0.1:65534')
        .replaceAll('/var/cache/nginx/seo-validation', join(work, 'seo-validation'))
        .replace(/include\s+\/etc\/nginx\/snippets\/redirects\.conf;/, `include ${join(CONTENT_ROOT, 'redirects.conf')};`)

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

// One arbitrary content page, used by the asset and entity gates below as "a
// document this container serves". Its locale is read off the page rather than
// assumed to be the root one: what those gates need is an address that answers
// 200 from the content container, and every registry entry has at least one.
const SAMPLE_CONTENT_PATH = pagePath(PAGES[0], localesOf(PAGES[0])[0])

// A Location header may be absolute or relative depending on the container's
// `absolute_redirect`; the probe compares paths, so it normalises to one form.
const asPath = (location) => (location ?? '').replace(ORIGIN, '').replace('https://darebay.com', '') || null

const headCache = new Map()
const bodyCache = new Map()
const head = async (path) => {
    if (headCache.has(path)) return headCache.get(path)
    const res = await fetch(`${ORIGIN}${path}`, { redirect: 'manual' })
    const value = { status: res.status, location: asPath(res.headers.get('location')), headers: res.headers }
    headCache.set(path, value)
    return value
}
const body = async (path) => {
    if (bodyCache.has(path)) return bodyCache.get(path)
    const res = await fetch(`${ORIGIN}${path}`, { redirect: 'manual' })
    const value = { status: res.status, text: await res.text(), headers: res.headers }
    bodyCache.set(path, value)
    return value
}

const tag = (html, re) => [...html.matchAll(re)].map((m) => m[1])
const jsonLdNodes = (html) => {
    const nodes = []
    for (const match of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            const value = JSON.parse(match[1])
            if (Array.isArray(value?.['@graph'])) nodes.push(...value['@graph'])
            else nodes.push(value)
        } catch {
            // Page-specific JSON-LD validity belongs to each container's own
            // artifact gate. Entity parity below reports the stable nodes as
            // missing instead of duplicating that parser error here.
        }
    }
    return nodes
}

/** Every address the shipped artifacts claim, from the sitemaps themselves. */
const sitemapUrls = (file) => {
    try {
        return readLocalSitemapTree(APP_DIST, file).map((value) => {
            const url = new URL(value)
            return `${url.pathname}${url.search}`
        })
    } catch (error) {
        throw new Error(`cannot read local sitemap tree ${file}: ${error.message}`)
    }
}

const contentUrls = PAGES.flatMap((page) => localesOf(page).map((lang) => pagePath(page, lang)))
const contentUrlSet = new Set(contentUrls)

// The app owns its language axis, including app-only locales such as Polish.
// Content ownership is exact registry membership, not a shared URL prefix:
// `/ar/earnings/` belongs to docs while `/en/tasks` belongs to the application.
const axisOfPath = (url) => expectedHtmlLocale(url, {
    contentPaths: contentUrlSet,
    contentLocales: LOCALES,
    contentRootLocale: ROOT_LOCALE,
    splitAppLocalePath,
})
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
const appNginx = readFileSync(join(APP_ROOT, 'nginx.conf'), 'utf8')
const generatedBlock = (name) => {
    const match = appNginx.match(new RegExp(`# ${name}:start([\\s\\S]*?)# ${name}:end`))
    if (!match) throw new Error(`app nginx generated block ${name} is missing`)
    return match[1]
}
const appRedirectSource = `${generatedBlock('routes:redirects')}\n${generatedBlock('seo:aliases')}`
const appRedirects = Object.fromEntries(
    [...appRedirectSource.matchAll(
        /location = (\S+)\s*\{\s*return 301 (\S+);/g
    )].map(([, from, to]) => [from, to.replace(/\$is_args\$args$/, '')])
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

// The legacy host prefixes (/faq, /ru/<hub>, ...) reach the content container, not the
// application: the slash spelling of one leaf under each lands on the same target in one hop.
// A leaf's slash form is emitted by gen-nginx-redirects; without it `/ru/<hub>/<leaf>/` would
// hit the container's @slash_ru handler, which only knows files that exist on disk.
{
    const map = redirectMap()
    for (const prefix of LEGACY_ROUTE_PREFIXES) {
        const leaf = Object.keys(map)
            .filter((from) => from.startsWith(`${prefix}/`) && !from.endsWith('/') && !from.endsWith('/index'))
            .sort()[0]
        if (!leaf) continue
        const res = await head(`${leaf}/`)
        if (res.status !== 301 || res.location !== map[leaf]) {
            fail('1-legacy-slash', `${leaf}/ -> ${res.status} ${res.location}, ожидался 301 ${map[leaf]}`)
        }
    }
}

// Redirects preserve attribution parameters without multiplying public HTML
// forms. Probe one content migration through the actual generated nginx file.
{
    const [from, to] = Object.entries(redirectMap())[0] ?? []
    if (!from || !to) fail('1-redirect-query', 'content redirect map is empty')
    else {
        const query = '?utm_source=seo-gate'
        const response = await head(`${from}${query}`)
        if (response.status !== 301 || response.location !== `${to}${query}`) {
            fail('1-redirect-query', `${from}${query} -> ${response.status} ${response.location}`)
        }
    }
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
        const isUgc = /\/(tasks|store)\/[^/]+$/.test(url)
        if (canonicals[0] !== expected && !isUgc) fail('3-canonical', `${url}: canonical ${canonicals[0]}`)
    }

    const langs = tag(res.text, /<html[^>]+lang="([^"]+)"/g)
    const axis = axisOfPath(url)
    if (langs[0] !== axis.language) fail('6-html-lang', `${url}: lang="${langs[0]}", ожидался "${axis.language}"`)
    // A content page also carries its tree's writing direction: an Arabic page laid out left to
    // right is readable by nobody. The application's own documents are its gates' business.
    if (contentUrlSet.has(url)) {
        const dirs = tag(res.text, /<html[^>]+dir="([^"]+)"/g)
        if (dirs[0] !== axis.dir) fail('6-html-dir', `${url}: dir="${dirs[0]}", ожидался "${axis.dir}"`)
    }
}

// ---- 4. hreflang clusters are unique, same-origin and fully reciprocal -----
for (const url of allUrls) {
    const res = await body(url)
    if (res.status !== 200) continue
    const sourceCluster = parseHreflangCluster(res.text)
    if (!sourceCluster.entries.length) continue
    for (const error of sourceCluster.errors) fail('4-hreflang', `${url}: ${error}`)
    if (!sourceCluster.map.has('x-default')) fail('4-hreflang', `${url}: нет x-default`)

    const sourceAbsolute = new URL(url, 'https://darebay.com').href
    for (const href of new Set(sourceCluster.map.values())) {
        const targetUrl = new URL(href)
        const target = `${targetUrl.pathname}${targetUrl.search}`
        const probe = await head(target)
        if (probe.status !== 200) {
            fail('4-hreflang', `${url}: ${href} -> ${probe.status}`)
            continue
        }
        const targetDocument = await body(target)
        const reciprocal = parseHreflangCluster(targetDocument.text)
        for (const error of reciprocal.errors) fail('4-hreflang', `${target}: ${error}`)
        if (!sameHreflangMap(sourceCluster.map, reciprocal.map)) {
            fail('4-hreflang', `${url}: cluster differs on reciprocal target ${target}`)
        }
        if (![...reciprocal.map.values()].includes(sourceAbsolute)) {
            fail('4-hreflang', `${target}: reciprocal cluster does not reference source ${url}`)
        }
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

// The host must route the public semantic manifest to this container before
// its SPA fallback. A file that exists only inside the image is still a public
// 404 and cannot protect the frontend footer from stale translated slugs.
{
    const path = '/.well-known/darebay-content-pages.json'
    const res = await body(path)
    if (res.status !== 200) fail('5-manifest', `${path} -> ${res.status}`)
    const contentType = res.headers.get('content-type') ?? ''
    const cacheControl = res.headers.get('cache-control') ?? ''
    if (!/^application\/json\b/i.test(contentType)) fail('5-manifest', `content-type: ${contentType}`)
    if (!/no-cache/i.test(cacheControl) || !/must-revalidate/i.test(cacheControl)) {
        fail('5-manifest', `cache-control: ${cacheControl}`)
    }
    if (!/nosniff/i.test(res.headers.get('x-content-type-options') ?? '')) fail('5-manifest', 'нет nosniff')
    try {
        const actual = JSON.parse(res.text)
        const expected = JSON.parse(readFileSync(join(CONTENT_ROOT, 'docs', 'content-pages.json'), 'utf8'))
        if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('5-manifest', 'public JSON отличается от канона')
    } catch (error) {
        fail('5-manifest', `невалидный JSON: ${error.message}`)
    }
}

// The machine-readable fact card carries the same contract as the semantic manifest, for the same
// reason: an artifact that exists only inside the image is a public 404, and a comparison site or
// an assistant that cannot tell the bytes are JSON will not parse them. One extra rule of its own
// — it must stay OUT of the sitemaps. It is data to cite next to a page, not a page to send a
// reader to, and a JSON document in a sitemap is a soft-404 in the eyes of a crawler.
{
    const res = await body(FACTS_PUBLIC_PATH)
    if (res.status !== 200) fail('5-facts', `${FACTS_PUBLIC_PATH} -> ${res.status}`)
    const contentType = res.headers.get('content-type') ?? ''
    const cacheControl = res.headers.get('cache-control') ?? ''
    if (!/^application\/json\b/i.test(contentType)) fail('5-facts', `content-type: ${contentType}`)
    if (!/no-cache/i.test(cacheControl) || !/must-revalidate/i.test(cacheControl)) {
        fail('5-facts', `cache-control: ${cacheControl}`)
    }
    if (!/nosniff/i.test(res.headers.get('x-content-type-options') ?? '')) fail('5-facts', 'нет nosniff')
    try {
        const served = JSON.parse(res.text)
        const built = JSON.parse(readFileSync(join(CONTENT_DIST, FACTS_PUBLIC_PATH.slice(1)), 'utf8'))
        if (JSON.stringify(served) !== JSON.stringify(built)) fail('5-facts', 'ответ отличается от собранного артефакта')
        const ids = (served.facts ?? []).map((fact) => fact.id)
        if (ids.length !== FACT_IDS.length || ids.some((id, index) => id !== FACT_IDS[index])) {
            fail('5-facts', `поля: [${ids.join(', ')}]`)
        }
        for (const fact of served.facts ?? []) {
            if (!fact.source || !/^\d{4}-\d{2}-\d{2}$/.test(fact.asOf ?? '')) {
                fail('5-facts', `${fact.id}: нет source или asOf`)
            }
        }
    } catch (error) {
        fail('5-facts', `невалидный JSON: ${error.message}`)
    }
    const sitemap = await body('/sitemap-content.xml')
    if (sitemap.text.includes(FACTS_PUBLIC_PATH)) fail('5-facts', 'машинная карточка попала в sitemap-content.xml')
}

// llms.txt is linked from the fact card, so crawlers now find it. Two rules of its own: an explicit
// UTF-8 charset, because a client that follows HTTP's default for text/* reads the Russian and
// Ukrainian sections as Latin-1, and noindex, so the raw file stays out of web search while an
// assistant can still fetch it.
{
    const res = await body('/llms.txt')
    if (res.status !== 200) fail('5-llms', `/llms.txt -> ${res.status}`)
    const contentType = res.headers.get('content-type') ?? ''
    if (!/^text\/plain;\s*charset=utf-8$/i.test(contentType)) fail('5-llms', `content-type: ${contentType}`)
    if (!/\bnoindex\b/i.test(res.headers.get('x-robots-tag') ?? '')) fail('5-llms', 'нет X-Robots-Tag noindex')
    if (res.text !== readFileSync(join(CONTENT_DIST, 'llms.txt'), 'utf8')) {
        fail('5-llms', 'ответ отличается от собранного артефакта')
    }
}

// The same rule for everything else this container serves as text. Until 2026-09-21 only llms.txt
// named its encoding: pages went out as a bare `text/html` and the content sitemap as a bare
// `text/xml`. `<meta charset>` rescues a browser, not a crawler or an assistant that trusts the
// header, and the Arabic tree has no Latin reading to be mistaken for. JSON is left out on
// purpose: it is UTF-8 by definition and takes no charset parameter. The localized 404 documents
// are held to the same header in gate 7.
for (const url of contentUrls) {
    const contentType = (await head(url)).headers.get('content-type') ?? ''
    if (!/^text\/html;\s*charset=utf-8$/i.test(contentType)) fail('5-charset', `${url}: content-type: ${contentType}`)
}
{
    const contentType = (await head('/sitemap-content.xml')).headers.get('content-type') ?? ''
    if (!/^text\/xml;\s*charset=utf-8$/i.test(contentType)) {
        fail('5-charset', `/sitemap-content.xml: content-type: ${contentType}`)
    }
}

{
    const key = 'f54f4783c3e2566c84087cd19b829ddc'
    const res = await body(`/${key}.txt`)
    if (res.status !== 200 || res.text.trim() !== key) {
        fail('5-indexnow-key', `root key -> ${res.status} ${JSON.stringify(res.text.trim())}`)
    }
}

// ---- 7. unknown content is a localized, non-indexable real 404 -------------
// One miss under the home hub of every declared tree (its earnings hub: every tree has it, gate
// `locale-without-home` of check-registry), plus the retired `/docs/` prefix. A tree added to the
// manifest is probed here the day it is declared: its container location, its 404 document and
// that document's direction.
//
// Plus the root of every section that has pages in a tree but no index there yet — a tree may
// open with fewer sections than the others (Arabic starts with earnings alone, while its fact
// card lives under About). The host routes that section to the container, the directory exists
// and has no index.html, and nginx's own answer to that is a 403.
const sectionsWithoutIndex = LOCALES.flatMap((locale) =>
    Object.keys(HUBS)
        .filter((hub) => PAGES.some((page) => page.hub === hub && page.slugs[locale.language] !== undefined))
        .filter((hub) => !hubIndexPath(hub, locale.language))
        .map((hub) => [`${locale.prefix}/${HUBS[hub][locale.language]}/`, locale])
)
for (const [junk, axis] of [
    ...LOCALES.map((locale) => [`${hubIndexPath('earnings', locale.language)}nope-nothing-here`, locale]),
    ...sectionsWithoutIndex,
    ['/docs/nope-nothing-here', ROOT_LOCALE],
    // A legacy host prefix is taken from the application only to answer its known spellings;
    // anything else under it is this container's own localized 404, never a soft redirect. The
    // bare and /ru spellings are the root tree's; a prefix under a tree's own segment, its tree's.
    ...LEGACY_ROUTE_PREFIXES.map((prefix) => [
        `${prefix}/nope-nothing-here`,
        LOCALES.find((axis) => axis.prefix && prefix.startsWith(`${axis.prefix}/`)) ?? ROOT_LOCALE,
    ]),
]) {
    const language = axis.language
    const res = await body(junk)
    if (res.status !== 404) fail('7-404', `${junk} -> ${res.status}, ожидался 404`)
    if (!new RegExp(`<html\\b[^>]*lang="${language}"`).test(res.text)) {
        fail('7-404', `${junk}: нет локализованного lang="${language}"`)
    }
    if (!new RegExp(`<html\\b[^>]*dir="${axis.dir}"`).test(res.text)) {
        fail('7-404', `${junk}: нет dir="${axis.dir}"`)
    }
    if (!/<meta name="robots" content="noindex, follow">/.test(res.text)) {
        fail('7-404', `${junk}: нет meta robots noindex`)
    }
    if (!/noindex/i.test(res.headers.get('x-robots-tag') ?? '')) fail('7-404', `${junk}: нет X-Robots-Tag`)
    if (!/no-store/i.test(res.headers.get('cache-control') ?? '')) fail('7-404', `${junk}: 404 можно закешировать`)
    const contentType = res.headers.get('content-type') ?? ''
    if (!/^text\/html;\s*charset=utf-8$/i.test(contentType)) fail('7-404', `${junk}: content-type: ${contentType}`)
}

// Clean URLs are the only 200 form. VitePress writes .html files, but exposing
// both forms splits links and crawl signals across duplicate addresses.
//
// Two samples, because the two shapes are answered by different nginx rules:
// the first entry (a hub, written to `<hub>/index.html`) and the first LEAF in
// any locale (`<slug>.html`). The leaf used to be picked by a truthy
// `entry.slugs.ru`, which asked two questions at once — "has Russian" and "is
// not a hub" — and would silently pick nothing on a corpus of pages without a
// Russian version.
for (const page of PAGES.slice(0, 1).concat(
    PAGES.filter((entry) => localesOf(entry).some((language) => entry.slugs[language] !== '')).slice(0, 1)
)) {
    for (const language of localesOf(page)) {
        const clean = pagePath(page, language)
        const nonCanonical = clean.endsWith('/') ? `${clean}index.html` : `${clean}.html`
        const res = await head(nonCanonical)
        if (res.status !== 301 || res.location !== clean) {
            fail('7-clean-url', `${nonCanonical} -> ${res.status} ${res.location}, ожидался 301 ${clean}`)
        }
        const canonical = await head(clean)
        if (!/no-cache/i.test(canonical.headers.get('cache-control') ?? '')) {
            fail('7-cache', `${clean}: HTML cache-control не требует revalidate`)
        }
    }
}

// A hub has one canonical spelling too. The host needs an exact bare-segment
// route so nginx can add the slash; otherwise `/zarabotok` falls into the SPA
// while `/zarabotok/` reaches content, splitting links across two renderers.
for (const page of PAGES.filter((entry) => localesOf(entry).some((language) => entry.slugs[language] === ''))) {
    for (const language of localesOf(page)) {
        if (page.slugs[language] !== '') continue
        const canonical = pagePath(page, language)
        const bare = canonical.slice(0, -1)
        const res = await head(bare)
        if (res.status !== 301 || res.location !== canonical) {
            fail('7-hub-slash', `${bare} -> ${res.status} ${res.location}, ожидался 301 ${canonical}`)
        }
    }
}

// `/<hub>/index` is the file name VitePress writes the hub to, not an address.
// `try_files $uri $uri/ $uri.html` resolved it anyway and served the hub with a
// 200 and a canonical pointing at `/<hub>/` — fifteen crawlable duplicates that
// only a live probe could see, because nothing in the build ever emits the
// address. `/<hub>/index/` stays a real 404: a file name with a trailing slash
// was never an address, and redirecting it would invent one.
for (const page of PAGES.filter((entry) => localesOf(entry).some((language) => entry.slugs[language] === ''))) {
    for (const language of localesOf(page)) {
        if (page.slugs[language] !== '') continue
        const canonical = pagePath(page, language)
        const fileName = `${canonical}index`
        const res = await head(fileName)
        if (res.status !== 301 || res.location !== canonical) {
            fail('7-hub-index', `${fileName} -> ${res.status} ${res.location}, ожидался 301 ${canonical}`)
        } else {
            const landing = await head(res.location)
            if (landing.status !== 200) fail('7-hub-index', `${fileName} -> ${res.location} -> ${landing.status}`)
        }
        const slashed = await head(`${fileName}/`)
        if (slashed.status !== 404) fail('7-hub-index', `${fileName}/ -> ${slashed.status}, ожидался 404`)
        const extension = await head(`${fileName}.html`)
        if (extension.status !== 301 || extension.location !== canonical) {
            fail('7-hub-index', `${fileName}.html -> ${extension.status} ${extension.location}, ожидался 301 ${canonical}`)
        }
    }
}

// Every prerendered app artifact has one public spelling. Keep this separate
// from the retired-route parser: `/index.html` uses nginx variables for query
// preservation and is not a retired route with a literal target.
for (const canonical of new Set(appUrls)) {
    const raw = appHtmlArtifactPath(canonical, { splitAppLocalePath, routeFile: appRouteFile })
    const first = await head(raw)
    if (first.status !== 301 || first.location !== canonical) {
        fail('7-app-html', `${raw} -> ${first.status} ${first.location}, ожидался 301 ${canonical}`)
        continue
    }
    const second = await head(first.location)
    if (second.status !== 200) fail('7-app-html', `${raw} -> ${first.location} -> ${second.status}`)
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
        ['контент', SAMPLE_CONTENT_PATH],
        ['приложение', '/'],
    ]) {
        const res = await body(page)
        for (const href of tag(res.text, /<link[^>]+href="(\/[^"]+\.css)"/g).slice(0, 2)) {
            const probe = await head(href)
            if (probe.status !== 200) fail('8-assets', `${label}: ${page} грузит ${href} -> ${probe.status}`)
        }
    }

    const contentPage = await body(SAMPLE_CONTENT_PATH)
    const hashed = contentPage.text.match(
        /(?:href|src)="(\/content-assets\/[^"?]+\.[A-Za-z0-9_-]{8}(?:\.lean)?\.(?:js|mjs|css|woff2?|png|jpe?g|svg|webp))"/
    )?.[1]
    if (!hashed) fail('8-cache', 'не найден content-addressed asset для проверки cache policy')
    else {
        const response = await head(hashed)
        const cache = response.headers.get('cache-control') ?? ''
        if (response.status !== 200 || !/max-age=31536000/i.test(cache) || !/immutable/i.test(cache)) {
            fail('8-cache', `${hashed}: status=${response.status}, cache-control=${cache}`)
        }
    }
    for (const stable of [
        '/content-assets/logo.svg',
        '/content-assets/fonts/manrope-400-cyrillic.woff2',
    ]) {
        const response = await head(stable)
        const cache = response.headers.get('cache-control') ?? ''
        if (
            response.status !== 200 ||
            !/max-age=3600/i.test(cache) ||
            !/must-revalidate/i.test(cache) ||
            /immutable/i.test(cache)
        ) {
            fail('8-cache', `${stable}: status=${response.status}, cache-control=${cache}`)
        }
    }
}

// ---- 9. UGC: translated documents self-canonicalize; UI copies consolidate -
{
    const contest = sitemapUrls('sitemap-contests.xml').find((url) => url.startsWith('/tasks/'))
    if (contest) {
        const slug = contest.split('/').at(-1)
        const canonical = (await body(contest)).text
        const declared = tag(canonical, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/g)[0]
        if (declared !== `https://darebay.com${contest}`) {
            fail('9-ugc', `${contest}: canonical ${declared}`)
        }
        // A prefixed page is either an approved translated document (self
        // canonical, indexable) or an interface-only copy (root canonical,
        // noindex). The frontend's strict locale registry is the shared policy.
        for (const [language, prefix] of [['uk', '/ua'], ['en', '/en']]) {
            const res = await body(`${prefix}${contest}`)
            if (res.status !== 200) fail('9-ugc', `${prefix}: карточка конкурса -> ${res.status}`)
            const localCanonical = tag(res.text, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/g)[0]
            const expected = contestCanonicalForLocale(slug, language)
            if (localCanonical !== expected) {
                fail('9-ugc', `${prefix}${contest}: canonical ${localCanonical}, ожидался ${expected}`)
            }
            const robots = tag(res.text, /<meta[^>]+name="robots"[^>]+content="([^"]+)"/g)[0] ?? ''
            const selfCanonical = expected === `https://darebay.com${prefix}${contest}`
            if (selfCanonical && /noindex/i.test(robots)) {
                fail('9-ugc', `${prefix}${contest}: одобренный перевод помечен noindex`)
            }
            if (!selfCanonical && !/noindex/i.test(robots)) {
                fail('9-ugc', `${prefix}${contest}: интерфейсная копия не помечена noindex`)
            }
        }
    }
}

// ---- 10. every language-switcher link is a live address --------------------
// The switcher lives in the landing header (`.lp-lang`, theme/landing/LandingHeader.vue)
// since the whole corpus moved onto the landing shell on 2026-09-03; the stock
// VitePress `VPMenuLink` markup this gate first matched no longer exists on any page.
//
// The defect this exists for: VitePress builds the other locale's address by
// swapping the PREFIX on the current path, and our docs slugs are translated on
// purpose. On 2026-08-03 the menu offered 86 addresses across the Russian tree
// and 79 of them answered 404 — while the hreflang tags on the very same pages
// were correct. Nothing string-level could see it: the tags were right, the
// registry was right, only the rendered menu was wrong.
//
// Read out of the SHIPPED html, so it covers the prerendered markup a crawler
// reads and not just what the client would compute.
{
    let checked = 0
    for (const url of contentUrls) {
        const res = await body(url)
        if (res.status !== 200) continue
        const links = [
            ...(res.text.match(/class="lp-lang"[\s\S]*?<\/div>/)?.[0] ?? '').matchAll(/<a [^>]*href="([^"]+)"/g),
        ].map((m) => m[1])
        for (const href of new Set(links)) {
            checked += 1
            const probe = await head(href)
            if (probe.status !== 200) fail('10-switcher', `${url}: язык -> ${href} -> ${probe.status}`)
        }
    }
    if (!checked) fail('10-switcher', 'ни одной ссылки переключателя не найдено — селектор устарел?')
}

// The same for the section links beside it: the header's `.lp-nav` and the footer's `<nav>` print
// `NAV_HUBS` (config.ts), each section only where its index exists in that tree. A tree may have
// pages under a section and no index there (Arabic has its fact card under About and no About
// index), and a section link printed anyway is a 404 on every page of that tree. `chrome.test.ts`
// holds the rule on the config; this holds the shipped markup. Only site-relative links are
// probed: the footer's product and Telegram links leave this container.
{
    let checked = 0
    for (const url of contentUrls) {
        const res = await body(url)
        if (res.status !== 200) continue
        const chrome = [
            res.text.match(/<nav\b[^>]*class="lp-nav"[\s\S]*?<\/nav>/)?.[0] ?? '',
            res.text.match(/<footer\b[^>]*class="lp-footer"[\s\S]*?<\/footer>/)?.[0] ?? '',
        ].join('\n')
        const links = [...chrome.matchAll(/<a [^>]*href="(\/[^"]*)"/g)].map((m) => m[1])
        for (const href of new Set(links)) {
            checked += 1
            const probe = await head(href)
            if (probe.status !== 200) fail('10-sections', `${url}: раздел -> ${href} -> ${probe.status}`)
        }
    }
    if (!checked) fail('10-sections', 'ни одной ссылки разделов не найдено: селектор устарел?')
}

// ---- 11. the app and content pages describe one stable brand entity --------
//
// Two independently deployed renderers publish schema on one origin. Matching
// names are not enough: if their ids/logo/founder relationships drift, answer
// engines see two conflicting DareBay entities. Compare the actually served
// graphs, not the source constants that generated them.
{
    const stableIds = [
        'https://darebay.com/#logo',
        'https://darebay.com/#organization',
        'https://darebay.com/#founder',
        'https://darebay.com/#website',
    ]
    const contract = (html, surface) => {
        const nodes = jsonLdNodes(html)
        const selected = stableIds.map((id) => nodes.find((node) => node?.['@id'] === id))
        for (let index = 0; index < selected.length; index += 1) {
            if (!selected[index]) fail('11-entity', `${surface}: нет ${stableIds[index]}`)
        }
        if (selected.some((node) => !node)) return null
        const [logo, organization, founder, website] = selected
        return {
            logo: {
                type: logo['@type'],
                url: logo.url,
                contentUrl: logo.contentUrl,
                width: logo.width,
                height: logo.height,
            },
            organization: {
                type: organization['@type'],
                name: organization.name,
                url: organization.url,
                logo: organization.logo?.['@id'],
                sameAs: [...(organization.sameAs ?? [])].sort(),
            },
            founder: {
                type: founder['@type'],
                name: founder.name,
                url: founder.url,
                sameAs: [...(founder.sameAs ?? [])].sort(),
                worksFor: founder.worksFor?.['@id'],
            },
            website: {
                type: website['@type'],
                name: website.name,
                url: website.url,
                inLanguage: [...(website.inLanguage ?? [])].sort(),
                publisher: website.publisher?.['@id'],
            },
        }
    }
    const app = contract((await body('/')).text, 'app /')
    const contentPath = SAMPLE_CONTENT_PATH
    const content = contract((await body(contentPath)).text, `content ${contentPath}`)
    if (app && content && JSON.stringify(app) !== JSON.stringify(content)) {
        fail('11-entity', `app/content stable entity contracts differ:\napp=${JSON.stringify(app)}\ncontent=${JSON.stringify(content)}`)
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
    `✓ HTTP SEO-гейты пройдены: ${allUrls.length} адресов, ` +
        `${Object.keys(redirectMap()).length + Object.keys(appRedirects).length} редиректов, 0 замечаний`
)
