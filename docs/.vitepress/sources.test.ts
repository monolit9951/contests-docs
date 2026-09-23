import { beforeAll, describe, expect, it } from 'vitest'
import { createMarkdownRenderer } from 'vitepress'
import {
  COMPETITOR_SOURCE_HOSTS,
  hostOf,
  installSourcesRule,
  isCompetitorHost,
  localeFromPath,
  sourcesHeading,
} from './sources'

/**
 * Tested through the renderer VitePress actually builds with, not a hand-rolled markdown-it.
 *
 * The whole rule turns on where a citation comment lands in the token stream, and that is a fact
 * about this renderer's configuration: a comment mid-sentence is an `html_inline` child, one on its
 * own line is an `html_block`, and `env.frontmatter` exists at all only because the frontmatter
 * plugin wraps `md.render` (NOT `md.parse` — a test that parsed would never see the flag). A stub
 * renderer would let all three assumptions rot silently.
 */
let md: Awaited<ReturnType<typeof createMarkdownRenderer>>

beforeAll(async () => {
  md = await createMarkdownRenderer('docs', {}, '/')
  installSourcesRule(md as unknown as Parameters<typeof installSourcesRule>[0])
})

const render = (body: string, { flag = true, path = 'pomoshch/example.md' } = {}) =>
  md.render(
    ['---', 'title: Example', ...(flag ? ['sources: visible'] : []), '---', '', body, ''].join('\n'),
    { path: `/docs/${path}`, relativePath: path, cleanUrls: true }
  )

const TELEGRAM = '<!-- source: https://telegram.org/blog/monetization-for-channels 2026-09-04 -->'
const CLIPPING_NET = '<!-- source: https://clipping.net/clip 2026-09-05 -->'
const TAX = '<!-- source: https://npd.nalog.ru/ 2026-09-04 -->'

describe('source comments without the flag', () => {
  it('stay invisible and change nothing about the HTML', () => {
    const body = `Telegram pays half ${TELEGRAM} and the board says otherwise ${CLIPPING_NET}.`

    const off = render(body, { flag: false })

    // Byte-identical is the contract for the ~200 pages waiting their turn in the rollout, so the
    // assertion is on the whole document and not on the absence of a marker.
    expect(off).toBe(`<p>Telegram pays half ${TELEGRAM} and the board says otherwise ${CLIPPING_NET}.</p>\n`)
    expect(off).not.toContain('src-ref')
    expect(off).not.toContain('Источники')
  })

  it('is not made visible by a neighbouring flag value', () => {
    // `sources: true` or a stray `sources:` list must not half-activate the rule.
    const html = md.render(['---', 'title: T', 'sources: true', '---', '', `x ${TAX}`, ''].join('\n'), {
      path: '/docs/pomoshch/example.md',
      relativePath: 'pomoshch/example.md',
    })

    expect(html).toContain(TAX)
    expect(html).not.toContain('src-ref')
  })
})

