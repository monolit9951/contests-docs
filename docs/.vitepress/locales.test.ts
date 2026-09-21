import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COPY as LLMS_COPY } from '../../scripts/gen-llms.mjs'
import {
  FACT_LOCALES,
  LABELS as FACT_LABELS,
  SOURCE_LABELS,
  TABLE_HEADERS,
  buildFacts,
  readInputs,
} from '../../scripts/gen-facts-json.mjs'
import { CHROME_COPY } from './chrome'
import siteConfig, {
  AUTHOR_NAME,
  HUB_TITLES,
  LOCALE_DESCRIPTIONS,
  LOCALE_LABELS,
  OG_LOCALE,
  ORGANIZATION,
  OVERVIEW,
} from './config'
import { businessUrlForLocale, productUrlForLocale, tasksUrlForLocale } from './links'
import { KNOWN_LOCALES, LOCALES, knownAxisOf, textDirectionOf, type Locale } from './registry'
import { sourcesHeading } from './sources'
import { LANDING_COPY, NUMBER_LOCALE, localeOf } from './theme/landing/copy'

// Every per-language table of this build, held against the registry's list of KNOWN languages.
//
// WHY. A language goes live by being declared in docs/content-pages.json, and nothing else is meant
// to change that day (see `KNOWN_LOCALES` in registry.ts). That only works if every dictionary
// already speaks the language — interface chrome, landing copy, hub titles, Open Graph locales,
// llms.txt sections, the fact card. None of these files is type-checked in the build, so a table
// that misses a language fails at render time, on the one tree nobody has looked at yet: an Arabic
// page with a Russian 404, or an `undefined` column heading. This file fails first — for a language
// added to `KNOWN_LOCALES` without its keys, and for a key added to one language and not the others.

const known = [...KNOWN_LOCALES].sort()

/** `value` has exactly the keys of `reference`, recursively, and no empty string anywhere. */
const expectSameShape = (value: unknown, reference: unknown, path: string) => {
  if (typeof reference === 'string') {
    expect(typeof value, path).toBe('string')
    expect((value as string).trim(), path).not.toBe('')
    return
  }
  if (Array.isArray(reference)) {
    expect(Array.isArray(value), path).toBe(true)
    expect((value as unknown[]).length, path).toBe(reference.length)
    reference.forEach((item, index) => expectSameShape((value as unknown[])[index], item, `${path}[${index}]`))
    return
  }
  if (reference && typeof reference === 'object') {
    expect(value && typeof value === 'object', path).toBe(true)
    expect(Object.keys(value as object).sort(), path).toEqual(Object.keys(reference).sort())
    for (const key of Object.keys(reference)) {
      expectSameShape((value as Record<string, unknown>)[key], (reference as Record<string, unknown>)[key], `${path}.${key}`)
    }
  }
}

/** A table keyed by language: every known language, each shaped like the English entry. */
const expectEveryLanguage = (table: Record<string, unknown>, name: string) => {
  expect(Object.keys(table).sort(), `${name}: languages`).toEqual(known)
  for (const language of KNOWN_LOCALES) expectSameShape(table[language], table.en, `${name}.${language}`)
}

describe('every interface dictionary speaks every known language', () => {
  it.each([
    ['CHROME_COPY (chrome.ts)', CHROME_COPY],
    ['LANDING_COPY (theme/landing/copy.ts)', LANDING_COPY],
    ['NUMBER_LOCALE (theme/landing/copy.ts)', NUMBER_LOCALE],
    ['LOCALE_LABELS (config.ts)', LOCALE_LABELS],
    ['LOCALE_DESCRIPTIONS (config.ts)', LOCALE_DESCRIPTIONS],
    ['OG_LOCALE (config.ts)', OG_LOCALE],
    ['HUB_TITLES (config.ts)', HUB_TITLES],
    ['OVERVIEW (config.ts)', OVERVIEW],
    ['AUTHOR_NAME (config.ts)', AUTHOR_NAME],
    ['COPY (scripts/gen-llms.mjs)', LLMS_COPY],
    ['TABLE_HEADERS (scripts/gen-facts-json.mjs)', TABLE_HEADERS],
  ] as [string, Record<string, unknown>][])('%s', (name, table) => {
    expectEveryLanguage(table, name)
  })

  it('names each language in its own script, and each Open Graph locale in its own format', () => {
    // The switcher matches the current tree by LABEL (config.ts), so two trees may not share one.
    expect(new Set(Object.values(LOCALE_LABELS)).size).toBe(KNOWN_LOCALES.length)
    expect(LOCALE_LABELS.ar).toBe('العربية')
    for (const value of Object.values(OG_LOCALE)) expect(value).toMatch(/^[a-z]{2}_[A-Z]{2}$/)
  })

  it('points the "onward" arrows of a right-to-left tree to the left', () => {
    for (const language of KNOWN_LOCALES) {
      const onward = textDirectionOf(language) === 'rtl' ? '←' : '→'
      for (const label of [CHROME_COPY[language].navCta, LANDING_COPY[language].ctaPrimary, LANDING_COPY[language].bizCtaPrimary]) {
        expect(label, `${language}: ${label}`).toContain(onward)
      }
    }
  })

  it('reads a VitePress language onto its copy, and anything else onto the root tree', () => {
    for (const language of KNOWN_LOCALES) expect(localeOf(language)).toBe(language)
    expect(localeOf('xx')).toBe('ru')
    expect(sourcesHeading('ar')).toBe(LANDING_COPY.ar.sources)
  })
})

