#!/usr/bin/env node --experimental-strip-types
// Bounded, real-browser behavior checks against the current built site. Run after docs:build:
// node --experimental-strip-types --no-warnings scripts/ui-interaction-audit.mjs
// The exhaustive layout audit remains separate; this exercises all four locales at 320px,
// the first desktop breakpoint (1120px), the tablet outline at 768px, and a narrow desktop
// viewport with a classic scrollbar (whose available content width is smaller than 320px).
import { openAuditBrowser, PAGES, pagePath } from './layout-audit.mjs'

const browser = await openAuditBrowser()
const { evaluate, waitFor, send, navigate, emulate } = browser
const failures = []
let scenarios = 0
let assertions = 0
const quote = JSON.stringify
const route = (id, locale) => {
  const page = PAGES.find((entry) => entry.id === id)
  if (!page || !Object.hasOwn(page.slugs, locale)) throw new Error(`missing fixture: ${id}/${locale}`)
  return pagePath(page, locale)
}
const check = async (expression, message) => {
  assertions++
  if (!await evaluate(expression)) throw new Error(message)
}
const test = async (name, run) => {
  scenarios++
  try { await run(); console.log(`UI interaction audit: ${name}`) }
  catch (error) {
    const failure = `${name}: ${error.message}`
    failures.push(failure)
    console.error(`UI interaction audit FAILED: ${failure}`)
  }
}
const press = async (key) => {
  const code = { Enter: 13, Escape: 27, Tab: 9, ArrowRight: 39 }[key]
  const event = { key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code }
  // Chromium needs Enter's character payload to perform native summary/button activation.
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...event, ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...event })
}
const click = (selector) => evaluate(`document.querySelector(${quote(selector)}).click()`)
const openDetails = async (selector) => {
  await check(`!document.querySelector(${quote(selector)}).open`, `${selector} should start closed`)
  await evaluate(`document.querySelector(${quote(selector + ' > summary')}).focus()`)
  await press('Enter')
  await waitFor(`document.querySelector(${quote(selector)}).open`)
}
const escapeDetails = async (selector) => {
  await press('Escape')
  await check(`!document.querySelector(${quote(selector)}).open && document.activeElement === document.querySelector(${quote(selector + ' > summary')})`, `${selector}: Escape must close and restore summary focus`)
}
const follow = async (selector) => {
  const destination = await evaluate(`document.querySelector(${quote(selector)}).pathname`)
  await evaluate('window.__uiAuditRoute = true')
  await click(selector)
  await waitFor(`location.pathname === ${quote(destination)}`)
  await check('window.__uiAuditRoute === true', 'internal link should perform a client route transition')
  return destination
}
const search = async (text) => {
  await evaluate('document.querySelector(".hub-search input").focus(); document.querySelector(".hub-search input").select()')
  await send('Input.insertText', { text })
}
const count = 'document.querySelectorAll(".hub-results .hub-card").length'
const inViewport = `(selector) => {
  const box = document.querySelector(selector)?.getBoundingClientRect()
  return !!box && box.width > 0 && box.left >= -1 && box.right <= document.documentElement.clientWidth + 1
}`
const headingVisible = async (fragment) => {
  const geometry = `(() => { const heading = document.getElementById(decodeURIComponent(${quote(fragment)}.slice(1))); return { headingTop: heading.getBoundingClientRect().top, headerBottom: document.querySelector('.lp-header').getBoundingClientRect().bottom, viewportHeight: innerHeight, scrollY } })()`
  try { await waitFor(`(() => { const box = ${geometry}; return box.headingTop >= box.headerBottom - 2 && box.headingTop < box.viewportHeight })()`) }
  catch { throw new Error(`anchor target hidden after navigation: ${JSON.stringify(await evaluate(geometry))}`) }
}

