#!/usr/bin/env node
//
// Refresh the live-catalogue snapshot the public fact card cites.
//
// WHY THIS IS A SEPARATE, MANUAL SCRIPT. `gen:facts` runs inside `docs:build`, which runs in CI
// and in the release image build; a generator that reached for the network there would make the
// build depend on production being up and on whatever the catalogue happened to answer that
// second. Two releases of the same commit would then ship different public numbers. So the build
// reads a COMMITTED snapshot and never fetches: this script is the only thing that talks to the
// API, it is run by a human (or a cron that commits its output through review), and its result is
// reviewed in the diff like any other data file.
//
//   npm run facts:refresh                       # https://darebay.com
//   npm run facts:refresh -- --origin https://dev.darebay.com
//
// The endpoint is the same public catalogue call the frontend's own landing pages make
// (`contests-frontend/src/shared/lib/hooks/useLandingContests.ts`): `GET /api/contests` with
// `page`, `pageSize` and `sortDirection`, answered as a Spring page. Hidden and link-only
// campaigns are withheld by the backend from everyone but admins; the two flags are filtered here
// as well, exactly as `contests-frontend/src/domain/contest/lib/liveStats.ts` does, so an
// authenticated run can never widen the numbers a visitor would see.

import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const SNAPSHOT_FILE = join(ROOT, 'data', 'contests-snapshot.json')
export const SNAPSHOT_SCHEMA_VERSION = 1

const DEFAULT_ORIGIN = 'https://darebay.com'
const PAGE_SIZE = 50
// A page cursor that never reports `last` (a backend regression, a proxy that drops the body)
// must stop the run instead of looping forever against production.
const MAX_PAGES = 40
const REQUEST_TIMEOUT_MS = 30_000

const argOf = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

/** Listed in the public catalogue at all — the twin of `isListedTask` in the frontend. */
export const isListed = (contest) => contest.hidden !== true && contest.unlisted !== true

/**
 * Open for new work. `acceptingWorks` is absent during the window when the frontend leads the
 * backend, so this gates on an explicit `false` — the same rule the frontend documents, and for
 * the same reason: `!acceptingWorks` would read every task as closed for those minutes.
 */
export const isOpen = (contest) => contest.status === 'ACTIVE' && contest.acceptingWorks !== false

const positive = (value) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null)

/** The platforms a task names, from either field the catalogue may carry. */
const platformsOf = (contest) => [
  ...(Array.isArray(contest.allowedPlatforms) ? contest.allowedPlatforms : []),
  ...(Array.isArray(contest.featuredPlatforms) ? contest.featuredPlatforms : []),
]

export function summarize(contests, { origin, fetchedAt }) {
  const listed = contests.filter(isListed)
  const open = listed.filter(isOpen)
  const ppv = open.map((contest) => contest.payPerView).filter(Boolean)

  const rates = ppv.map((config) => positive(config.cpmRate)).filter((value) => value !== null)
  const caps = ppv.map((config) => positive(config.maxPerWork)).filter((value) => value !== null)
  const thresholds = [
    ...new Set(ppv.map((config) => config.minViewsThreshold).filter((value) => typeof value === 'number')),
  ].sort((first, second) => first - second)
  const platforms = [...new Set(open.flatMap(platformsOf))].sort()

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    fetchedAt,
    source: {
      endpoint: `${origin}/api/contests`,
      params: { page: '0..', pageSize: PAGE_SIZE, sortDirection: 'DESC' },
      listedFilter: 'hidden !== true && unlisted !== true',
      openFilter: "status === 'ACTIVE' && acceptingWorks !== false",
    },
    counts: {
      returned: contests.length,
      listed: listed.length,
      open: open.length,
      openWithPayPerView: ppv.length,
      openUncapped: ppv.filter((config) => positive(config.maxPerWork) === null).length,
    },
    ppv: {
      rateMin: rates.length ? Math.min(...rates) : null,
      rateMax: rates.length ? Math.max(...rates) : null,
      capMax: caps.length ? Math.max(...caps) : null,
      viewThresholds: thresholds,
    },
    // Empty is the honest answer, not a bug: the catalogue's list projection does not carry the
    // platform fields today, so the union over listed open tasks is empty and the fact card's
    // platform row stays on its reviewed wording instead of inventing evidence.
    platforms,
  }
}

const fetchPage = async (origin, page) => {
  const url = new URL('/api/contests', origin)
  url.searchParams.set('page', String(page))
  url.searchParams.set('pageSize', String(PAGE_SIZE))
  url.searchParams.set('sortDirection', 'DESC')
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`facts-refresh: ${url.pathname}?page=${page} -> HTTP ${response.status}`)
  const body = await response.json()
  if (!Array.isArray(body?.content)) throw new Error(`facts-refresh: page ${page} carries no content array`)
  return body
}

export async function fetchCatalogue(origin) {
  const contests = []
  let page = 0
  let totalPages = 1
  let totalElements = null
  for (; page < MAX_PAGES; page += 1) {
    const body = await fetchPage(origin, page)
    contests.push(...body.content)
    totalPages = typeof body.totalPages === 'number' ? body.totalPages : page + 1
    totalElements = typeof body.totalElements === 'number' ? body.totalElements : totalElements
    if (body.last === true || page + 1 >= totalPages) {
      page += 1
      break
    }
  }
  if (page >= MAX_PAGES) throw new Error(`facts-refresh: catalogue did not end within ${MAX_PAGES} pages`)
  if (totalElements !== null && contests.length !== totalElements) {
    throw new Error(`facts-refresh: fetched ${contests.length} of ${totalElements} contests`)
  }
  return { contests, pagesFetched: page, totalElements }
}

const main = async () => {
  const origin = argOf('origin', DEFAULT_ORIGIN)
  const { contests, pagesFetched } = await fetchCatalogue(origin)
  const snapshot = summarize(contests, { origin, fetchedAt: new Date().toISOString() })
  snapshot.counts.pagesFetched = pagesFetched
  writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(
    `contests snapshot: ${snapshot.counts.listed} listed, ${snapshot.counts.open} open, ` +
      `rate ${snapshot.ppv.rateMin}-${snapshot.ppv.rateMax}, cap max ${snapshot.ppv.capMax}, ` +
      `thresholds [${snapshot.ppv.viewThresholds.join(', ')}], platforms [${snapshot.platforms.join(', ')}]`
  )
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main()