describe('the fact card speaks every known language', () => {
  const document = buildFacts({ ...readInputs(), now: new Date('2026-09-18T12:00:00Z') })

  it('is written in exactly the registry languages', () => {
    expect([...FACT_LOCALES].sort()).toEqual(known)
  })

  it('labels, words and cites every field in each of them', () => {
    for (const [id, labels] of Object.entries(FACT_LABELS)) expectEveryLanguage(labels, `LABELS.${id}`)
    for (const [file, labels] of Object.entries(SOURCE_LABELS)) expectEveryLanguage(labels, `SOURCE_LABELS.${file}`)
    for (const fact of document.facts) {
      expectEveryLanguage(fact.labels, `${fact.id}.labels`)
      expectEveryLanguage(fact.text, `${fact.id}.text`)
    }
  })
})

// A translated interface proves neither the language nor staffing of customer
// support. Keep the documented contact without inventing a language promise.
describe('the Organization node publishes its documented support contact', () => {
  it('declares a customer support email without inferring languages from the corpus', () => {
    expect(ORGANIZATION.contactPoint).toEqual({
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: ORGANIZATION.email,
    })
  })

  it('publishes one support address, on the node and on its contact point', () => {
    expect(ORGANIZATION.email).toMatch(/^[a-z]+@darebay\.com$/)
    expect(ORGANIZATION.contactPoint.email).toBe(ORGANIZATION.email)
  })
})

describe('product links of a tree lead into the application tree it is sent to', () => {
  it('sends Arabic readers to the English application, every other tree to its own', () => {
    const expected: Record<Locale, string> = {
      ru: 'https://darebay.com',
      uk: 'https://darebay.com/ua',
      en: 'https://darebay.com/en',
      ar: 'https://darebay.com/en',
    }
    for (const language of KNOWN_LOCALES) {
      expect(productUrlForLocale(language)).toBe(language === 'ru' ? 'https://darebay.com/' : expected[language])
      expect(tasksUrlForLocale(language)).toBe(`${expected[language]}/tasks`)
      expect(businessUrlForLocale(language)).toBe(`${expected[language]}/for-business`)
    }
  })
})

describe('every declared tree is a VitePress locale in its language and direction', () => {
  const locales = siteConfig.locales ?? {}

  it('has exactly one VitePress locale per declared tree, keyed by its directory', () => {
    expect(Object.keys(locales)).toEqual(LOCALES.map((axis) => axis.vitepressKey))
  })

  it.each(LOCALES.map((axis) => [axis.language, axis] as const))('%s', (_language, axis) => {
    const locale = locales[axis.vitepressKey] as { lang?: string; dir?: string; label?: string }
    expect(locale.lang).toBe(axis.language)
    expect(locale.dir).toBe(axis.dir)
    expect(locale.label).toBe(LOCALE_LABELS[axis.language])
  })
})

// The container answers a miss with the 404 of the tree it happened in. nginx.conf is written by
// hand, so it is held here against the registry: a known language with a prefix and no location
// block would answer its misses with the Russian 404 of `location /`.
describe('the content container has a location for every known tree', () => {
  const nginx = readFileSync(new URL('../../nginx.conf', import.meta.url), 'utf8')
  const block = (opening: string) => {
    const start = nginx.indexOf(`${opening} {`)
    return start === -1 ? null : nginx.slice(start, nginx.indexOf('\n    }', start))
  }

  it.each(KNOWN_LOCALES.map((language) => [language] as const))('%s', (language) => {
    const { prefix } = knownAxisOf(language)
    const notFound = `error_page 404 /404.${language}.html;`
    expect(block(`location = /404.${language}.html`), `404.${language}.html`).toContain('internal;')
    const tree = block(`location ${prefix}/`)
    expect(tree, `location ${prefix}/`).not.toBeNull()
    expect(tree).toContain(notFound)
    expect(tree).toContain(`@slash_${language};`)
    expect(block(`location @slash_${language}`), `@slash_${language}`).toContain(notFound)
  })
})

// Encoding is a response header, not only a `<meta charset>`: a crawler or an assistant that trusts
// HTTP reads a bare `text/html` as Latin-1. Until 2026-09-21 only `/llms.txt` declared a charset
// (the directive sat inside that one location), so every page and the content sitemap went out
// without one, and the Arabic tree turned that from a nicety into a defect. It belongs at the
// `server` level, where every location inherits it; the served header itself is probed by
// url-gates `5-charset`.
describe('the content container declares UTF-8 for every text response', () => {
  const nginx = readFileSync(new URL('../../nginx.conf', import.meta.url), 'utf8')
  // Contents of `server { … }` are indented by four spaces, a location's by eight.
  const charsets = [...nginx.matchAll(/^( *)charset\s+([^;]+);/gm)].map((match) => ({
    level: match[1].length === 4 ? 'server' : 'location',
    value: match[2].trim(),
  }))

  it('sets the charset at the server level, and no location overrides it with another one', () => {
    expect(charsets).toContainEqual({ level: 'server', value: 'utf-8' })
    expect(charsets.filter(({ value }) => value !== 'utf-8')).toEqual([])
  })

  it('covers pages, the XML sitemap and llms.txt', () => {
    // nginx always processes text/html; a declared `charset_types` REPLACES the rest of its default.
    const declared = nginx.match(/^ *charset_types\s+([^;]+);/m)?.[1].trim().split(/\s+/)
    const covered = ['text/html', ...(declared ?? ['text/xml', 'text/plain', 'application/javascript'])]
    expect(covered).toEqual(expect.arrayContaining(['text/html', 'text/xml', 'text/plain']))
  })
})
