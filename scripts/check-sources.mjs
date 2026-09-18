#!/usr/bin/env node --experimental-strip-types
// Are the visible citations still there?
//
// A page with `sources: visible` prints its citation trail: a numbered list of the pages we read a
// competitor's or a regulator's number off, with the date we read it. That list is a promise a
// reader can act on, and it is the one part of the corpus that rots without anybody touching the
// repo — a terms page moves, a help centre is reorganised, a rate board drops a URL, and the
// article keeps pointing at a 404 while every build stays green.
//
// So this is a MANUAL tool and deliberately not a gate: it is the only script here that talks to
// the internet, the build image has no egress, and a competitor rate-limiting us is not a reason
// to fail a deploy. Run it before enabling the flag on a page and when re-checking one. A dead URL
// means fix or replace the citation — do not ship the flag on a page that cites a 404.
//
//   npm run check:sources              # every page that already carries the flag
//   npm run check:sources -- --all     # every page that has source comments, flagged or not
//   npm run check:sources -- pomoshch/verifikatsiya.md docs/o-proekte/manifest.md
//
// Exit code is 1 when a URL is dead, 0 when everything answers (redirects are reported, not
// fatal: a 301 to the same document is normal housekeeping on somebody else's site, and it is the
// editor who decides whether the citation should now name the new address).

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')

// The citation regex and the competitor list come from the renderer, not from a copy: a script
// that matched a different comment shape than the build would either probe URLs no reader sees or
// bless a page whose markers it never looked at.
const { SOURCE_COMMENT, hostOf, isCompetitorHost } = await import(join(DOCS, '.vitepress', 'sources.ts'))

export const TIMEOUT_MS = 10_000
const CONCURRENCY = 6

// Some of the hosts we cite answer a bare programmatic request with 403 and a real browser with
// 200. A plain UA would therefore report healthy citations as dead, which is worse than useless —
// it teaches the reader of this output to ignore it.
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const markdownFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '.vitepress' ? [] : markdownFiles(full)
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : []
  })

/**
 * The frontmatter block and the article body, split the way VitePress splits them.
 *
 * Both halves are needed: the flag is only a flag in the frontmatter, and the split decides what is
 * visible. The markdown-it rule can only reach the BODY, so a citation inside `hero.takeaways`
 * stays invisible even on a flagged page — those are still real citations and a dead one is still
 * dead, so they are checked and labelled rather than dropped.
 */
export function split(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/)
  return match ? { frontmatter: match[1], body: text.slice(match[0].length) } : { frontmatter: '', body: text }
}

export const isFlagged = (text) => /^sources:[ \t]*visible[ \t]*$/m.test(split(text).frontmatter)

// `SOURCE_COMMENT` is global and shared with the renderer, so it is never handed to `.test()`
// here: that would leave `lastIndex` advanced and make the next caller skip a file.
const HAS_CITATION = /<!--\s*source:/

/** Every citation in one file, in reading order, each marked as rendered or frontmatter-only. */
export function citationsOf(text) {
  const { frontmatter, body } = split(text)
  const rendered = new Set([...body.matchAll(SOURCE_COMMENT)].map(([, url]) => url))
  return [...`${frontmatter}\n${body}`.matchAll(SOURCE_COMMENT)].map(([, url, date]) => ({
    url,
    date,
    rendered: rendered.has(url),
  }))
}

export const selectPages = (argv) => {
  const explicit = argv.filter((arg) => !arg.startsWith('-'))
  if (explicit.length) {
    return explicit.map((arg) => {
      const candidates = [resolve(ROOT, arg), resolve(DOCS, arg), resolve(process.cwd(), arg)]
      const file = candidates.find((path) => {
        try { return statSync(path).isFile() } catch { return false }
      })
      if (!file) throw new Error(`check:sources: no such page: ${arg}`)
      return file
    })
  }
  const all = argv.includes('--all')
  return markdownFiles(DOCS).filter((file) => {
    const text = readFileSync(file, 'utf8')
    return all ? HAS_CITATION.test(text) : isFlagged(text)
  })
}

