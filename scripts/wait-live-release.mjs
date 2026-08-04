#!/usr/bin/env node
// Wait until the public origin serves the exact image built by this workflow.

const expected = process.argv[2]
if (!expected || !/^[a-f0-9]{7,40}$/i.test(expected)) throw new Error('usage: wait-live-release.mjs <git-sha>')
const endpoint = 'https://darebay.com/.well-known/darebay-content-release.txt'
let last = 'no response'

for (let attempt = 1; attempt <= 60; attempt += 1) {
  try {
    const response = await fetch(`${endpoint}?expected=${expected}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    const body = (await response.text()).trim()
    last = `HTTP ${response.status}, body=${JSON.stringify(body)}`
    if (response.ok && body === expected) {
      console.log(`live content release confirmed: ${expected} (attempt ${attempt})`)
      process.exit(0)
    }
  } catch (error) {
    last = error instanceof Error ? error.message : String(error)
  }
  if (attempt < 60) await new Promise((resolve) => setTimeout(resolve, 5_000))
}
throw new Error(`content release ${expected} did not become live: ${last}`)
