#!/usr/bin/env node --experimental-strip-types
// Renders every page of the built corpus in a real browser and reports layout defects that
// valid markup and green HTML gates cannot see: a header that pushes the document sideways on
// a phone, a table whose header labels drift off their columns, a code block with no scroll box.
// Every one of those shipped at least once — the HTML was correct each time and only the CSS
// was wrong, so `check:dist` had nothing to fail on.
//
// Needs a Chromium build; CI has none, so this is a local tool, not a build gate. Point CHROME
// at a binary or let it find one of the usual paths.

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'docs', '.vitepress', 'dist')
const { PAGES, localesOf, pagePath } = await import(join(ROOT, 'docs', '.vitepress', 'registry.ts'))

const puppeteerCache = join(process.env.HOME ?? '', '.cache', 'puppeteer', 'chrome')
const CHROME_CANDIDATES = [
  process.env.CHROME,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  ...(existsSync(puppeteerCache)
    ? readdirSync(puppeteerCache).sort().map((build) => join(puppeteerCache, build, 'chrome-linux64', 'chrome'))
    : []),
].filter(Boolean)

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'desktop', width: 1440, height: 1000, mobile: false },
]

// Runs inside the page. Returns only defects a reader would see.
const PROBE = `(() => {
  const findings = []
  const describe = (el) => {
    if (!el) return '?'
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '')
  }
  const label = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60)
  const root = document.documentElement

  // A wide box only widens the page when nothing on the way up clips or scrolls it.
  if (root.scrollWidth > root.clientWidth + 1) {
    for (const el of document.querySelectorAll('body *')) {
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      if (box.right <= root.clientWidth + 1 && box.left >= -1) continue
      let clipped = false
      for (let p = el.parentElement; p && p !== root && !clipped; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== 'visible') clipped = true
      }
      if (!clipped) findings.push({ kind: 'page-overflow-x', detail: describe(el) + ' reaches x=' + Math.round(box.right) + ' in a ' + root.clientWidth + 'px viewport ("' + label(el) + '")' })
    }
  }

  // Header labels must sit over the cells they name.
  for (const table of document.querySelectorAll('table')) {
    const head = table.tHead && table.tHead.rows[0]
    const body = table.tBodies[0] && table.tBodies[0].rows[0]
    if (!head || !body) continue
    if (head.cells.length !== body.cells.length) {
      findings.push({ kind: 'table-cell-count', detail: describe(table) + ': ' + head.cells.length + ' header cells vs ' + body.cells.length + ' in the first row' })
      continue
    }
    for (let i = 0; i < head.cells.length; i++) {
      const a = head.cells[i].getBoundingClientRect()
      const b = body.cells[i].getBoundingClientRect()
      if (Math.abs(a.left - b.left) > 1.5 || Math.abs(a.width - b.width) > 1.5) {
        findings.push({ kind: 'table-misaligned', detail: describe(table) + ' column ' + (i + 1) + ' ("' + label(head.cells[i]) + '"): header at ' + Math.round(a.left) + '/' + Math.round(a.width) + ', cell at ' + Math.round(b.left) + '/' + Math.round(b.width) })
        break
      }
    }
  }

  // An in-page link that lands nowhere.
  for (const link of document.querySelectorAll('a[href^="#"]')) {
    const href = link.getAttribute('href')
    if (href.length < 2) continue
    let target = null
    try { target = document.querySelector(href) } catch { target = document.getElementById(decodeURIComponent(href.slice(1))) }
    if (!target) findings.push({ kind: 'dead-anchor', detail: describe(link) + ' -> ' + href })
  }

  // Text wider than the box it lives in, with nothing to scroll it.
  for (const el of document.querySelectorAll('.lp-content *')) {
    if (el.children.length || !(el.textContent || '').trim()) continue
    if (getComputedStyle(el).overflowX !== 'visible') continue
    if (el.scrollWidth > el.clientWidth + 2) {
      findings.push({ kind: 'text-spill', detail: describe(el) + ': ' + el.scrollWidth + 'px of text in a ' + el.clientWidth + 'px box ("' + label(el) + '")' })
    }
  }
  return findings
})()`

const paths = PAGES.flatMap((page) => localesOf(page).map((locale) => pagePath(page, locale)))
const auditedPaths = new Set(paths)

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' }
const missing = new Set()
const serve = () => new Promise((resolve) => {
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost')
    const base = normalize(join(DIST, decodeURIComponent(url.pathname)))
    if (!base.startsWith(DIST)) { response.writeHead(403).end(); return }
    // `cleanUrls` means a page address carries no extension while the build writes `.html`.
    // Serving only the literal path answered 404 for every leaf page, and an audit that reads
    // 404 documents reports no defects at all — which is how this file first passed on a build
    // whose tables were deliberately broken.
    const file = [base, `${base}.html`, join(base, 'index.html')].find((candidate) => existsSync(candidate) && !candidate.endsWith('/'))
    // Only a page address that cannot be served is a defect. The page's own beacons (the
    // analytics POST, for one) have no document here by design.
    if (!file) { if (auditedPaths.has(url.pathname)) missing.add(url.pathname); response.writeHead(404).end(); return }
    const extension = file.slice(file.lastIndexOf('.'))
    response.writeHead(200, { 'content-type': MIME[extension] ?? 'application/octet-stream' })
    response.end(readFileSync(file))
  })
  server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
})

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function connect(port) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  const pending = new Map()
  const events = []
  let sequence = 0
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id) }
    else if (message.method) events.push(message)
  })
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, (message) => (message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result)))
    socket.send(JSON.stringify({ id, method, params }))
  })
  return { socket, send, events }
}

const binary = CHROME_CANDIDATES.find((candidate) => existsSync(candidate))
if (!binary) {
  console.error('layout-audit: no Chromium found. Set CHROME=/path/to/chrome (CI images have none).')
  process.exit(2)
}
if (!existsSync(join(DIST, 'sitemap-content.xml'))) {
  console.error('layout-audit: no build to read. Run `DOCS_ENV=prod npm run docs:build` first.')
  process.exit(2)
}

const { server, port } = await serve()
const debugPort = 9222 + (process.pid % 500)
const chrome = spawn(binary, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)

const failures = []
const { socket, send, events } = await connect(debugPort)
await send('Page.enable')

for (const viewport of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile })
  for (const path of paths) {
    events.length = 0
    await send('Page.navigate', { url: `http://127.0.0.1:${port}${path}` })
    for (let waited = 0; waited < 8000 && !events.some((event) => event.method === 'Page.loadEventFired'); waited += 120) await sleep(120)
    await sleep(350)
    const result = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true })
    const findings = result.result?.value
    if (!Array.isArray(findings)) { failures.push(`[probe] ${viewport.name} ${path}: ${JSON.stringify(result).slice(0, 160)}`); continue }
    for (const finding of findings) failures.push(`[${finding.kind}] ${viewport.name} ${path}: ${finding.detail}`)
  }
  console.log(`layout audit: ${viewport.name} ${viewport.width}px, ${paths.length} pages`)
}

socket.close()
chrome.kill()
server.close()

for (const path of missing) failures.push(`[not-served] ${path}: the build has no document at this address`)

if (failures.length) {
  console.error(`layout audit failed: ${failures.length}`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}
console.log(`layout audit: ${paths.length} pages × ${VIEWPORTS.length} viewports, 0 findings`)