try {
  // Keep the classic-scrollbar fixture independent of earlier mobile/script-disabled
  // emulation. Mobile mode explicitly uses overlay scrollbars.
  await test('uk: narrow desktop with a classic scrollbar at 320px', async () => {
    await emulate({ width: 320, height: 812, mobile: false })
    await navigate(route('earnings-hub', 'uk'))
    await check('document.documentElement.clientWidth < innerWidth', 'fixture must reserve content width for a classic scrollbar')
    await check('document.documentElement.scrollWidth <= document.documentElement.clientWidth', 'narrow desktop page overflows its available content width')
    await check('getComputedStyle(document.body).minWidth === "0px"', 'docs body must clear the inherited 320px minimum width')
    await check(`(() => {
      const elements = [document.querySelector('.lp-header'), document.querySelector('.lp-mobile-menu > summary'), ...document.querySelectorAll('.hub-card')]
      return elements.length > 2 && elements.every((element) => {
        if (!element) return false
        const box = element.getBoundingClientRect()
        return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility === 'visible' && box.left >= -1 && box.right <= document.documentElement.clientWidth + 1
      })
    })()`, 'header, menu trigger and catalog cards must remain visible within the available width')
    await openDetails('.lp-mobile-menu')
    await check(`(${inViewport})(".lp-mobile-panel")`, 'open menu must fit beside the classic scrollbar')
    await escapeDetails('.lp-mobile-menu')
  })
  for (const locale of ['ru', 'uk', 'en', 'ar']) {
    const home = route('earnings-hub', locale)
    const article = route('best-clipping-platforms', locale)
    await emulate({ width: 320, height: 740, mobile: true })

    await test(`${locale}: mobile menu, keyboard, languages and route closure at 320px`, async () => {
      await navigate(home)
      await check(`document.documentElement.dir === ${quote(locale === 'ar' ? 'rtl' : 'ltr')}`, 'wrong writing direction')
      await check(`[document.documentElement, document.body].every((element) => getComputedStyle(element).transform === 'none')`, 'page containers must not transform or mirror text glyphs')
      await check(`(${inViewport})(".lp-mobile-menu > summary")`, 'mobile menu trigger is outside viewport')
      await openDetails('.lp-mobile-menu')
      await check(`(${inViewport})(".lp-mobile-panel")`, 'open mobile panel is outside viewport')
      await check('document.querySelectorAll(".lp-mobile-languages a").length === 3', 'hub must expose its three other available languages')
      await press('Tab')
      await check('document.activeElement.matches(".lp-mobile-nav a")', 'Tab should enter open mobile navigation')
      await escapeDetails('.lp-mobile-menu')
      await openDetails('.lp-mobile-menu')
      await follow('.lp-mobile-languages a')
      await waitFor('!document.querySelector(".lp-mobile-menu").open')
      await check('!document.querySelector(".lp-mobile-menu").open', 'language transition must close mobile menu')
    })

    await test(`${locale}: catalog search, empty state, category, reset and route reset`, async () => {
      await navigate(home)
      await waitFor('!!document.querySelector(".hub-search input:not([disabled])")')
      const total = await evaluate(count)
      await check(`${count} > 1`, 'catalog fixture needs several articles')
      const title = await evaluate('document.querySelector(".hub-card h4").textContent')
      await search(title)
      await waitFor(`${count} > 0 && ${count} < ${total}`)
      await check(`Number(document.querySelector(".hub-results-bar [role=status] strong").textContent) === ${count}`, 'live result count disagrees with rendered results')
      await search('ui-audit-no-matches-284f9e')
      await waitFor('!!document.querySelector(".hub-empty")')
      await check(`${count} === 0 && document.querySelector(".hub-results-bar strong").textContent === '0'`, 'empty search should report zero results')
      await click('.hub-empty button')
      await waitFor(`${count} === ${total}`)
      await click('.hub-filters button:nth-child(2)')
      await waitFor('document.querySelector(".hub-filters button:nth-child(2)").getAttribute("aria-pressed") === "true"')
      await check('document.querySelectorAll(".hub-filters [aria-pressed=true]").length === 1 && document.querySelectorAll(".hub-results .hub-topic").length === 1', 'category filter should select one category and render only its group')
      await check(`Number(document.querySelector(".hub-filters button:nth-child(2) span").textContent) === ${count}`, 'category count disagrees with rendered results')
      await click('.hub-results-bar button')
      await waitFor(`${count} === ${total}`)
      await check('document.querySelector(".hub-search input").value === "" && document.querySelector(".hub-filters button").getAttribute("aria-pressed") === "true"', 'reset must clear both search and category')
      // Leave a filtered hub and return through its header link. A persistent component
      // must reset its query/category when VitePress changes the page beneath it.
      await search(title)
      await waitFor(`${count} > 0 && ${count} < ${total}`)
      await follow('.hub-results .hub-card')
      await waitFor('!!document.querySelector(".lp-reader")')
      await openDetails('.lp-mobile-menu')
      await follow(`.lp-mobile-nav a[href=${quote(home)}]`)
      await waitFor(`!!document.querySelector(".hub-search input:not([disabled])") && ${count} === ${total}`)
      await check('document.querySelector(".hub-search input").value === ""', 'returning to hub should clear its filter')
    })

    await test(`${locale}: mobile outline anchors, focus and comparison sorting`, async () => {
      await navigate(article)
      await openDetails('.lp-outline-mobile')
      await check(`Array.from(document.querySelectorAll('.lp-outline-mobile .lp-outline-link')).every((link) => !!document.getElementById(decodeURIComponent(link.hash.slice(1))))`, 'outline contains a missing or incorrectly escaped anchor')
      await press('Tab')
      await escapeDetails('.lp-outline-mobile')
      await openDetails('.lp-outline-mobile')
      const fragment = await evaluate('document.querySelector(".lp-outline-mobile .lp-outline-link").hash')
      await evaluate('window.__uiAuditAnchor = true')
      await click('.lp-outline-mobile .lp-outline-link')
      await waitFor(`decodeURIComponent(location.hash) === decodeURIComponent(${quote(fragment)})`)
      await check('window.__uiAuditAnchor === true', 'outline fragment navigation should preserve the current document')
      await check(`document.activeElement.id === decodeURIComponent(${quote(fragment)}.slice(1)) && !document.querySelector('.lp-outline-mobile').open`, 'outline click should focus its heading and close the disclosure')
      await headingVisible(fragment)
      await check(`(() => { const region = document.querySelector('.lp-table-scroll'); return region.getAttribute('role') === 'region' && region.tabIndex === 0 && !!region.getAttribute('aria-label')?.trim() })()`, 'comparison must have a named, keyboard-focusable scroll region')
      await check('Array.from(document.querySelectorAll(".lp-table th[aria-sort]")).every((cell) => cell.getAttribute("aria-sort") === "none")', 'comparison should begin in editorial order without an active sort')
      await evaluate('document.querySelector(".lp-table th button").focus()')
      await press('Enter')
      await waitFor('document.querySelector(".lp-table th[aria-sort=ascending]") !== null')
      await press('Enter')
      await waitFor('document.querySelector(".lp-table th[aria-sort=descending]") !== null')
      await check('document.querySelectorAll(".lp-table th[aria-sort]:not([aria-sort=none])").length === 1', 'exactly one comparison column should be sorted')
    })

    await test(`${locale}: desktop boundary navigation and language disclosure at 1120px`, async () => {
      await emulate({ width: 1120, height: 900, mobile: false })
      await navigate(article)
      await check(`[document.documentElement, document.body].every((element) => getComputedStyle(element).transform === 'none')`, 'desktop page containers must not transform or mirror text glyphs')
      await check(`(${inViewport})(".lp-nav") && (${inViewport})(".lp-header-cta") && (${inViewport})(".lp-outline-desktop")`, 'desktop navigation or outline is not visible within viewport')
      await check('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1', 'desktop boundary has horizontal overflow')
      await openDetails('.lp-language-menu')
      await check(`(${inViewport})(".lp-language-options")`, 'desktop language dropdown is outside viewport')
      await press('Tab')
      await check('document.activeElement.matches(".lp-language-options a")', 'Tab should enter language options')
      await escapeDetails('.lp-language-menu')
      await openDetails('.lp-language-menu')
      await click('#main-content')
      await check('!document.querySelector(".lp-language-menu").open', 'outside click should close language dropdown')
      await openDetails('.lp-language-menu')
      await follow('.lp-language-options a')
      await waitFor('!document.querySelector(".lp-language-menu").open')
    })
  }
  await test('en: portrait tablet outline at 768px', async () => {
    await emulate({ width: 768, height: 1024, mobile: false })
    await navigate(route('best-clipping-platforms', 'en'))
    await check(`(${inViewport})(".lp-outline-mobile > summary")`, 'tablet outline disclosure should be visible')
    await openDetails('.lp-outline-mobile')
    await escapeDetails('.lp-outline-mobile')
  })
  await test('en: desktop outline follows forward/backward scroll jumps and resize', async () => {
    await emulate({ width: 1280, height: 900, mobile: false })
    await navigate(route('best-clipping-platforms', 'en'))
    const links = await evaluate('Array.from(document.querySelectorAll(".lp-outline-desktop .lp-outline-link"), (link) => link.getAttribute("href"))')
    await check('document.querySelectorAll(".lp-outline-desktop .lp-outline-link").length >= 4', 'scroll fixture needs several sections')
    for (const fragment of [links[2], links[links.length - 2], links[1]]) {
      await evaluate(`(() => { const target = document.getElementById(decodeURIComponent(${quote(fragment)}.slice(1))); window.scrollTo({ top: target.getBoundingClientRect().top + scrollY - 100, behavior: 'instant' }) })()`)
      await waitFor(`document.querySelector('.lp-outline-desktop [aria-current="location"]')?.getAttribute('href') === ${quote(fragment)}`)
      await check(`document.querySelectorAll('.lp-outline-desktop [aria-current="location"]').length === 1`, 'scroll tracking should identify exactly one section')
    }
    await emulate({ width: 1440, height: 900, mobile: false })
    await waitFor(`(() => { const links = Array.from(document.querySelectorAll('.lp-outline-desktop .lp-outline-link')); const reached = links.filter((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))).getBoundingClientRect().top <= 130); return (reached.at(-1) ?? links[0]).getAttribute('aria-current') === 'location' })()`)
  })
  await test('ru: no-JavaScript catalog, native menu and article outline', async () => {
    await send('Emulation.setScriptExecutionDisabled', { value: true })
    try {
      await emulate({ width: 320, height: 740, mobile: true })
      await navigate(route('earnings-hub', 'ru'))
      const expected = PAGES.filter((page) => page.hub === 'earnings' && page.slugs.ru).map((page) => pagePath(page, 'ru'))
      await check(`(() => { const links = new Set(Array.from(document.querySelectorAll('.hub-results .hub-card'), (link) => link.getAttribute('href'))); return ${quote(expected)}.every((path) => links.has(path)) })()`, 'SSR hub must retain every manifest article link without JavaScript')
      await check('document.querySelector(".hub-search input").disabled', 'unavailable search should remain disabled before hydration')
      await openDetails('.lp-mobile-menu')
      await check(`(${inViewport})(".lp-mobile-panel") && document.querySelectorAll('.lp-mobile-nav a').length > 0 && document.querySelectorAll('.lp-mobile-languages a').length === 3`, 'native menu must expose navigation and languages without JavaScript')
      await press('Enter')
      await check('!document.querySelector(".lp-mobile-menu").open', 'native summary must close its menu with Enter without JavaScript')
      await navigate(route('best-clipping-platforms', 'ru'))
      await openDetails('.lp-outline-mobile')
      await check(`Array.from(document.querySelectorAll('.lp-outline-mobile .lp-outline-link')).length > 0 && Array.from(document.querySelectorAll('.lp-outline-mobile .lp-outline-link')).every((link) => !!document.getElementById(decodeURIComponent(link.hash.slice(1))))`, 'SSR outline must retain its real article anchors')
      const fragment = await evaluate('document.querySelector(".lp-outline-mobile .lp-outline-link").hash')
      await evaluate('window.__uiAuditAnchor = true')
      await click('.lp-outline-mobile .lp-outline-link')
      await waitFor(`decodeURIComponent(location.hash) === decodeURIComponent(${quote(fragment)})`)
      await check('window.__uiAuditAnchor === true', 'native no-JavaScript outline link should preserve its document')
      await headingVisible(fragment)
      await check('document.querySelectorAll(".lp-table tbody tr").length > 1', 'comparison content must be server-rendered without JavaScript')
    } finally { await send('Emulation.setScriptExecutionDisabled', { value: false }) }
  })
} finally { await browser.close() }

if (failures.length) {
  console.error(`UI interaction audit failed: ${failures.length}/${scenarios} scenarios`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exitCode = 1
} else console.log(`UI interaction audit: ${scenarios} scenarios, ${assertions} assertions, 0 failures`)
