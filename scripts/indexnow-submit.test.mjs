import { describe, expect, it, vi } from 'vitest'
import { submitIndexNow } from './indexnow-submit.mjs'

const response = (status, text = '') => ({ status, text: async () => text })
const silent = { log: vi.fn() }

describe('IndexNow submission', () => {
  it('retries throttling and reports the accepted status', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(429, 'slow down'))
      .mockResolvedValueOnce(response(202))
    const result = await submitIndexNow(['https://darebay.com/en/earnings/example'], {
      endpoints: ['https://indexnow.test'],
      fetchImpl,
      delay: async () => {},
      logger: silent,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result.requests.map((request) => request.status)).toEqual([429, 202])
  })

  it('fails instead of claiming success for a rejected request', async () => {
    await expect(submitIndexNow(['https://darebay.com/zarabotok/example'], {
      endpoints: ['https://indexnow.test'],
      fetchImpl: async () => response(400, 'bad payload'),
      delay: async () => {},
      logger: silent,
    })).rejects.toThrow(/HTTP 400: bad payload/)
  })

  it('deduplicates URLs and rejects a different host', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200))
    const result = await submitIndexNow([
      'https://darebay.com/zarabotok/',
      'https://darebay.com/zarabotok/',
    ], { endpoints: ['https://indexnow.test'], fetchImpl, logger: silent })
    expect(result.urls).toBe(1)
    await expect(submitIndexNow(['https://example.com/'], { fetchImpl, logger: silent })).rejects.toThrow(/off-origin/)
  })

  it.each([
    'https://user:secret@darebay.com/zarabotok/example',
    'https://darebay.com/zarabotok/example?ref=duplicate',
    'https://darebay.com/zarabotok/example#fragment',
    'https://darebay.com/zarabotok/example.html',
    'https://darebay.com:8443/zarabotok/example',
  ])('rejects non-canonical URL %s', async (url) => {
    await expect(submitIndexNow([url], {
      endpoints: ['https://indexnow.test'],
      fetchImpl: async () => response(200),
      logger: silent,
    })).rejects.toThrow(/canonical|off-origin|raw \.html/)
  })

  it('allows a deleted clean canonical URL for removal notification', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(202))
    const result = await submitIndexNow(['https://darebay.com/removed-clean-url'], {
      endpoints: ['https://indexnow.test'],
      fetchImpl,
      logger: silent,
    })
    expect(result.urls).toBe(1)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })
})
