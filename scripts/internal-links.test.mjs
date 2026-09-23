import { describe, expect, it } from 'vitest'
import {
  MIN_INBOUND,
  anchorsOf,
  editorialAnchors,
  inboundFloor,
  inboundSources,
  inboundVerdict,
  internalNofollowAnchors,
  isInternalHref,
  sitePathOf,
} from './internal-links.mjs'
import { sourceAnchor } from '../docs/.vitepress/links.ts'
import { KNOWN_LOCALES } from '../docs/.vitepress/registry.ts'
import { DATA } from '../docs/.vitepress/theme/landing/platforms.ts'

// A trimmed article in the landing shell: header menus, hero, outline, body, sources, related
// cards, CTA, footer — the regions the link gates have to tell apart.
const article = ({ body = '', related = [] } = {}) => `<!DOCTYPE html><html><body>
<header class="lp-header"><a class="lp-skip" href="#main-content">skip</a><a class="lp-logo" href="/zarabotok/">DareBay</a>
<nav class="lp-nav"><a href="/brendam/">Brands</a></nav>
<nav class="lp-language-options"><a href="/en/for-brands/clipping-vs-paid-ads">EN</a></nav>
<a href="https://darebay.com/" class="lp-header-cta" target="_self">App</a></header>
<main id="main-content"><section class="lp-hero"><a href="/brendam/" class="lp-breadcrumb">Brands</a>
<a href="/o-proekte/kto-pishet-i-otkuda-tsifry" class="lp-updated lp-byline" rel="author">Author</a>
<a href="https://darebay.com/for-business" class="lp-hero-action" target="_self">Launch</a></section>
<aside class="lp-outline"><a href="#one" class="lp-outline-link" target="_self">One</a></aside>
<div class="lp-content"><h2 id="one"><a class="header-anchor" href="#one">#</a>One</h2>${body}</div>
<section id="related"><a class="lp-more-link" href="/brendam/">All</a>${related.map((href) => `<a class="lp-card lp-card--link" href="${href}">x</a>`).join('')}</section>
</main>
<section class="lp-cta"><a class="lp-btn lp-btn-primary" href="https://darebay.com/for-business" target="_self">Go</a></section>
<footer><a href="https://darebay.com/" target="_self">Home</a><nav><a href="/zarabotok/">Earn</a></nav></footer>
<script>window.__VP_SITE_DATA__=JSON.parse("{\\"message\\":\\"<a href=\\\\\\"https://darebay.com/\\\\\\" rel=\\\\\\"nofollow\\\\\\">x</a>\\"}")</script>
</body></html>`

describe('which links stay on darebay.com', () => {
  it('treats every relative reference and darebay.com or www.darebay.com as internal', () => {
    for (const href of ['/x', 'x', '#a', '?q=1', '', 'https://darebay.com/x', 'http://www.darebay.com', 'https://darebay.com./x', '//darebay.com/x', 'HTTPS://DAREBAY.COM/X']) {
      expect(isInternalHref(href), href).toBe(true)
    }
  })

  it('treats other hosts, subdomains, other schemes and a missing href as not internal', () => {
    // A subdomain is another origin (dev.darebay.com is the noindex preview): the helper cites it
    // like any other site, so the gate must not demand a followed link to it.
    for (const href of ['https://dev.darebay.com/en/', 'https://api.darebay.com/x', 'https://darebay.com.evil.example/x', 'https://notdarebay.com/', '//example.com/x', 'mailto:hello@darebay.com', 'tel:+1', 'javascript:void(0)', undefined]) {
      expect(isInternalHref(href), String(href)).toBe(false)
    }
  })
})

