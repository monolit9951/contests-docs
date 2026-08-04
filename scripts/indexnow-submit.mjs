#!/usr/bin/env node
// Submit deployed canonical URLs to IndexNow-compatible endpoints. A failed
// endpoint is a failed command: callers must never print a success notification
// for a request that was ignored, rejected or exhausted its retries.

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const DEFAULT_ENDPOINTS = [
  'https://yandex.com/indexnow',
  'https://api.indexnow.org/indexnow',
]
export const DEFAULT_KEY = 'f54f4783c3e2566c84087cd19b829ddc'

export const normalizeIndexNowUrl = (raw) => {
  const value = raw.trim()
  if (!value) return null
  const url = new URL(value)
  if (url.origin !== 'https://darebay.com') throw new Error(`IndexNow URL is off-origin: ${value}`)
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`IndexNow URL must be canonical without credentials/query/fragment: ${value}`)
  }
  if (url.pathname.endsWith('.html')) throw new Error(`IndexNow URL must not be a raw .html duplicate: ${value}`)
  return url.toString()
}

const normalizeUrls = (values) => [...new Set(values.map(normalizeIndexNowUrl).filter(Boolean))]

const chunks = (values, size) => {
  const result = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}

export async function submitIndexNow(values, options = {}) {
  const urls = normalizeUrls(values)
  if (!urls.length) return { urls: 0, requests: [] }

  const fetchImpl = options.fetchImpl ?? fetch
  const endpoints = options.endpoints ?? DEFAULT_ENDPOINTS
  const key = options.key ?? DEFAULT_KEY
  const retries = options.retries ?? 3
  const timeoutMs = options.timeoutMs ?? 15_000
  const delay = options.delay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
  const logger = options.logger ?? console
  const requests = []
  const failures = []

  for (const endpoint of endpoints) {
    for (const [batchIndex, batch] of chunks(urls, 10_000).entries()) {
      const payload = {
        host: 'darebay.com',
        key,
        keyLocation: `https://darebay.com/${key}.txt`,
        urlList: batch,
      }
      let accepted = false
      let last = 'no response'
      for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
          const response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json; charset=utf-8' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(timeoutMs),
          })
          const responseText = (await response.text()).trim().slice(0, 500)
          last = `HTTP ${response.status}${responseText ? `: ${responseText}` : ''}`
          requests.push({ endpoint, batch: batchIndex + 1, attempt, status: response.status })
          if (response.status === 200 || response.status === 202) {
            logger.log(`IndexNow accepted: ${endpoint}, batch ${batchIndex + 1}, ${batch.length} URLs, HTTP ${response.status}`)
            accepted = true
            break
          }
          if (response.status !== 429 && response.status < 500) break
        } catch (error) {
          last = error instanceof Error ? error.message : String(error)
          requests.push({ endpoint, batch: batchIndex + 1, attempt, status: 'network-error' })
        }
        if (attempt < retries) await delay(Math.min(4_000, 500 * 2 ** (attempt - 1)))
      }
      if (!accepted) failures.push(`${endpoint} batch ${batchIndex + 1}: ${last}`)
    }
  }

  if (failures.length) throw new Error(`IndexNow submission failed:\n${failures.join('\n')}`)
  return { urls: urls.length, requests }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) {
  const fileIndex = process.argv.indexOf('--file')
  const source = fileIndex >= 0 ? readFileSync(process.argv[fileIndex + 1], 'utf8') : readFileSync(0, 'utf8')
  const urls = source.split(/\r?\n/)
  try {
    const result = await submitIndexNow(urls)
    console.log(result.urls ? `IndexNow complete: ${result.urls} unique URLs` : 'IndexNow: no changed content URLs')
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
