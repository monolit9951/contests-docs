import { describe, expect, it } from 'vitest'
import { pathsForManifest, urlsForChanges } from './changed-content-urls.mjs'

const axes = {
  schemaVersion: 1,
  origin: 'https://darebay.com',
  locales: {
    ru: { prefix: '', vitepressKey: 'root' },
    uk: { prefix: '/ua', vitepressKey: 'ua' },
    en: { prefix: '/en', vitepressKey: 'en' },
  },
  hubs: {
    earnings: { ru: 'zarabotok', uk: 'zarobitok', en: 'earnings' },
  },
}

const manifest = (slugs, retired = []) => ({
  ...axes,
  pages: [{ id: 'rates', hub: 'earnings', slugs, retired }],
})

describe('changed content URL mapper', () => {
  it('maps each translated source file to its own localized canonical URL', () => {
    const paths = pathsForManifest(manifest({ ru: 'stavki', uk: 'stavky', en: 'rates' }))
    expect(paths.bySource.get('docs/zarabotok/stavki.md')).toBe('https://darebay.com/zarabotok/stavki')
    expect(paths.bySource.get('docs/ua/zarobitok/stavky.md')).toBe('https://darebay.com/ua/zarobitok/stavky')
    expect(paths.bySource.get('docs/en/earnings/rates.md')).toBe('https://darebay.com/en/earnings/rates')
  })

  it('submits only the localized page whose Markdown changed', () => {
    const current = manifest({ ru: 'stavki', uk: 'stavky', en: 'rates' })
    expect(urlsForChanges({
      lines: ['M\tdocs/ua/zarobitok/stavky.md'],
      oldManifest: current,
      newManifest: current,
    })).toEqual(['https://darebay.com/ua/zarobitok/stavky'])
  })

  it('submits both old and new canonical URLs for a translated rename', () => {
    const oldManifest = manifest({ ru: 'stavki', uk: 'stari-stavky', en: 'rates' })
    const newManifest = manifest({ ru: 'stavki', uk: 'novi-stavky', en: 'rates' })
    expect(urlsForChanges({
      lines: ['R100\tdocs/ua/zarobitok/stari-stavky.md\tdocs/ua/zarobitok/novi-stavky.md'],
      oldManifest,
      newManifest,
    })).toEqual([
      'https://darebay.com/ua/zarobitok/novi-stavky',
      'https://darebay.com/ua/zarobitok/stari-stavky',
    ])
  })

  it('submits every old and new localized URL when the semantic manifest changes', () => {
    const oldManifest = manifest(
      { ru: 'stavki', uk: 'stari-stavky', en: 'rates' },
      ['/docs/ru/zarabotok/stavki'],
    )
    const newManifest = manifest(
      { ru: 'stavki', uk: 'novi-stavky', en: 'rates' },
      ['/docs/ru/zarabotok/stavki', '/ua/zarobitok/stari-stavky'],
    )
    expect(urlsForChanges({
      lines: ['M\tdocs/content-pages.json'],
      oldManifest,
      newManifest,
    })).toEqual([
      'https://darebay.com/docs/ru/zarabotok/stavki',
      'https://darebay.com/en/earnings/rates',
      'https://darebay.com/ua/zarobitok/novi-stavky',
      'https://darebay.com/ua/zarobitok/stari-stavky',
      'https://darebay.com/zarabotok/stavki',
    ])
  })

  it('submits declared retired URLs on the first manifest-backed release', () => {
    const newManifest = manifest(
      { ru: 'stavki', uk: 'stavky', en: 'rates' },
      ['/docs/ru/zarabotok/stavki'],
    )
    expect(urlsForChanges({
      lines: ['A\tdocs/content-pages.json'],
      oldManifest: null,
      newManifest,
    })).toEqual([
      'https://darebay.com/docs/ru/zarabotok/stavki',
      'https://darebay.com/en/earnings/rates',
      'https://darebay.com/ua/zarobitok/stavky',
      'https://darebay.com/zarabotok/stavki',
    ])
  })

  it('submits only current URLs for a non-manifest global surface change', () => {
    const oldManifest = manifest({ ru: 'starye-stavki', uk: 'stari-stavky', en: 'old-rates' })
    const newManifest = manifest({ ru: 'stavki', uk: 'stavky', en: 'rates' })
    expect(urlsForChanges({
      lines: ['M\tdocs/.vitepress/config.ts'],
      oldManifest,
      newManifest,
    })).toEqual([
      'https://darebay.com/en/earnings/rates',
      'https://darebay.com/ua/zarobitok/stavky',
      'https://darebay.com/zarabotok/stavki',
    ])
  })

  it('keeps deleted pages discoverable from the previous manifest', () => {
    const oldManifest = manifest({ ru: 'stavki', uk: 'stavky', en: 'rates' })
    const newManifest = { ...axes, pages: [] }
    expect(urlsForChanges({
      lines: ['D\tdocs/en/earnings/rates.md'],
      oldManifest,
      newManifest,
    })).toEqual(['https://darebay.com/en/earnings/rates'])
  })
})
