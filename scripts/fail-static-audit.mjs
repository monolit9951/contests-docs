#!/usr/bin/env node --experimental-strip-types
// Real-browser check of the fail-static fallback (docs/.vitepress/theme/failStatic.ts and the
// DocsLayout wiring in theme/index.ts) against the current build. Run after docs:build:
//   node --experimental-strip-types --no-warnings scripts/fail-static-audit.mjs [--all]
//
// When the first load of a page cannot import the page's chunk (lean, then full after
// /hashmap.json), VitePress 1.6 mounts its 404 view over the served article and writes "404" into
// <title>: a soft 404 for any crawler whose renderer lost one request. The theme keeps the served
// page instead. That depends on VitePress client internals (failStatic.test.ts pins their source)
// and on how Vue hydrates a static vnode, which only a browser shows. So this blocks the chunks
// with CDP and checks what a renderer would record, plus everything around it: a real 404 stays
// a 404, a lean-only or framework failure behaves as before, and client navigation after a kept
// load still works. `--all` runs the blocked-chunk check on every registered page instead of one
// page per locale and a hub.
//
// Like audit:layout it needs a Chromium (set CHROME) and is a local check: CI has no browser.
// Analytics beacons never leave the browser: they are answered in the page and recorded there.
import { openAuditBrowser, PAGES, localesOf, pagePath } from './layout-audit.mjs'

const args = process.argv.slice(2)
if (args.some((arg) => arg !== '--all')) throw new Error('usage: fail-static-audit.mjs [--all]')
const ALL = args.includes('--all')

const PAGE_CHUNKS = ['*.md.*.js']
const LEAN_CHUNKS = ['*.md.*.lean.js']
const FRAMEWORK = ['*/chunks/framework.*.js']
const KEPT_STATIC = 'docs_page_kept_static'

const registered = PAGES.flatMap((page) => localesOf(page).map((locale) => ({ page, locale, path: pagePath(page, locale) })))
const registeredPaths = new Set(registered.map(({ path }) => path))
const article = (locale) => registered.find((entry) => entry.locale === locale && entry.page.slugs[locale] !== '')?.path
const hub = (locale) => registered.find((entry) => entry.locale === locale && entry.page.slugs[locale] === '')?.path
// The two addresses Search Console reported as soft 404 on 2026-09-23, then one article per
// remaining locale (Arabic keeps dir=rtl) and a hub index.
const ARTICLE = '/zarabotok/zarabotok-na-vk-klipah'
const UA_ARTICLE = '/ua/brendam/narizky-dlia-prosuvannia-ihor'
for (const path of [ARTICLE, UA_ARTICLE]) {
  if (!registeredPaths.has(path)) throw new Error(`fixture is not a registered page any more: ${path}`)
}
const blockedPaths = ALL
  ? [...registeredPaths]
  : [...new Set([ARTICLE, UA_ARTICLE, article('en'), article('ar'), hub('ru')].filter(Boolean))]

// Before any page script, on every document: let analytics run (it drops a webdriver browser),
// record its events and each document load in localStorage (a reload must not lose them), and
// watch what happens to the served #app and the title.
const INIT = `(() => {
  Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true })
  if (location.protocol !== 'http:') return
  let storage = null
  try { storage = window.localStorage } catch { return }
  const read = (key, fallback) => { try { return JSON.parse(storage.getItem(key)) ?? fallback } catch { return fallback } }
  const write = (key, value) => { try { storage.setItem(key, JSON.stringify(value)) } catch {} }
  const loads = read('__fsAuditLoads', {})
  loads[location.pathname] = (loads[location.pathname] ?? 0) + 1
  write('__fsAuditLoads', loads)
  const record = (body) => {
    const events = read('__fsAuditEvents', [])
    for (const event of [].concat(JSON.parse(body))) {
      if (event) events.push({ eventId: event.eventId, page: event.page, pageViewId: event.pageViewId, meta: event.meta ?? null })
    }
    write('__fsAuditEvents', events)
  }
  const fetchOriginal = window.fetch
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input && input.url ? input.url : ''
    if (url.includes('/api/analytics/events')) {
      try { record(init && init.body ? init.body : 'null') } catch {}
      return Promise.resolve(new Response(null, { status: 202 }))
    }
    return fetchOriginal.apply(this, arguments)
  }
  // The pagehide beacon leaves its events in the outbox, and the next document sends them by fetch.
  navigator.sendBeacon = () => true
  const audit = window.__fsAudit = { h1: null, removed: 0, titles: [] }
  new MutationObserver((mutations) => {
    if (!audit.h1) audit.h1 = document.querySelector('#app h1')
    for (const mutation of mutations) {
      const target = mutation.target
      if (mutation.type !== 'childList' || !(target instanceof Element)) continue
      if (target.id !== 'app' && !target.closest('#app')) continue
      for (const node of mutation.removedNodes) if (node.nodeType === 1) audit.removed++
    }
    if (audit.titles[audit.titles.length - 1] !== document.title) audit.titles.push(document.title)
  }).observe(document, { childList: true, subtree: true, characterData: true })
})()`

