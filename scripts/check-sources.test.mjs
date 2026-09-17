import { describe, expect, it, vi } from 'vitest'
import { citationsOf, indexCitations, isFlagged, probe, report, split } from './check-sources.mjs'

const response = (status, headers = {}) => ({ status, headers: new Headers(headers) })
const silent = { log: vi.fn() }

const PAGE = `---
title: Ставки по нишам
sources: visible
hero:
  takeaways:
    - "Ставка держится на доске <!-- source: https://clipradar.co/rates 2026-09-04 -->."
---

# Ставки

По доске музыка идёт дешевле <!-- source: https://clipradar.co/rates 2026-09-04 -->, а налог
считают по ставке НПД <!-- source: https://npd.nalog.ru/ 2026-09-04 -->.
`

describe('reading citations out of a page', () => {
  it('separates frontmatter from body so the flag is never read mid-article', () => {
    const { frontmatter, body } = split(PAGE)

    expect(frontmatter).toContain('title: Ставки по нишам')
    expect(frontmatter).not.toContain('# Ставки')
    expect(body.startsWith('\n# Ставки')).toBe(true)
  })

  it('reads the flag only from the frontmatter', () => {
    expect(isFlagged(PAGE)).toBe(true)
    expect(isFlagged('---\ntitle: T\n---\n\nsources: visible\n')).toBe(false)
    expect(isFlagged('---\ntitle: T\nsources: true\n---\n')).toBe(false)
    expect(isFlagged('no frontmatter at all')).toBe(false)
  })

  it('marks a citation that only the hero carries as not rendered', () => {
    // The markdown-it rule cannot reach frontmatter, so a takeaway's citation stays invisible. It
    // is still checked — a dead URL in the hero is as wrong as one in the body — but the label has
    // to say so, or an editor will look for a superscript that is not there.
    const found = citationsOf(`---\ntitle: T\nhero:\n  takeaways:\n    - "x <!-- source: https://clipradar.co/rates 2026-09-04 -->"\n---\n\nBody with nothing cited.\n`)

    expect(found).toEqual([{ url: 'https://clipradar.co/rates', date: '2026-09-04', rendered: false }])
  })

  it('counts a URL cited in both places as rendered, and keeps every occurrence', () => {
    const found = citationsOf(PAGE)

    expect(found.map((citation) => citation.url)).toEqual([
      'https://clipradar.co/rates',
      'https://clipradar.co/rates',
      'https://npd.nalog.ru/',
    ])
    expect(found.every((citation) => citation.rendered)).toBe(true)
  })

  it('does not lose a file to a leftover regex index', () => {
    // `SOURCE_COMMENT` is a shared global regex. Reading the same text twice must give the same
    // answer; it would not if anything here advanced `lastIndex`.
    expect(citationsOf(PAGE)).toEqual(citationsOf(PAGE))
  })
})

describe('probing one citation', () => {
  it('reports a 200 as alive after a single HEAD', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200))

    expect(await probe('https://npd.nalog.ru/', { fetchImpl })).toEqual({ state: 'ok', detail: '200' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][1].method).toBe('HEAD')
  })

  it('falls back to GET when HEAD is refused rather than answered', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(405))
      .mockResolvedValueOnce(response(200))

    expect(await probe('https://zir.tax.gov.ua/x.pdf', { fetchImpl })).toEqual({ state: 'ok', detail: '200' })
    expect(fetchImpl.mock.calls.map((call) => call[1].method)).toEqual(['HEAD', 'GET'])
  })

  it('falls back to GET when HEAD throws, and reports both failures when GET throws too', async () => {
    const recovered = vi.fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(response(200))
    expect(await probe('https://example.com/a', { fetchImpl: recovered })).toEqual({ state: 'ok', detail: '200' })

    const timeout = Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' })
    const dead = vi.fn().mockRejectedValue(timeout)
    const result = await probe('https://example.com/b', { fetchImpl: dead })
    expect(result.state).toBe('dead')
    expect(result.detail).toContain('TimeoutError')
  })

  it('reports a moved citation instead of following it to a 200 the reader never sees', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(301, { location: '/post/tiktok-ads-costs' }))

    expect(await probe('https://www.admetrics.io/en/post/tiktok-ads-costs', { fetchImpl })).toEqual({
      state: 'redirect',
      detail: '301 -> https://www.admetrics.io/post/tiktok-ads-costs',
    })
  })

  it('reports a 404 as dead', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(404))

    expect(await probe('https://support.google.com/youtube/answer/3399767', { fetchImpl })).toEqual({
      state: 'dead',
      detail: '404',
    })
  })
})

describe('the line an editor reads', () => {
  it('leads with the URL and says whether the host is a competitor', () => {
    const entry = {
      url: 'https://clipping.net/clip',
      detail: '404',
      dates: new Set(['2026-09-05', '2026-09-04']),
      pages: new Set(['zarabotok/analogi-clipping-net.md']),
      rendered: true,
    }

    const lines = report('DEAD', entry).split('\n')
    expect(lines[0]).toBe('DEAD https://clipping.net/clip')
    expect(lines[1]).toBe('    404')
    expect(lines[2]).toBe('    competitor clipping.net · cited 2026-09-04, 2026-09-05')
    expect(lines[3]).toBe('    pages: zarabotok/analogi-clipping-net.md')
  })

  it('flags a frontmatter-only citation and an ordinary source host', () => {
    const line = report('REDIRECT', {
      url: 'https://npd.nalog.ru/',
      detail: '301 -> https://npd.nalog.ru/rn77/',
      dates: new Set(['2026-09-04']),
      pages: new Set(['zarabotok/nalogi-i-samozanyatost-narezchika.md']),
      rendered: false,
    })

    expect(line).toContain('source npd.nalog.ru')
    expect(line).toContain('frontmatter only, not rendered')
  })
})

describe('indexing a set of pages', () => {
  it('collects one entry per URL, carrying every page and date that cites it', () => {
    const other = `---\ntitle: Другая\nsources: visible\n---\n\nТа же доска <!-- source: https://clipradar.co/rates 2026-09-11 -->.\n`
    const read = (file) => (file.endsWith('a.md') ? PAGE : other)

    const entries = indexCitations(['/docs/zarabotok/a.md', '/docs/zarabotok/b.md'], { read, logger: silent })

    expect(entries.map((entry) => entry.url)).toEqual(['https://clipradar.co/rates', 'https://npd.nalog.ru/'])
    const board = entries[0]
    expect([...board.dates].sort()).toEqual(['2026-09-04', '2026-09-11'])
    expect(board.pages.size).toBe(2)
    expect(silent.log).toHaveBeenCalledTimes(2)
  })

  it('says so when a selected page does not carry the flag', () => {
    const logger = { log: vi.fn() }

    indexCitations(['/docs/zarabotok/c.md'], {
      read: () => `---\ntitle: T\n---\n\nx <!-- source: https://npd.nalog.ru/ 2026-09-04 -->\n`,
      logger,
    })

    expect(logger.log.mock.calls[0][0]).toContain('(flag not set)')
  })
})