describe('the helper and the gate agree on which hosts are ours', () => {
  // `sourceAnchor` (links.ts) decides how a template renders a link; this gate decides which
  // rendered links fail the build. They read one rule (siteHost.ts). These pin the consequence: a
  // URL is internal to the gate exactly when the helper renders it followed, so no source the
  // data can hold makes the helper emit a link the gate rejects.
  const urls = [
    'https://darebay.com/en/help/what-commission',
    'https://www.darebay.com/o-proekte/darebay-v-tsifrakh',
    'HTTPS://DAREBAY.COM/EN',
    'https://darebay.com./tasks',
    '//darebay.com/en/earnings/',
    '/o-proekte/',
    'https://dev.darebay.com/en/',
    'https://api.darebay.com/x',
    'https://darebay.com.evil.example/x',
    'https://notdarebay.com/',
    'https://whop.com/terms',
    'mailto:hello@darebay.com',
  ]

  it('calls a URL internal exactly when the helper renders it as a followed link', () => {
    for (const url of urls) {
      for (const locale of KNOWN_LOCALES) {
        expect(isInternalHref(url), `${url} on ${locale}`).toBe(sourceAnchor(url, locale).rel === undefined)
      }
    }
  })

  it('never flags an anchor the helper renders, for these URLs and every source of the comparison data', () => {
    const sources = [
      ...urls,
      ...DATA.platforms.flatMap((platform) => [
        platform.url,
        ...Object.values(platform.home ?? {}),
        ...Object.values(platform.fields).flatMap((field) => (field.source?.url ? [field.source.url] : [])),
      ]),
    ]
    for (const url of sources) {
      for (const locale of KNOWN_LOCALES) {
        const { href, rel, target } = sourceAnchor(url, locale)
        const tag = `<a href="${href}"${rel ? ` rel="${rel}"` : ''}${target ? ` target="${target}"` : ''}>x</a>`
        expect(internalNofollowAnchors(tag), `${url} on ${locale}`).toEqual([])
      }
    }
  })
})

describe('internal nofollow', () => {
  it('flags the anchors the comparison templates used to render for our own pages', () => {
    const html = `<ul><li><a href="https://darebay.com/en/help/what-commission" target="_blank" rel="nofollow noopener">darebay.com/en/help/what-commission</a></li>
<li><a class="lp-src" href="/o-proekte/darebay-v-tsifrakh" rel="NOFOLLOW">1</a></li>
<li><a href='https://www.darebay.com/en' rel='noopener nofollow'>DareBay</a></li></ul>`
    expect(internalNofollowAnchors(html).map((anchor) => anchor.href)).toEqual([
      'https://darebay.com/en/help/what-commission',
      '/o-proekte/darebay-v-tsifrakh',
      'https://www.darebay.com/en',
    ])
  })

  it('accepts an unfollowed citation of another site and a followed link to our own', () => {
    const html = `<a href="https://whop.com/terms" target="_blank" rel="nofollow noopener">whop.com</a>
<a href="/en/about/darebay-at-a-glance">darebay.com/en/about/darebay-at-a-glance</a>
<a href="https://darebay.com/en" target="_self">DareBay</a>
<a href="https://t.me/darebay_app" target="_blank" rel="noreferrer">Telegram</a>`
    expect(internalNofollowAnchors(html)).toEqual([])
  })

  it('does not read links out of scripts or comments', () => {
    expect(internalNofollowAnchors(article())).toEqual([])
    expect(internalNofollowAnchors('<!-- <a href="/x" rel="nofollow">x</a> -->')).toEqual([])
  })
})

describe('anchorsOf', () => {
  it('reads attributes in any quoting and decodes entities', () => {
    const [anchor] = anchorsOf(`<a class=lp-src href='/x?a=1&amp;b=2' rel="nofollow  noopener">`)
    expect(anchor).toMatchObject({ href: '/x?a=1&b=2', rel: ['nofollow', 'noopener'], classes: ['lp-src'] })
  })
})