const HEAD_FIELDS = `
  const text = (element) => element ? element.textContent.replace(/\\s+/g, ' ').trim() : null
  const all = (selector, attribute) => [...doc.querySelectorAll(selector)].map((element) => element.getAttribute(attribute))
  const head = {
    title: doc.title,
    description: doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
    h1: text(doc.querySelector('#app h1')),
    lang: doc.documentElement.getAttribute('lang'),
    dir: doc.documentElement.getAttribute('dir'),
    canonicals: all('link[rel="canonical"]', 'href'),
    jsonld: doc.querySelectorAll('script[type="application/ld+json"]').length,
    ogTitles: all('meta[property="og:title"]', 'content'),
    siteNames: all('meta[property="og:site_name"]', 'content'),
    hreflang: all('link[rel="alternate"][hreflang]', 'hreflang').sort(),
  }`
// What the server sent for a path, read with the browser's own parser.
const served = (path) => `fetch(${JSON.stringify(path)}).then(async (response) => {
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html')
  ${HEAD_FIELDS}
  return { status: response.status, ...head }
})`
// What the live document shows now.
const SNAPSHOT = `(() => {
  const doc = document
  ${HEAD_FIELDS}
  const app = document.getElementById('app')
  return {
    ...head,
    path: location.pathname,
    mounted: !!(app && app.__vue_app__),
    notFoundView: document.querySelectorAll('.lp-notfound').length,
    sameH1: !!window.__fsAudit?.h1 && app?.querySelector('h1') === window.__fsAudit.h1,
    removed: window.__fsAudit ? window.__fsAudit.removed : -1,
    titles: window.__fsAudit ? window.__fsAudit.titles : [],
    marker: window.__fsAuditMarker ?? null,
  }
})()`
const RECORDED = `({ events: JSON.parse(localStorage.getItem('__fsAuditEvents') || '[]'), loads: JSON.parse(localStorage.getItem('__fsAuditLoads') || '{}') })`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const show = (value) => JSON.stringify(value)?.slice(0, 300)

const browser = await openAuditBrowser({ notFoundPage: true })
const { send, evaluate, emulate, origin } = browser
const failures = []
let scenarios = 0
let assertions = 0

