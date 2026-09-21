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
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, normalize, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'docs', '.vitepress', 'dist')
const { PAGES, localesOf, pagePath } = await import(pathToFileURL(join(ROOT, 'docs', '.vitepress', 'registry.ts')).href)
export { PAGES, localesOf, pagePath }

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

// Keep the historical middle widths: the old header broke between phone and desktop while
// both extremes passed. Include narrow phones and portrait tablets as independent layouts.
const VIEWPORTS = [
  { name: 'small-phone', width: 320, height: 740, mobile: true },
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'portrait-tablet', width: 768, height: 1024, mobile: false },
  { name: 'compact', width: 900, height: 1000, mobile: false },
  { name: 'tablet', width: 1024, height: 768, mobile: false },
  { name: 'laptop', width: 1080, height: 1000, mobile: false },
  { name: 'desktop', width: 1440, height: 1000, mobile: false },
]

// Runs inside the page. Returns only defects a reader would see.
export const PROBE = `(() => {
  const findings = []
  const describe = (el) => {
    if (!el) return '?'
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '')
  }
  const label = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60)
  const root = document.documentElement
  const hiddenByClosedDetails = (el) => {
    for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName !== 'DETAILS' || ancestor.open) continue
      // Chromium may return text Range rectangles for the unpainted contents of a closed
      // native disclosure. Only its first direct summary remains rendered; nested closed
      // disclosures must satisfy the same condition at every level.
      const summary = Array.from(ancestor.children).find((child) => child.tagName === 'SUMMARY')
      if (!summary?.contains(el)) return true
    }
    return false
  }

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

  // Every label in the site header is one line, at every width: a section link or a language
  // name broken onto a second line is a row that does not fit, and nothing overflows to say so.
  const header = document.querySelector('.lp-header')
  if (header) {
    const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!(node.textContent || '').trim()) continue
      if (hiddenByClosedDetails(node.parentElement)) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const lines = new Set(Array.from(range.getClientRects()).filter((box) => box.width > 0 && box.height > 0).map((box) => Math.round(box.top)))
      if (lines.size > 1) findings.push({ kind: 'header-wrap', detail: describe(node.parentElement) + ' breaks onto ' + lines.size + ' lines ("' + label(node.parentElement) + '")' })
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

export const paths = PAGES.flatMap((page) => localesOf(page).map((locale) => pagePath(page, locale)))
const auditedPaths = new Set(paths)

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' }
const serve = (missing) => new Promise((resolve, reject) => {
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost')
    const base = normalize(join(DIST, decodeURIComponent(url.pathname)))
    if (base !== DIST && !base.startsWith(DIST + sep)) { response.writeHead(403).end(); return }
    // `cleanUrls` means a page address carries no extension while the build writes `.html`.
    // Serving only the literal path answered 404 for every leaf page, and an audit that reads
    // 404 documents reports no defects at all — which is how this file first passed on a build
    // whose tables were deliberately broken.
    const file = [base, `${base}.html`, join(base, 'index.html')].find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
    // Only a page address that cannot be served is a defect. The page's own beacons (the
    // analytics POST, for one) have no document here by design.
    if (!file) { if (auditedPaths.has(url.pathname)) missing.add(url.pathname); response.writeHead(404).end(); return }
    const extension = file.slice(file.lastIndexOf('.'))
    response.writeHead(200, { 'content-type': MIME[extension] ?? 'application/octet-stream' })
    response.end(readFileSync(file))
  })
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
})

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function connect(port) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT', signal: AbortSignal.timeout(5000) })).json()
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  const pending = new Map()
  const events = []
  let sequence = 0
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id) }
    else if (message.method) events.push(message)
  })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('Chromium socket timed out')) }, 5000)
    socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Chromium socket failed')) }, { once: true })
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method}: timed out`)) }, 10000)
    pending.set(id, (message) => {
      clearTimeout(timer)
      if (message.error) reject(new Error(`${method}: ${message.error.message}`))
      else resolve(message.result)
    })
    socket.send(JSON.stringify({ id, method, params }))
  })
  return { socket, send, events }
}