describe('editorial links', () => {
  it('keeps body links, sources and related cards, and drops every piece of page chrome', () => {
    const html = article({
      body: '<p><a href="/brendam/skolko-stoit-klipping-kampaniya">cost</a> <a class="lp-src" href="/en/about/darebay-at-a-glance">1</a></p>',
      related: ['/brendam/narezki-dlya-podkastov'],
    })
    expect(editorialAnchors(html).map((anchor) => anchor.href)).toEqual([
      '/brendam/skolko-stoit-klipping-kampaniya',
      '/en/about/darebay-at-a-glance',
      '/brendam/narezki-dlya-podkastov',
    ])
  })

  it('finds nothing in a document without <main>', () => {
    expect(editorialAnchors('<header><a href="/x">x</a></header>')).toEqual([])
  })
})

describe('sitePathOf', () => {
  it('spells an internal target the way the registry spells page paths', () => {
    expect(sitePathOf('https://darebay.com/en/help/what-commission?x=1#fees')).toBe('/en/help/what-commission')
    expect(sitePathOf('/zarabotok/index.html')).toBe('/zarabotok/')
    expect(sitePathOf('/zarabotok/kak-delat-narezki.html')).toBe('/zarabotok/kak-delat-narezki')
    expect(sitePathOf('kak-delat-narezki', '/zarabotok/other')).toBe('/zarabotok/kak-delat-narezki')
    expect(sitePathOf('/ar/%D8%A7')).toBe('/ar/ا')
    expect(sitePathOf('https://whop.com/x')).toBeNull()
  })
})

describe('inbound links', () => {
  const pages = ['/a/one', '/a/two', '/a/three', '/b/']

  it('counts distinct other content pages, not links, and never the page itself', () => {
    const documents = [
      { path: '/a/one', html: article({ body: '<a href="/a/two">x</a><a href="/a/two#y">again</a><a href="/a/one">self</a>', related: ['/a/two'] }) },
      { path: '/a/two', html: article({ related: ['/a/three', '/b'] }) },
      { path: '/a/three', html: article({ body: '<a href="https://darebay.com/a/two">abs</a>' }) },
    ]
    const inbound = inboundSources(documents, pages)
    expect([...inbound.get('/a/two')].sort()).toEqual(['/a/one', '/a/three'])
    expect([...inbound.get('/a/three')]).toEqual(['/a/two'])
    expect([...inbound.get('/a/one')]).toEqual([])
    // A trailing-slash variant reaches the page it names.
    expect([...inbound.get('/b/')]).toEqual(['/a/two'])
  })

  it('holds a page to what its section can deliver, and no lower', () => {
    expect(MIN_INBOUND).toBe(2)
    expect([1, 2, 3, 12].map((size) => inboundFloor(size))).toEqual([0, 1, 2, 2])
    expect(inboundFloor(0)).toBe(0)
  })

  it('fails a starved page, reports an exempt one, passes the rest', () => {
    const inbound = new Map([
      ['/big/starved', new Set(['/big/x'])],
      ['/big/fine', new Set(['/big/x', '/big/y'])],
      ['/solo/only', new Set()],
      ['/pair/one', new Set(['/pair/two'])],
      ['/pair/two', new Set()],
    ])
    const verdict = inboundVerdict([
      { path: '/big/starved', group: 'big/ru', groupSize: 12 },
      { path: '/big/fine', group: 'big/ru', groupSize: 12 },
      { path: '/solo/only', group: 'solo/ar', groupSize: 1 },
      { path: '/pair/one', group: 'pair/en', groupSize: 2 },
      { path: '/pair/two', group: 'pair/en', groupSize: 2 },
    ], inbound)
    expect(verdict.failures).toEqual([
      { path: '/big/starved', group: 'big/ru', groupSize: 12, count: 1, floor: 2 },
      { path: '/pair/two', group: 'pair/en', groupSize: 2, count: 0, floor: 1 },
    ])
    expect(verdict.exempt).toEqual([
      { path: '/solo/only', group: 'solo/ar', groupSize: 1, count: 0, floor: 0 },
      { path: '/pair/one', group: 'pair/en', groupSize: 2, count: 1, floor: 1 },
    ])
  })
})