const expectThat = (ok, message) => {
  assertions++
  if (!ok) throw new Error(message)
}
const expectSame = (actual, expected, what) => expectThat(same(actual, expected), `${what}: ${show(actual)}, expected ${show(expected)}`)
const test = async (name, run) => {
  scenarios++
  try { await run(); console.log(`fail-static audit: ${name}`) }
  catch (error) {
    const failure = `${name}: ${error.message}`
    failures.push(failure)
    console.error(`fail-static audit FAILED: ${failure}`)
  }
}
// Evaluations race navigations and reloads; a destroyed context is retried, not a failure.
const until = async (expression, what, timeout = 10000) => {
  const deadline = Date.now() + timeout
  let lastError = null
  while (Date.now() < deadline) {
    try { if (await evaluate(expression)) return } catch (error) { lastError = error }
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${what}${lastError ? ` (${lastError.message})` : ''}`)
}
const block = (urls) => send('Network.setBlockedURLs', { urls })
// A page of the site is marked before it is left, so the wait below cannot pass on the old document.
const load = async (path) => {
  const blank = path === 'about:blank'
  const marked = await evaluate('location.protocol === "http:" && (window.__fsAuditLeaving = true)').catch(() => false)
  const navigation = await send('Page.navigate', { url: blank ? path : `${origin}${path}` })
  if (navigation.errorText) throw new Error(`navigation to ${path} failed: ${navigation.errorText}`)
  await until([
    marked ? '!window.__fsAuditLeaving' : 'true',
    blank ? 'location.href === "about:blank"' : 'location.protocol === "http:"',
    'document.readyState === "complete"',
  ].join(' && '), `${path} to load`)
}
// Every scenario starts from an empty origin: no recorded events, no analytics outbox.
const fresh = async (blocked = []) => {
  await block([])
  await load('about:blank')
  await send('Storage.clearDataForOrigin', { origin, storageTypes: 'local_storage' })
  await block(blocked)
}
const mounted = async (path) => {
  await until('!!document.getElementById("app")?.__vue_app__', `the app to mount on ${path}`)
  await sleep(700)
}
const snapshot = () => evaluate(SNAPSHOT)
const recorded = () => evaluate(RECORDED)
const ofView = (events, pageViewId) => events.filter((event) => event.pageViewId === pageViewId)
const firstView = (events) => events.find((event) => event.eventId === 'docs_page_view')

const expectServed = (live, raw, path) => {
  expectThat(raw.status === 200, `${path} is not served (${raw.status})`)
  expectThat(raw.h1 !== null, `${path}: the served page has no h1 to compare`)
  for (const field of ['title', 'description', 'h1', 'lang', 'dir', 'canonicals', 'jsonld', 'ogTitles', 'siteNames', 'hreflang']) {
    expectSame(live[field], raw[field], `${path} ${field}`)
  }
  expectThat(live.canonicals.length === 1, `${path}: ${live.canonicals.length} canonicals`)
  expectThat(live.notFoundView === 0, `${path}: the 404 view is in the DOM`)
  expectThat(!live.titles.includes('404'), `${path}: the title read "404" at some point: ${show(live.titles)}`)
}
const expectKeptSignal = (events, path) => {
  const view = firstView(events)
  expectThat(!!view, `${path}: no docs_page_view`)
  const own = ofView(events, view.pageViewId)
  const notFound = own.filter((event) => event.eventId === 'docs_not_found')
  expectThat(notFound.length === 1, `${path}: ${notFound.length} docs_not_found for the kept view`)
  expectThat(Object.keys(notFound[0].meta ?? {}).every((key) => key === 'referrerHost'), `${path}: docs_not_found carries ${show(notFound[0].meta)}`)
  expectThat(own.some((event) => event.eventId === 'client_error' && event.meta?.message === KEPT_STATIC),
    `${path}: no client_error ${KEPT_STATIC} for the kept view`)
}
const expectNoNotFound = (events, path) => {
  const wrong = events.filter((event) => event.eventId === 'docs_not_found' || event.eventId === 'client_error')
  expectThat(wrong.length === 0, `${path}: unexpected ${show(wrong)}`)
}

try {
  await send('Network.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: INIT })
  await emulate({ width: 1280, height: 900, mobile: false })

  for (const path of blockedPaths) {
    await test(`page chunks blocked, the served page stays: ${path}`, async () => {
      await fresh(PAGE_CHUNKS)
      await load(path)
      await mounted(path)
      const live = await snapshot()
      const raw = await evaluate(served(path))
      expectServed(live, raw, path)
      // The static vnode adopted the served markup: the same nodes, none removed.
      expectThat(live.sameH1, `${path}: the h1 is not the served element`)
      expectThat(live.removed === 0, `${path}: ${live.removed} served elements were removed from #app`)
      expectKeptSignal((await recorded()).events, path)
    })
  }

  await test('framework chunk blocked: nothing mounts and the served page is untouched', async () => {
    await fresh(FRAMEWORK)
    await load(ARTICLE)
    await sleep(1500)
    const live = await snapshot()
    expectThat(!live.mounted, 'the app mounted without its framework chunk')
    expectServed(live, await evaluate(served(ARTICLE)), ARTICLE)
    expectThat(live.sameH1 && live.removed === 0, `the served DOM changed (removed=${live.removed})`)
  })

  await test("lean chunk blocked only: VitePress's own retry loads the full chunk", async () => {
    await fresh(LEAN_CHUNKS)
    await load(ARTICLE)
    await mounted(ARTICLE)
    const live = await snapshot()
    expectServed(live, await evaluate(served(ARTICLE)), ARTICLE)
    expectNoNotFound((await recorded()).events, ARTICLE)
  })

  await test('nothing blocked: a normal load hydrates the served page', async () => {
    await fresh()
    await load(ARTICLE)
    await mounted(ARTICLE)
    const live = await snapshot()
    expectServed(live, await evaluate(served(ARTICLE)), ARTICLE)
    expectThat(live.sameH1, 'hydration replaced the served h1')
    const { events } = await recorded()
    expectThat(events.some((event) => event.eventId === 'docs_page_view'), 'no docs_page_view')
    expectNoNotFound(events, ARTICLE)
  })

  await test('after a kept load: client navigation works, and going back reloads the kept page', async () => {
    await fresh(PAGE_CHUNKS)
    await load(ARTICLE)
    await mounted(ARTICLE)
    const kept = await evaluate(served(ARTICLE))
    expectServed(await snapshot(), kept, ARTICLE)
    // The chunks come back (a transient failure, or a retained old release).
    await block([])
    const target = await evaluate(`(() => {
      const registered = new Set(${JSON.stringify([...registeredPaths])})
      const link = [...document.querySelectorAll('#app main a[href]:not([target])')].find((candidate) => {
        const url = new URL(candidate.getAttribute('href'), location.href)
        return url.origin === location.origin && !url.hash && url.pathname !== location.pathname && registered.has(url.pathname)
      })
      if (!link) return null
      link.setAttribute('data-fs-audit-link', '')
      window.__fsAuditMarker = 'same-document'
      return new URL(link.getAttribute('href'), location.href).pathname
    })()`)
    expectThat(!!target, 'the kept page has no internal link to follow')
    const next = await evaluate(served(target))
    await evaluate('document.querySelector("[data-fs-audit-link]").click()')
    await until(`location.pathname === ${JSON.stringify(target)} && document.title === ${JSON.stringify(next.title)}`, `the client route to ${target}`)
    await sleep(700)
    const moved = await snapshot()
    expectThat(moved.marker === 'same-document', `following a link reloaded the document (${target})`)
    // The served page's canonical, hreflang, JSON-LD and cards went; the site's og:site_name stayed.
    expectServed(moved, next, target)

    await evaluate('history.back()')
    await until(`!window.__fsAuditMarker && location.pathname === ${JSON.stringify(ARTICLE)} && !!document.getElementById("app")?.__vue_app__`,
      'the kept page to load again')
    await sleep(700)
    const back = await snapshot()
    expectServed(back, kept, ARTICLE)
    // Two views of the kept address: the kept load and the reload. The old document, already on
    // its way out, must not report one of its own: it would carry the exact docs_not_found and
    // client_error pair of a kept first load, the series the post-deploy query counts.
    const { events } = await recorded()
    const keptView = firstView(events)
    const views = new Set(events
      .filter((event) => event.eventId === 'docs_page_view' && event.page === keptView.page)
      .map((event) => event.pageViewId))
    expectThat(views.size === 2, `${ARTICLE}: ${views.size} page views, expected the kept load and the reload: ${show([...views])}`)
    const signals = events.filter((event) => event.eventId === 'docs_not_found'
      || (event.eventId === 'client_error' && event.meta?.message === KEPT_STATIC))
    expectThat(signals.every((event) => event.pageViewId === keptView.pageViewId),
      `a not-found or kept signal outside the kept load: ${show(signals)}`)
  })

  // nginx merges repeated slashes and serves the article, canonical included, for both spellings.
  // VitePress alone routes neither (a leading // reads as a host): routing.ts mergeSlashes.
  for (const path of [`/${ARTICLE}`, ARTICLE.replace(/^(\/[^/]+\/)/, '$1/')]) {
    await test(`repeated slashes hydrate the article they are served: ${path}`, async () => {
      await fresh()
      await load(path)
      await mounted(path)
      const live = await snapshot()
      expectThat(live.path === ARTICLE, `${path}: the address is still ${live.path}`)
      expectServed(live, await evaluate(served(ARTICLE)), path)
      expectThat(live.sameH1, `${path}: hydration replaced the served h1`)
      expectNoNotFound((await recorded()).events, path)
    })
  }

  for (const path of ['/definitely-missing-page', '/zarabotok/definitely-missing-page']) {
    await test(`a real 404 stays a 404, in one document load: ${path}`, async () => {
      await fresh()
      await load(path)
      // A reload loop would show up as more loads of the address within these seconds.
      await sleep(3000)
      await mounted(path)
      expectThat((await evaluate(served(path))).status === 404, `${path} is not a 404`)
      const live = await snapshot()
      expectThat(live.title === '404', `${path}: title ${show(live.title)}`)
      expectThat(live.notFoundView === 1, `${path}: ${live.notFoundView} 404 views`)
      const { events, loads } = await recorded()
      expectThat(loads[path] === 1, `${path}: loaded ${loads[path]} times`)
      expectThat(events.some((event) => event.eventId === 'docs_not_found'), `${path}: no docs_not_found`)
      expectThat(!events.some((event) => event.eventId === 'client_error' && event.meta?.message === KEPT_STATIC),
        `${path}: a real 404 was reported as kept`)
    })
  }
} finally { await browser.close() }

if (failures.length) {
  console.error(`fail-static audit failed: ${failures.length}/${scenarios} scenarios`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exitCode = 1
} else console.log(`fail-static audit: ${scenarios} scenarios, ${assertions} assertions, 0 failures`)