// Shared with the bounded interaction audit; one static server and CDP implementation.
// A private Chrome profile and OS-assigned debug port keep parallel audit sessions isolated.
export async function openAuditBrowser() {
  if (process.env.CHROME && !existsSync(process.env.CHROME)) throw new Error(`CHROME does not exist: ${process.env.CHROME}`)
  const binary = CHROME_CANDIDATES.find((candidate) => existsSync(candidate))
  if (!binary) throw new Error('no Chromium found. Set CHROME=/path/to/chrome (CI images have none).')
  if (!existsSync(join(DIST, 'sitemap-content.xml'))) throw new Error('no build to read. Run `DOCS_ENV=prod npm run docs:build` first.')
  const missing = new Set()
  const { server, port } = await serve(missing)
  const profile = mkdtempSync(join(tmpdir(), 'docs-ui-audit-'))
  const chrome = spawn(binary, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let socket, spawnError, stopBrowser
  chrome.once('error', (error) => { spawnError = error })
  const close = async () => {
    if (chrome.exitCode === null && chrome.signalCode === null && !spawnError) {
      const stopped = new Promise((resolve) => chrome.once('exit', resolve))
      if (stopBrowser) await stopBrowser().catch(() => {})
      const exited = await Promise.race([stopped.then(() => true), sleep(2000).then(() => false)])
      if (!exited) {
        chrome.kill()
        await Promise.race([stopped, sleep(2000)])
      }
    }
    socket?.close()
    server.close()
    // Chrome's child processes can finish an atomic Preferences write after the main process
    // exits. Re-enumerate the private directory on ENOTEMPTY, rather than retrying only rmdir.
    for (let attempt = 0; ; attempt++) {
      try { rmSync(profile, { recursive: true, force: true }); break }
      catch (error) {
        if (error.code !== 'ENOTEMPTY' || attempt >= 10) throw error
        await sleep(100)
      }
    }
  }
  try {
    const activePort = join(profile, 'DevToolsActivePort')
    for (let waited = 0; waited < 10000 && !existsSync(activePort) && !spawnError && chrome.exitCode === null; waited += 100) await sleep(100)
    if (spawnError) throw spawnError
    if (!existsSync(activePort)) throw new Error('Chromium did not start its debugging endpoint')
    const connection = await connect(Number(readFileSync(activePort, 'utf8').split('\n')[0]))
    socket = connection.socket
    const { send, events } = connection
    stopBrowser = () => send('Browser.close')
    await send('Page.enable')
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
      return result.result?.value
    }
    const waitFor = async (expression, timeout = 8000) => {
      const deadline = Date.now() + timeout
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return
        await sleep(100)
      }
      throw new Error(`condition timed out: ${expression.slice(0, 180)}`)
    }
    let viewport
    const emulate = async (next) => {
      viewport = next
      await send('Emulation.setDeviceMetricsOverride', { width: next.width, height: next.height, deviceScaleFactor: 1, mobile: next.mobile })
    }
    const navigate = async (path, { settle = 'interactive' } = {}) => {
      if (!auditedPaths.has(path)) throw new Error(`unregistered audit path: ${path}`)
      events.length = 0
      const navigation = await send('Page.navigate', { url: `http://127.0.0.1:${port}${path}` })
      if (navigation.errorText) throw new Error(`navigation failed: ${navigation.errorText}`)
      for (let waited = 0; waited < 8000 && !events.some((event) => event.method === 'Page.loadEventFired'); waited += 100) await sleep(100)
      if (!events.some((event) => event.method === 'Page.loadEventFired')) throw new Error('page load timed out')
      if (settle === 'layout') {
        // The layout probe reads SSR content and CSS geometry. Wait for actual font layout
        // and two painted frames rather than spending 350ms on every corpus page. Keep the
        // interaction audit's default delay: it also needs hydrated event handlers.
        await evaluate(`new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('fonts and paint readiness timed out')), 8000)
          document.fonts.ready.then(() => {
            requestAnimationFrame(() => requestAnimationFrame(() => {
              clearTimeout(timer)
              resolve(true)
            }))
          }, (error) => { clearTimeout(timer); reject(error) })
        })`)
      } else await sleep(350)
      // innerWidth measures the CSS layout viewport; clientWidth can be 15px narrower
      // when desktop Chromium reserves space for its vertical scrollbar.
      const measured = await evaluate('({ width: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, content: !!document.querySelector("#main-content") })')
      if (missing.has(path) || !measured?.content) throw new Error('build did not serve the page shell')
      if (measured.width !== viewport?.width) throw new Error(`viewport is ${measured.width}px; expected ${viewport?.width}px (document clientWidth=${measured.clientWidth}px, scrollWidth=${measured.scrollWidth}px)`)
    }
    return { send, evaluate, waitFor, emulate, navigate, close, missing }
  } catch (error) {
    await close()
    throw error
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some((arg) => !arg.startsWith('--paths=')) || args.length > 1) throw new Error('usage: layout-audit.mjs [--paths=/path,/another-path]')
  const selected = args.length ? [...new Set(args[0].slice('--paths='.length).split(','))] : paths
  if (!selected.length || selected.some((path) => !auditedPaths.has(path))) throw new Error('--paths must contain registered page paths')
  const browser = await openAuditBrowser()
  const failures = []
  try {
    for (const viewport of VIEWPORTS) {
      const firstFailure = failures.length
      await browser.emulate(viewport)
      for (const path of selected) {
        try {
          await browser.navigate(path, { settle: 'layout' })
          const findings = await browser.evaluate(PROBE)
          if (!Array.isArray(findings)) throw new Error('probe did not return findings')
          for (const finding of findings) failures.push(`[${finding.kind}] ${viewport.name} ${path}: ${finding.detail}`)
        } catch (error) { failures.push(`[probe] ${viewport.name} ${path}: ${error.message}`) }
      }
      console.log(`layout audit: ${viewport.name} ${viewport.width}px, ${selected.length} pages`)
      for (const failure of failures.slice(firstFailure)) console.error(`  ${failure}`)
    }
  } finally { await browser.close() }
  for (const path of browser.missing) {
    const failure = `[not-served] ${path}: the build has no document at this address`
    failures.push(failure)
    console.error(`  ${failure}`)
  }
  if (failures.length) {
    console.error(`layout audit failed: ${failures.length}`)
    process.exitCode = 1
  } else console.log(`layout audit: ${selected.length} pages × ${VIEWPORTS.length} viewports, 0 findings`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`layout audit failed: ${error.message}`); process.exitCode = 1 })
}