/**
 * One probe: HEAD, then GET when HEAD is not answered honestly.
 *
 * HEAD first because a citation check has no use for the body and a lot of these are heavy pages.
 * But HEAD is the request servers implement last: a 403/405/501, or a connection dropped outright,
 * says nothing about whether the document is there. `redirect: 'manual'` so a moved citation is
 * reported as moved instead of being silently followed to a 200 the reader will never see.
 */
export async function probe(url, { fetchImpl = fetch, timeout = TIMEOUT_MS } = {}) {
  const request = (method) =>
    fetchImpl(url, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeout),
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
    })

  let response
  try {
    response = await request('HEAD')
    // 404 is on the list because Google's help centre answers HEAD with 404 and GET with 200
    // (support.google.com/youtube/answer/3399767, 2026-09-17): a citation is dead only when GET says so.
    // 401 joined it for India's Press Information Bureau, which answers HEAD with 401 and GET with
    // 200 (pib.gov.in/PressReleasePage.aspx, 2026-09-18) — a press release is not behind a login.
    if ([400, 401, 403, 404, 405, 406, 501].includes(response.status)) response = await request('GET')
  } catch (headError) {
    try {
      response = await request('GET')
    } catch (getError) {
      return { state: 'dead', detail: `${getError.name}: ${getError.message} (HEAD: ${headError.message})` }
    }
  }

  const { status } = response
  if (status >= 300 && status < 400) {
    const location = response.headers.get('location') ?? '(no Location header)'
    return { state: 'redirect', detail: `${status} -> ${new URL(location, url).href}` }
  }
  if (status >= 400) return { state: 'dead', detail: String(status) }
  return { state: 'ok', detail: String(status) }
}

async function mapWithLimit(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await worker(items[index])
      }
    })
  )
  return results
}

/** One entry per URL, carrying every page and every date that cites it. */
export function indexCitations(pages, { read = (file) => readFileSync(file, 'utf8'), logger = console } = {}) {
  const byUrl = new Map()
  for (const file of pages) {
    const text = read(file)
    const page = relative(DOCS, file)
    const citations = citationsOf(text)
    logger.log(
      `${page}: ${new Set(citations.map((citation) => citation.url)).size} source URLs` +
        `${isFlagged(text) ? '' : ' (flag not set)'}`
    )
    for (const { url, date, rendered } of citations) {
      const known = byUrl.get(url) ?? { url, dates: new Set(), pages: new Set(), rendered: false }
      known.dates.add(date)
      known.pages.add(page)
      known.rendered ||= rendered
      byUrl.set(url, known)
    }
  }
  return [...byUrl.values()]
}

// The cited URL first on its own line, because that is what an editor has to find in the page they
// are about to fix; the status and the provenance are what they need next, not before.
export const report = (state, entry) =>
  [
    `${state} ${entry.url}`,
    `    ${entry.detail}`,
    `    ${isCompetitorHost(hostOf(entry.url)) ? 'competitor' : 'source'} ${hostOf(entry.url)}` +
      ` · cited ${[...entry.dates].sort().join(', ')}${entry.rendered ? '' : ' · frontmatter only, not rendered'}`,
    `    pages: ${[...entry.pages].join(', ')}`,
    '',
  ].join('\n')

async function runCli(argv) {
  const pages = selectPages(argv)
  if (!pages.length) {
    console.log('check:sources: no page carries `sources: visible` — nothing to check (use --all to sweep every cited URL)')
    return 0
  }

  const urls = indexCitations(pages)
  console.log(`\nchecking ${urls.length} unique URLs across ${pages.length} pages (HEAD, fallback GET, ${TIMEOUT_MS / 1000}s)\n`)

  const checked = await mapWithLimit(urls, CONCURRENCY, async (entry) => ({ ...entry, ...(await probe(entry.url)) }))
  const dead = checked.filter((entry) => entry.state === 'dead')
  const redirected = checked.filter((entry) => entry.state === 'redirect')

  for (const entry of dead) console.log(report('DEAD', entry))
  for (const entry of redirected) console.log(report('REDIRECT', entry))
  console.log(
    `check:sources: ${checked.length - dead.length - redirected.length} ok, ${redirected.length} redirected, ${dead.length} dead`
  )
  if (!dead.length) return 0
  console.log('A dead citation must be fixed or replaced before `sources: visible` ships on its page.')
  return 1
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) process.exitCode = await runCli(process.argv.slice(2))