describe('source comments with the flag', () => {
  it('numbers references in first-citation order and appends the list', () => {
    const html = render(`First ${TELEGRAM} then ${TAX}.`)

    expect(html).toContain('First <sup class="src-ref"><a href="#src-1">1</a></sup>')
    expect(html).toContain('then <sup class="src-ref"><a href="#src-2">2</a></sup>')
    expect(html).not.toContain('<!-- source:')
    expect(html).toContain('<li id="src-1"><a href="https://telegram.org/blog/monetization-for-channels" rel="nofollow noopener">telegram.org</a> — 2026-09-04</li>')
    expect(html).toContain('<li id="src-2"><a href="https://npd.nalog.ru/" rel="nofollow noopener">npd.nalog.ru</a> — 2026-09-04</li>')
  })

  it('renders a competitor platform as plain text with no link at all', () => {
    const html = render(`Their own terms say so ${CLIPPING_NET}.`)

    expect(html).toContain('<sup class="src-ref"><a href="#src-1">1</a></sup>')
    expect(html).toContain('<li id="src-1">clipping.net — 2026-09-05</li>')
    // Not merely nofollow: the competitor's URL must not appear as an href anywhere.
    expect(html).not.toContain('href="https://clipping.net/clip"')
  })

  it('links a citation of our own page as an internal link in the page language, never nofollow', () => {
    // A self-citation is not an outbound link. It is re-aimed at the reader's version of the page
    // and carries neither `nofollow` nor `target` — `check:dist` fails the build on an internal
    // nofollow, so the first page to cite darebay.com must not ship one.
    const OWN = '<!-- source: https://darebay.com/en/help/what-commission 2026-09-04 -->'

    const ru = render(`Комиссия ${OWN}.`, { path: 'pomoshch/example.md' })
    expect(ru).toContain('<li id="src-1"><a href="/pomoshch/kakaya-komissiya">darebay.com</a> — 2026-09-04</li>')
    expect(ru).not.toContain('nofollow')

    const en = render(`Fee ${OWN}.`, { path: 'en/help/example.md' })
    expect(en).toContain('<li id="src-1"><a href="/en/help/what-commission">darebay.com</a> — 2026-09-04</li>')

    // An application address has no docs page behind it: relative, in the reader's application
    // tree, and `_self` so the docs router does not swallow it.
    const app = render(`Tasks <!-- source: https://darebay.com/en/tasks 2026-09-04 -->.`, { path: 'ua/dopomoha/a.md' })
    expect(app).toContain('<li id="src-1"><a href="/ua/tasks" target="_self">darebay.com</a> — 2026-09-04</li>')
  })

  it('gives a duplicated URL one number and one list entry', () => {
    // The same URL twice, the second time with a later re-check date: one number, the first date.
    const later = '<!-- source: https://clipping.net/clip 2026-09-11 -->'
    const html = render(`A ${CLIPPING_NET} B ${later} C ${TAX}.`)

    expect(html.match(/href="#src-1"/g)).toHaveLength(2)
    expect(html).toContain('<li id="src-1">clipping.net — 2026-09-05</li>')
    expect(html).not.toContain('2026-09-11')
    expect(html.match(/<li id="src-/g)).toHaveLength(2)
    expect(html).toContain('<li id="src-2">')
  })

  it('numbers a comment inside a table cell and one on its own line', () => {
    const html = render(
      ['| a | b |', '|---|---|', `| c ${TELEGRAM} | d |`, '', CLIPPING_NET, '', 'End.'].join('\n')
    )

    expect(html).toContain('<td>c <sup class="src-ref"><a href="#src-1">1</a></sup></td>')
    expect(html).toContain('<sup class="src-ref"><a href="#src-2">2</a></sup>')
    expect(html).not.toContain('<!-- source:')
  })

  it('heads the list in the locale of the page path', () => {
    expect(render(`x ${TAX}`, { path: 'pomoshch/a.md' })).toContain('<h2>Источники</h2>')
    expect(render(`x ${TAX}`, { path: 'ua/dopomoha/a.md' })).toContain('<h2>Джерела</h2>')
    expect(render(`x ${TAX}`, { path: 'en/help/a.md' })).toContain('<h2>Sources</h2>')
  })

  it('puts the list last, after the article, so the shell can follow it', () => {
    const html = render(`Body ${TAX}\n\n## Real heading\n\nMore.`)

    // `<Content />` renders this; "more in this section" and the CTA come after it in
    // LandingLayout.vue, so being last in the Markdown is what puts the sources before them.
    expect(html.indexOf('db-sources')).toBeGreaterThan(html.indexOf('Real heading'))
    expect(html.trimEnd().endsWith('</section>')).toBe(true)
  })

  it('appends nothing when a flagged page has no sources yet', () => {
    const html = render('Nothing to cite here.')

    expect(html).toBe('<p>Nothing to cite here.</p>\n')
  })

  it('fails the build on a malformed comment instead of hiding the claim', () => {
    expect(() => render('Half a citation <!-- source: https://npd.nalog.ru/ -->.')).toThrow(/sources: pomoshch\/example\.md/)
  })

  it('escapes a URL and a date rather than letting them close an attribute', () => {
    const html = render('x <!-- source: https://example.com/?a="b&c=1 2026-09-04 -->')

    expect(html).toContain('href="https://example.com/?a=&quot;b&amp;c=1"')
  })
})

describe('competitor classification', () => {
  it('covers the marketplaces the corpus cites, including their subdomains', () => {
    for (const host of [
      'whop.com',
      'docs.whop.com',
      'contentrewards.com',
      'vyro.com',
      'www.vyro.com',
      'clipping.net',
      'www.clipping.io',
      'vues.app',
      'reach.cat',
      'klipni.com',
      'www.primeoracles.com',
      'clipradar.co',
    ]) {
      expect(isCompetitorHost(host), host).toBe(true)
    }
  })

  it('treats a wildcard entry as the brand under any TLD, not as any host containing it', () => {
    expect(isCompetitorHost('klipni.ru')).toBe(true)
    expect(isCompetitorHost('legal.klipni.com')).toBe(true)
    expect(isCompetitorHost('vues.io')).toBe(true)
    expect(isCompetitorHost('notklipni.com')).toBe(false)
    expect(isCompetitorHost('klipni')).toBe(false)
  })

  it('leaves an ordinary citable source alone', () => {
    for (const host of [
      'telegram.org',
      'ads.telegram.org',
      'npd.nalog.ru',
      'zir.tax.gov.ua',
      'vk.company',
      'support.google.com',
      'www.adamigo.ai',
    ]) {
      expect(isCompetitorHost(host), host).toBe(false)
    }
  })

  it('keeps the list in one place', () => {
    expect(COMPETITOR_SOURCE_HOSTS).toContain('clipping.net')
    expect(new Set(COMPETITOR_SOURCE_HOSTS).size).toBe(COMPETITOR_SOURCE_HOSTS.length)
  })
})

describe('helpers', () => {
  it('prints a host the way the compare cards already do', () => {
    expect(hostOf('https://www.nalog.gov.ru/rn77/')).toBe('nalog.gov.ru')
    expect(hostOf('not a url')).toBe('not a url')
  })

  it('reads the locale off the path, with Russian at the root', () => {
    expect(localeFromPath('pomoshch/verifikatsiya.md')).toBe('ru')
    expect(localeFromPath('/o-proekte/index.md')).toBe('ru')
    expect(localeFromPath('ua/dopomoha/veryfikatsiia.md')).toBe('uk')
    expect(localeFromPath('en/help/verification.md')).toBe('en')
    // Arabic, known to the build before its tree is declared.
    expect(localeFromPath('ar/earnings/clipping-platforms-that-pay-in-egypt-and-arab-countries.md')).toBe('ar')
    // Not a locale prefix: a slug that merely starts with the letters.
    expect(localeFromPath('uanews/x.md')).toBe('ru')
    expect(localeFromPath('arabic/x.md')).toBe('ru')
  })

  it('takes the heading from the one landing copy table', () => {
    expect([sourcesHeading('ru'), sourcesHeading('uk'), sourcesHeading('en'), sourcesHeading('ar')]).toEqual([
      'Источники',
      'Джерела',
      'Sources',
      'المصادر',
    ])
  })
})
