import { describe, expect, it } from 'vitest'

import { FACT_IDS, FACTS_PUBLIC_PATH, buildFacts, readInputs } from './gen-facts-json.mjs'
import { COPY, FACT_CARD_PAGE_ID, KEY_FACT_IDS, PAGES_MANIFEST_PUBLIC_PATH, renderLlms } from './gen-llms.mjs'

// llms.txt says two things about the product before it lists pages: the key fields of the fact
// card, and where the same facts live as data. Both are held here against `buildFacts` (an
// independent call, not the generator's own), because the file is fetched by assistants that quote
// it without opening a page: a number typed into the generator, or a tree that silently lost its
// block, would be published with nothing else in the repository noticing.

const { CONTENT_ROOT_FILES, LOCALES, ORIGIN, PAGES, localesOf, pagePath } = await import('../docs/.vitepress/registry.ts')

const llms = renderLlms()
const facts = new Map(buildFacts(readInputs()).facts.map((fact) => [fact.id, fact]))
const declared = LOCALES.map((axis) => [axis.language])

/** The `## <language>` section of one declared tree, up to the next tree. */
const sectionOf = (locale) => {
  const start = llms.indexOf(`\n## ${COPY[locale].label}\n`)
  if (start === -1) return null
  const next = llms.indexOf('\n## ', start + 1)
  return llms.slice(start + 1, next === -1 ? undefined : next)
}

/** Every non-empty line under one `### heading`, up to the next heading. Null when it is absent. */
const blockOf = (section, heading) => {
  const lines = section.split('\n')
  const at = lines.indexOf(`### ${heading}`)
  if (at === -1) return null
  const end = lines.findIndex((line, index) => index > at && line.startsWith('#'))
  return lines.slice(at + 1, end === -1 ? undefined : end).filter((line) => line.trim() !== '')
}

/** "1,000" and "1000" are the same number; "$1.00" is 1. Arabic is written with Latin digits. */
const numbersIn = (text) => [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((match) => Number(match[0].replaceAll(',', '')))

/**
 * The numbers a key-fact line may carry, read off the MACHINE side of the same fact (`value`,
 * `unit`), never off its text: the line is the text, so comparing it with itself proves nothing.
 */
const valuesOf = (id) => {
  const fact = facts.get(id)
  if (id === 'rate-per-1000-views') return [Number(/per_(\d+)_views/.exec(fact.unit)[1]), fact.value.min, fact.value.max]
  // The fee line also names the smallest request it applies to.
  // A 0% fee is printed in words (gen-facts-json.mjs), so it puts no digit on the line.
  if (id === 'withdrawal-fee') return [...(fact.value === 0 ? [] : [fact.value]), facts.get('withdrawal-minimum').value]
  return typeof fact.value === 'number' ? [fact.value] : []
}

describe('llms.txt key facts', () => {
  it('names fields of the fact card, in its order, and stays a short block', () => {
    expect(KEY_FACT_IDS.length).toBeGreaterThanOrEqual(8)
    expect(KEY_FACT_IDS.length).toBeLessThanOrEqual(10)
    expect(FACT_IDS.filter((id) => KEY_FACT_IDS.includes(id))).toEqual([...KEY_FACT_IDS])
  })

  it.each(declared)('%s: one block, ahead of the page lists', (locale) => {
    const section = sectionOf(locale)
    expect(section, `## ${COPY[locale].label}`).not.toBeNull()
    const headings = section.split('\n').filter((line) => line.startsWith('### '))
    expect(headings.slice(0, 2)).toEqual([`### ${COPY[locale].keyFacts}`, `### ${COPY[locale].machineSources}`])
    expect(headings.filter((line) => line === `### ${COPY[locale].keyFacts}`)).toHaveLength(1)
    // A tree with a block and no pages under it would be a section about nothing.
    expect(headings.length).toBeGreaterThan(2)
  })

  // The WHOLE block, not only its bullets: a sentence added under the heading (a note, an
  // instruction to the assistant) is a public claim nobody reviewed, and fails here.
  it.each(declared)('%s: every line is a label and a text of buildFacts, and nothing else', (locale) => {
    const expected = KEY_FACT_IDS.map((id) => `- ${facts.get(id).labels[locale]}: ${facts.get(id).text[locale]}`)
    expect(blockOf(sectionOf(locale), COPY[locale].keyFacts)).toEqual(expected)
  })

  it.each(declared)('%s: every number equals the value buildFacts publishes', (locale) => {
    const lines = blockOf(sectionOf(locale), COPY[locale].keyFacts)
    KEY_FACT_IDS.forEach((id, index) => {
      expect(new Set(numbersIn(lines[index])), `${locale}: ${lines[index]}`).toEqual(new Set(valuesOf(id)))
    })
  })
})

describe('llms.txt machine-readable sources', () => {
  it('links only to addresses the host routes to this container', () => {
    expect(CONTENT_ROOT_FILES).toContain(FACTS_PUBLIC_PATH)
    expect(CONTENT_ROOT_FILES).toContain(PAGES_MANIFEST_PUBLIC_PATH)
  })

  it.each(declared)('%s: the fact JSON, the page registry and the fact card of that tree', (locale) => {
    const copy = COPY[locale]
    const card = PAGES.find((page) => page.id === FACT_CARD_PAGE_ID)
    expect(card, FACT_CARD_PAGE_ID).toBeDefined()
    const expected = [
      `- [${copy.factsJson.title}](${ORIGIN}${FACTS_PUBLIC_PATH}): ${copy.factsJson.note}`,
      `- [${copy.pagesJson.title}](${ORIGIN}${PAGES_MANIFEST_PUBLIC_PATH}): ${copy.pagesJson.note}`,
    ]
    const block = blockOf(sectionOf(locale), copy.machineSources)
    expect(block.slice(0, 2)).toEqual(expected)
    if (localesOf(card).includes(locale)) {
      expect(block).toHaveLength(3)
      expect(block[2].startsWith('- [')).toBe(true)
      expect(block[2].endsWith(`](${ORIGIN}${pagePath(card, locale)}): ${copy.factCardNote}`)).toBe(true)
    } else {
      expect(block).toHaveLength(2)
    }
  })
})

describe('llms.txt page index', () => {
  it('still lists every localized address of the registry', () => {
    const missing = PAGES.flatMap((page) => localesOf(page).map((locale) => ORIGIN + pagePath(page, locale))).filter(
      (url) => !llms.includes(`](${url})`)
    )
    expect(missing).toEqual([])
  })
})
