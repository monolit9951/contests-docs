import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  FACT_IDS,
  FACT_LOCALES,
  FACTS_OUTPUT_FILE,
  FACTS_PUBLIC_PATH,
  SNAPSHOT_MAX_AGE_DAYS,
  buildFacts,
  readInputs,
  renderTable,
  snapshotWarnings,
} from './gen-facts-json.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const UA_PAGE = join(ROOT, 'docs', 'ua', 'pro-proekt', 'darebay-u-tsyfrakh.md')

const inputs = readInputs({ root: ROOT })
// `now` must not precede any input: the founder decision of 2026-09-20 dates the rate band, the catalogue reading is the same day.
const document = buildFacts({ ...inputs, now: new Date('2026-09-20T23:00:00Z') })
const byId = new Map(document.facts.map((fact) => [fact.id, fact]))
const uaPage = readFileSync(UA_PAGE, 'utf8')

describe('machine-readable fact card', () => {
  it('publishes the eleven public fields, in order', () => {
    expect(document.facts.map((fact) => fact.id)).toEqual([...FACT_IDS])
    expect(FACT_IDS).toHaveLength(11)
    expect(document.schemaVersion).toBe(1)
    expect(document.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(document.operator).toBe('Ruslan')
  })

  it('gives every field a source, a reading date and a label in every language', () => {
    for (const fact of document.facts) {
      expect(fact.source, `${fact.id}.source`).toMatch(/\S/)
      expect(fact.asOf, `${fact.id}.asOf`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // A date in the future would mean the card is quoting a reading nobody has taken.
      expect(Date.parse(fact.asOf), `${fact.id}.asOf`).toBeLessThanOrEqual(Date.parse(document.generatedAt))
      for (const locale of FACT_LOCALES) {
        expect(fact.labels[locale], `${fact.id}.labels.${locale}`).toMatch(/\S/)
        expect(fact.text[locale], `${fact.id}.text.${locale}`).toMatch(/\S/)
      }
      expect(fact.value, `${fact.id}.value`).not.toBeUndefined()
    }
  })

  /**
   * The whole point of the generator: a number on the card is a number in a data file. A value
   * typed into the generator would pass every other check here and be wrong the day the product
   * moved, which is exactly how the public pages used to go stale.
   */
  it('reads every number from the committed data files', () => {
    const { truth, intent, snapshot } = inputs
    // The top of the band follows the founder-decided target while product-intent.json#rate-band is
    // pending (2026-09-20); the floor is the reviewed live value.
    const rateBand = (intent?.claims ?? []).find((claim) => claim.id === 'rate-band')
    const targetTop = rateBand && rateBand.status === 'pending-product-change' && Array.isArray(rateBand.target)
      ? rateBand.target[rateBand.liveTruth.indexOf('ppv.stable.bands.cpm.high')]
      : truth.ppv.stable.bands.cpm.high
    expect(byId.get('rate-per-1000-views').value).toEqual({
      min: truth.ppv.stable.bands.cpm.low,
      max: targetTop,
    })
    expect(byId.get('rate-per-1000-views').source).toBe(
      targetTop === truth.ppv.stable.bands.cpm.high ? 'product-truth.json#ppv.stable.bands.cpm' : 'product-intent.json#rate-band'
    )
    expect(byId.get('cap-per-clip').value).toBe(truth.ppv.stable.bands.maxPerWork.high)
    expect(byId.get('view-threshold').value).toBe(truth.ppv.stable.defaultMinimumViews.value)
    expect(byId.get('contest-creation-fee').value).toBe(truth.contest.creationCommissionPercent)
    expect(byId.get('budget-top-up-fee').value).toBe(truth.contest.topUpCommissionPercent)
    expect(byId.get('store-fee').value).toBe(truth.store.commissionPercent)
    expect(byId.get('withdrawal-minimum').value).toBe(truth.withdrawal.minimumGrossAmount)
    expect(byId.get('withdrawal-minimum').unit).toBe(truth.withdrawal.minimumCurrency)
    expect(byId.get('payout-rails').value).toEqual(truth.withdrawal.wizardMethods)
    // The snapshot is corroboration, not a second source of truth: it must be cited, and nothing counted in it is published.
    expect(document.sources.liveCatalogue.fetchedAt).toBe(snapshot.fetchedAt)
    expect(document.sources.productIntent.decidedAt).toBe(intent.decidedAt)
  })

  /**
   * The withdrawal fee follows the same resolution the truth gate applies: a pending decided
   * change in the intent file wins, otherwise the live value stands. Since the founder kept the
   * 10% fee on 2026-09-18 there is no such record, so the card publishes the live fee with its
   * minimum request.
   */
  it('publishes the effective withdrawal fee', () => {
    const { truth, intent } = inputs
    const record = intent?.claims?.find((claim) => claim.id === 'withdrawal-free')
    const fee = byId.get('withdrawal-fee')
    if (record && record.status === 'pending-product-change') {
      expect(fee.value).toBe(record.target)
      expect(fee.source).toBe('product-intent.json#withdrawal-free')
    } else {
      expect(fee.value).toBe(truth.withdrawal.defaultCommissionPercent)
      expect(fee.source).toBe('product-truth.json#withdrawal.defaultCommissionPercent')
      expect(fee.text.ru).toBe(`${truth.withdrawal.defaultCommissionPercent}% от суммы заявки, заявка от 10 USDT`)
      expect(fee.text.uk).toBe(`${truth.withdrawal.defaultCommissionPercent}% від суми заявки, заявка від 10 USDT`)
      expect(fee.text.en).toBe(`${truth.withdrawal.defaultCommissionPercent}% of the requested amount, request from 10 USDT`)
    }
  })

  it('warns about a stale catalogue snapshot but still builds', () => {
    const { truth, intent, snapshot } = inputs
    const fresh = new Date(Date.parse(snapshot.fetchedAt) + SNAPSHOT_MAX_AGE_DAYS * 86_400_000)
    const stale = new Date(Date.parse(snapshot.fetchedAt) + (SNAPSHOT_MAX_AGE_DAYS + 1) * 86_400_000)
    expect(snapshotWarnings(snapshot, fresh)).toEqual([])
    expect(snapshotWarnings(snapshot, stale)).toHaveLength(1)
    expect(snapshotWarnings(snapshot, stale)[0]).toContain('facts:refresh')
    expect(buildFacts({ truth, intent, snapshot, now: stale }).facts).toHaveLength(11)
  })

  it('keeps the committed artifact in step with the data files', () => {
    const committed = JSON.parse(readFileSync(FACTS_OUTPUT_FILE, 'utf8'))
    // `generatedAt` is the only field that legitimately differs between two runs of the same data.
    expect({ ...committed, generatedAt: null }).toEqual({ ...document, generatedAt: null })
  })
})

describe('the Ukrainian fact card prints exactly what the JSON publishes', () => {
  it('carries the generated table verbatim', () => {
    // Not a field-by-field comparison: the whole rendered block. A row edited by hand on the page
    // — a rounded number, a tidied label — is the drift this parity check exists to catch.
    expect(uaPage).toContain(renderTable(document, 'uk'))
  })

  it('names the machine-readable copy', () => {
    expect(uaPage).toContain(`](${FACTS_PUBLIC_PATH})`)
  })

  it('keeps the search snippet inside its budget and the facts anchor alive', () => {
    const description = /^description:\s*"?(.+?)"?\s*$/m.exec(uaPage)[1]
    expect(description.length).toBeLessThanOrEqual(160)
    // The hero's secondary button jumps to `#facts`; the dist gate `anchor-target` fails on a
    // dead jump, so the heading has to keep carrying that id explicitly.
    expect(uaPage).toContain('{#facts}')
  })
})

describe('routing of the published JSON', () => {
  it('is declared in the registry and routed by the generated host snippet', () => {
    const registry = readFileSync(join(ROOT, 'docs', '.vitepress', 'registry.ts'), 'utf8')
    const rootFiles = /export const CONTENT_ROOT_FILES: readonly string\[\] = \[([\s\S]*?)\]/.exec(registry)[1]
    expect(rootFiles).toContain(`'${FACTS_PUBLIC_PATH}'`)

    const snippet = execFileSync(
      'node',
      ['--experimental-strip-types', '--no-warnings', join(ROOT, 'scripts', 'gen-host-nginx.mjs')],
      { encoding: 'utf8' }
    )
    expect(snippet).toContain(`location = ${FACTS_PUBLIC_PATH} {`)
  })

  it('is published as a public file, so no sitemap can list it', () => {
    // Sitemap entries come from the semantic registry (`docs/content-pages.json`). The artifact
    // lives under `docs/public/`, which VitePress copies verbatim and never registers as a page.
    expect(FACTS_OUTPUT_FILE.replaceAll('\\', '/')).toContain('/docs/public/data/darebay-facts.json')
    const manifest = readFileSync(join(ROOT, 'docs', 'content-pages.json'), 'utf8')
    expect(manifest).not.toContain('darebay-facts')
  })
})

describe('the English fact card prints exactly what the JSON publishes', () => {
  const enPage = readFileSync(join(ROOT, 'docs', 'en', 'about', 'darebay-at-a-glance.md'), 'utf8')

  it('carries the generated table verbatim', () => {
    expect(enPage).toContain(renderTable(document, 'en'))
  })

  it('names the machine-readable copy and keeps the facts anchor alive', () => {
    expect(enPage).toContain(`](${FACTS_PUBLIC_PATH})`)
    expect(enPage).toContain('{#facts}')
  })

  it('keeps the search snippet inside its budget', () => {
    const description = /^description:\s*"?(.+?)"?\s*$/m.exec(enPage)[1]
    expect(description.length).toBeLessThanOrEqual(160)
  })
})

describe('the Russian fact card prints exactly what the JSON publishes', () => {
  const ruPage = readFileSync(join(ROOT, 'docs', 'o-proekte', 'darebay-v-tsifrakh.md'), 'utf8')

  it('carries the generated table verbatim', () => {
    expect(ruPage).toContain(renderTable(document, 'ru'))
  })

  it('names the machine-readable copy and keeps the facts anchor alive', () => {
    expect(ruPage).toContain(`](${FACTS_PUBLIC_PATH})`)
    expect(ruPage).toContain('{#facts}')
  })

  it('keeps the search snippet inside its budget', () => {
    const description = /^description:\s*"?(.+?)"?\s*$/m.exec(ruPage)[1]
    expect(description.length).toBeLessThanOrEqual(160)
  })
})

// Every translation of the fact card the manifest declares, whatever the language: the three above
// by name, and the Arabic one (or any later one) from the day its slug is declared. Read through the
// registry, so the check follows the page to its address instead of a path written here.
const registry = await import('../docs/.vitepress/registry.ts')

describe('every declared fact card prints exactly what the JSON publishes', () => {
  const { PAGES, localesOf, sourceFile } = registry
  const card = PAGES.find((page) => page.id === 'darebay-at-a-glance')

  it.each(localesOf(card).map((locale) => [locale]))('%s', (locale) => {
    const page = readFileSync(join(ROOT, 'docs', sourceFile(card, locale)), 'utf8')
    expect(page).toContain(renderTable(document, locale))
    expect(page).toContain(`](${FACTS_PUBLIC_PATH})`)
    expect(page).toContain('{#facts}')
  })

  it('renders the Arabic table with Arabic headers and Latin digits, ready for its page', () => {
    const table = renderTable(document, 'ar')
    expect(table.split('\n')[0]).toBe('| البند | القيمة | المصدر | بتاريخ |')
    expect(table).toContain('| 10 USDT |')
    expect(table).not.toMatch(/[\u0660-\u0669]/)
  })
})
