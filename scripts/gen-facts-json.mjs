#!/usr/bin/env node
//
// The machine-readable fact card: `/data/darebay-facts.json`.
//
// WHY THIS EXISTS. The public fact cards (`/o-proekte/darebay-v-tsifrakh`, `/ua/pro-proekt/...`,
// `/en/about/darebay-at-a-glance`) answer one question for people: what are DareBay's numbers, and
// when were they read. Everything that asks the same question without reading a page — a
// comparison site's importer, an assistant summarising the platform, our own future surfaces — has
// to re-derive those numbers out of prose, in three languages, and gets them subtly wrong. This
// generator publishes the same eleven fields as data, each with the file it came from and the date
// it was read, so there is one answer and it is citable.
//
// WHERE THE VALUES COME FROM. Never from this file:
//
//   * `data/product-truth.json`   — the reviewed live-backend snapshot (commissions, minimums,
//                                   the stable PPV bands and the default view threshold).
//   * `data/product-intent.json`  — founder-decided product changes. The withdrawal fee the docs
//                                   describe is the DECIDED target (0%), not the live 10%; the
//                                   resolution rule is the one `scripts/product-truth-lint.mjs`
//                                   applies in `effectiveWithdrawalFee`, replicated below because
//                                   that function is module-private there.
//   * `data/contests-snapshot.json` — the live catalogue reading written by `facts:refresh`. It
//                                   corroborates the bands (what tasks actually pay today) and is
//                                   the source of the open-task count. The BUILD never fetches:
//                                   see the header of `scripts/facts-refresh.mjs`.
//
// The only hand-written product statements are the three in `WORDING` — payout rails, platforms
// and geography have no number behind them. Everything numeric is read from the data files, so a
// product change cannot be published by editing this generator.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { productIntentIndex, readProductIntent } from './product-truth-lint.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const FACTS_SCHEMA_VERSION = 1
/** Public address. Routed to this container by `CONTENT_ROOT_FILES` in the registry. */
export const FACTS_PUBLIC_PATH = '/data/darebay-facts.json'
export const FACTS_OUTPUT_FILE = join(ROOT, 'docs', 'public', 'data', 'darebay-facts.json')
/**
 * How stale the committed catalogue snapshot may be before the build complains. A fact card whose
 * live corroboration is two months old is still honest — every value it publishes is dated — so
 * this warns and keeps building. A generator that failed here would make an unrelated content fix
 * unreleasable because nobody had run `facts:refresh` that month.
 */
export const SNAPSHOT_MAX_AGE_DAYS = 45

// ---------------------------------------------------------------------------
// The ONLY wording constants. Three product statements that are not numbers:
// which rails pay out, which platforms tasks name, and which countries are
// served. `reviewedAt` is the day they were last confirmed with the founder and
// is what their rows publish as their own date — no value below it is numeric,
// and no number may ever be typed into this block.
// ---------------------------------------------------------------------------
const WORDING = {
  reviewedAt: '2026-09-17',
  rails: {
    // Must equal `withdrawal.wizardMethods` in the reviewed snapshot; asserted in `buildFacts`,
    // so a backend rail change breaks the build instead of shipping stale copy.
    methods: ['USDT_TON_EXTERNAL_WALLET', 'TELEGRAM_STARS'],
    ru: 'USDT в сети TON, звёзды Telegram',
    uk: 'USDT у мережі TON, зірки Telegram',
    en: 'USDT on TON, Telegram Stars',
  },
  platforms: {
    ids: ['TIKTOK', 'YOUTUBE', 'INSTAGRAM'],
    ru: 'TikTok, YouTube, Instagram и другие сайты, названные в задании',
    uk: 'TikTok, YouTube, Instagram та інші сайти, названі в завданні',
    en: 'TikTok, YouTube, Instagram and other sites named in the task',
  },
  geography: {
    value: 'worldwide',
    ru: 'весь мир, без списка стран',
    uk: 'увесь світ, без списку країн',
    en: 'worldwide, no country list',
  },
  operator: 'Ruslan Bei',
}

/** Column headers of the rendered fact table, per locale. Labels, never values. */
const TABLE_HEADERS = {
  ru: ['Показатель', 'Значение', 'Источник', 'На дату'],
  uk: ['Показник', 'Значення', 'Джерело', 'Станом на'],
  en: ['Field', 'Value', 'Source', 'As of'],
}

/** Row labels. The fact NAMES a reader sees; the values next to them are computed. */
const LABELS = {
  'rate-per-1000-views': {
    ru: 'Ставка за 1000 просмотров',
    uk: 'Ставка за 1000 переглядів',
    en: 'Rate per 1,000 views',
  },
  'cap-per-clip': {
    ru: 'Потолок на один ролик',
    uk: 'Стеля на один ролик',
    en: 'Cap per clip',
  },
  'view-threshold': {
    ru: 'Порог просмотров',
    uk: 'Поріг переглядів',
    en: 'View threshold',
  },
  'contest-creation-fee': {
    ru: 'Комиссия за создание конкурса',
    uk: 'Комісія за створення конкурсу',
    en: 'Contest creation fee',
  },
  'budget-top-up-fee': {
    ru: 'Комиссия за пополнение бюджета конкурса',
    uk: 'Комісія за поповнення бюджету конкурсу',
    en: 'Contest budget top-up fee',
  },
  'store-fee': {
    ru: 'Комиссия с покупки в магазине',
    uk: 'Комісія з покупки в магазині',
    en: 'Store purchase fee',
  },
  'withdrawal-fee': {
    ru: 'Комиссия за вывод баланса',
    uk: 'Комісія за виведення балансу',
    en: 'Balance withdrawal fee',
  },
  'withdrawal-minimum': {
    ru: 'Минимальная заявка на вывод',
    uk: 'Мінімальна заявка на виведення',
    en: 'Minimum withdrawal request',
  },
  'payout-rails': {
    ru: 'Способы выплаты',
    uk: 'Способи виплати',
    en: 'Payout rails',
  },
  platforms: {
    ru: 'Площадки',
    uk: 'Майданчики',
    en: 'Platforms',
  },
  geography: {
    ru: 'География выплат',
    uk: 'Географія виплат',
    en: 'Geography of payouts',
  },
}

/** The published order. Eleven fields, the same eleven every fact card prints. */
export const FACT_IDS = Object.freeze(Object.keys(LABELS))

// ---------------------------------------------------------------------------
// Formatting. Numbers arrive from the data files and are only rendered here.
// ---------------------------------------------------------------------------

const money = (value) => `$${Number.isInteger(value) ? value : value.toFixed(2)}`
/** A rate is always printed with cents: "$1.00–$2.00" reads as money, "$1–$2" as a guess. */
const rate = (value) => `$${value.toFixed(2)}`
// English groups thousands ("1,000 views"); the Russian and Ukrainian corpus writes them bare
// ("1000 просмотров"), and the truth gate's own patterns are written for that form.
const group = (value, locale) => (locale === 'en' ? value.toLocaleString('en-US') : String(value))
const views = (value, locale) =>
  ({ ru: `${group(value, 'ru')} просмотров`, uk: `${group(value, 'uk')} переглядів`, en: `${group(value, 'en')} views` })[locale]

const dateOf = (isoTimestamp) => isoTimestamp.slice(0, 10)
const DAY_MS = 86_400_000

const percentText = (value) => ({ ru: `${value}%`, uk: `${value}%`, en: `${value}%` })

// ---------------------------------------------------------------------------
// Inputs.
// ---------------------------------------------------------------------------

export function readInputs({ root = ROOT } = {}) {
  const truth = JSON.parse(readFileSync(join(root, 'data', 'product-truth.json'), 'utf8'))
  const intent = readProductIntent(join(root, 'data', 'product-intent.json'))
  const snapshotPath = join(root, 'data', 'contests-snapshot.json')
  if (!existsSync(snapshotPath)) {
    throw new Error(
      'gen-facts-json: data/contests-snapshot.json is missing. The build never fetches; ' +
        'run `npm run facts:refresh` and commit the snapshot.'
    )
  }
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'))
  if (snapshot.schemaVersion !== 1) {
    throw new Error(`gen-facts-json: unsupported contests snapshot schemaVersion ${JSON.stringify(snapshot.schemaVersion)}`)
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(snapshot.fetchedAt || '')) {
    throw new Error('gen-facts-json: contests snapshot has no ISO fetchedAt')
  }
  return { truth, intent, snapshot }
}

/**
 * The withdrawal fee the documentation describes.
 *
 * REPLICATED, not imported: `effectiveWithdrawalFee` is module-private in
 * `scripts/product-truth-lint.mjs`, and that file is the gate — it may not grow an export just to
 * serve a generator. The rule is the same one the gate applies, and the two are kept honest by the
 * intent file itself: `validateProductIntent` fails when a `pending-product-change` record's
 * target already equals the live value, so this branch cannot silently become a no-op.
 */
export function effectiveWithdrawalFee(truth, intentIndex) {
  const record = intentIndex?.byPath?.get('withdrawal.defaultCommissionPercent')
  if (record && record.status === 'pending-product-change' && typeof record.target === 'number') {
    return { percent: record.target, intentId: record.id, decidedAt: record.decidedAt }
  }
  return { percent: truth.withdrawal.defaultCommissionPercent, intentId: null, decidedAt: null }
}

const localized = (build) => ({ ru: build('ru'), uk: build('uk'), en: build('en') })

// ---------------------------------------------------------------------------
// The document.
// ---------------------------------------------------------------------------

/** The newest reading among the inputs; a rebuild with the same inputs stamps the same date. */
function latestInput({ truth, intent, snapshot }) {
  const candidates = [truth?.verifiedAt, intent?.decidedAt, snapshot?.fetchedAt]
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
  if (candidates.length === 0) throw new Error('gen-facts-json: no dated input to stamp generatedAt')
  return new Date(Math.max(...candidates.map((date) => date.getTime())))
}

export function buildFacts({ truth, intent, snapshot, now }) {
  const intentIndex = productIntentIndex(intent)
  const rails = truth.withdrawal.wizardMethods ?? []
  if ([...rails].sort().join() !== [...WORDING.rails.methods].sort().join()) {
    throw new Error(
      `gen-facts-json: withdrawal.wizardMethods is ${JSON.stringify(rails)} but the payout-rails ` +
        `wording covers ${JSON.stringify(WORDING.rails.methods)}; update the wording with the product`
    )
  }

  // The founder-decided target band (product-intent.json#rate-band, pending) replaces the
  // reviewed edge it names, exactly as the withdrawal fee above; the live reading stays in the note.
  const cpmHighIntent = intentIndex?.byPath?.get('ppv.stable.bands.cpm.high')
  const cpmTargeted = Boolean(cpmHighIntent && cpmHighIntent.status === 'pending-product-change' && typeof cpmHighIntent.target === 'number' && cpmHighIntent.target !== truth.ppv.stable.bands.cpm.high)
  const cpm = { ...truth.ppv.stable.bands.cpm, high: cpmTargeted ? cpmHighIntent.target : truth.ppv.stable.bands.cpm.high }
  const capBand = truth.ppv.stable.bands.maxPerWork
  const threshold = truth.ppv.stable.defaultMinimumViews
  const thresholdBand = truth.ppv.stable.bands.minViewsThreshold
  const fee = effectiveWithdrawalFee(truth, intentIndex)
  const truthAsOf = truth.verifiedAt
  const liveAsOf = dateOf(snapshot.fetchedAt)
  const open = snapshot.counts.open
  const openTasks = `${open} open listed ${open === 1 ? 'task' : 'tasks'} in the live catalogue on ${liveAsOf}`
  const pay = open === 1 ? 'pays' : 'pay'

  const observedRate =
    snapshot.ppv.rateMin === null
      ? `${openTasks}: no rate published`
      : snapshot.ppv.rateMin === snapshot.ppv.rateMax
        ? `${openTasks} ${pay} ${rate(snapshot.ppv.rateMin)} per 1,000 views`
        : `${openTasks} ${pay} ${rate(snapshot.ppv.rateMin)}\u2013${rate(snapshot.ppv.rateMax)} per 1,000 views`

  const facts = [
    {
      id: 'rate-per-1000-views',
      value: { min: cpm.low, max: cpm.high },
      unit: cpm.unit,
      labels: LABELS['rate-per-1000-views'],
      text: localized((locale) => {
        const range = `${rate(cpm.low)}–${rate(cpm.high)}`
        return {
          ru: `${range} за 1000 просмотров (открытые конкурсы)`,
          uk: `${range} за 1000 переглядів (відкриті конкурси)`,
          en: `${range} per 1,000 views (open tasks)`,
        }[locale]
      }),
      source: cpmTargeted ? `product-intent.json#${cpmHighIntent.id}` : 'product-truth.json#ppv.stable.bands.cpm',
      asOf: cpmTargeted ? cpmHighIntent.decidedAt : truthAsOf,
      note: `${cpmTargeted ? `Target band decided ${cpmHighIntent.decidedAt} (product-intent.json#${cpmHighIntent.id}); the reviewed live band is ${rate(truth.ppv.stable.bands.cpm.low)}\u2013${rate(truth.ppv.stable.bands.cpm.high)}` : 'Reviewed stable band'}; ${observedRate}. A task's exact rate is printed on its card and cannot change after the start.`,
    },
    {
      id: 'cap-per-clip',
      value: capBand.high,
      unit: capBand.unit,
      labels: LABELS['cap-per-clip'],
      text: localized((locale) => ({
        ru: `до ${money(capBand.high)} на ролик`,
        uk: `до ${money(capBand.high)} на ролик`,
        en: `up to ${money(capBand.high)} per clip`,
      }[locale])),
      source: 'product-truth.json#ppv.stable.bands.maxPerWork.high',
      asOf: truthAsOf,
      note:
        `The highest cap a task may set, founder-approved in product-intent.json#rate-band; ` +
        `highest cap among ${openTasks}: ${snapshot.ppv.capMax === null ? 'none published' : money(snapshot.ppv.capMax)}. ` +
        `After the start a cap may only be raised.`,
    },
    {
      id: 'view-threshold',
      value: threshold.value,
      unit: threshold.unit,
      labels: LABELS['view-threshold'],
      text: localized((locale) => ({
        ru: `задаёт задание (по умолчанию ${views(threshold.value, 'ru')})`,
        uk: `задає завдання (за замовчуванням ${views(threshold.value, 'uk')})`,
        en: `set per task (system default ${views(threshold.value, 'en')})`,
      }[locale])),
      source: 'product-truth.json#ppv.stable.defaultMinimumViews.value',
      asOf: truthAsOf,
      note:
        `The system default a task starts from; a task may set any threshold inside the reviewed band ` +
        `${group(thresholdBand.low, 'en')}\u2013${group(thresholdBand.high, 'en')} views. Thresholds among ${openTasks}: ` +
        `${snapshot.ppv.viewThresholds.length ? snapshot.ppv.viewThresholds.join(', ') : 'none published'}.`,
    },
    {
      id: 'contest-creation-fee',
      value: truth.contest.creationCommissionPercent,
      unit: 'percent',
      labels: LABELS['contest-creation-fee'],
      text: percentText(truth.contest.creationCommissionPercent),
      source: 'product-truth.json#contest.creationCommissionPercent',
      asOf: truthAsOf,
    },
    {
      id: 'budget-top-up-fee',
      value: truth.contest.topUpCommissionPercent,
      unit: 'percent',
      labels: LABELS['budget-top-up-fee'],
      text: percentText(truth.contest.topUpCommissionPercent),
      source: 'product-truth.json#contest.topUpCommissionPercent',
      asOf: truthAsOf,
    },
    {
      id: 'store-fee',
      value: truth.store.commissionPercent,
      unit: 'percent',
      labels: LABELS['store-fee'],
      text: percentText(truth.store.commissionPercent),
      source: 'product-truth.json#store.commissionPercent',
      asOf: truthAsOf,
    },
    {
      id: 'withdrawal-fee',
      value: fee.percent,
      unit: 'percent',
      labels: LABELS['withdrawal-fee'],
      text: localized((locale) => {
        const minimum = `${truth.withdrawal.minimumGrossAmount} ${truth.withdrawal.minimumCurrency}`
        return fee.percent === 0
          ? {
              ru: `без комиссии, заявка от ${minimum}`,
              uk: `без комісії, заявка від ${minimum}`,
              en: `no fee, request from ${minimum}`,
            }[locale]
          : {
              ru: `${fee.percent}% от суммы заявки, заявка от ${minimum}`,
              uk: `${fee.percent}% від суми заявки, заявка від ${minimum}`,
              en: `${fee.percent}% of the requested amount, request from ${minimum}`,
            }[locale]
      }),
      source: fee.intentId ? `product-intent.json#${fee.intentId}` : 'product-truth.json#withdrawal.defaultCommissionPercent',
      asOf: fee.decidedAt ?? truthAsOf,
      note: fee.intentId
        ? `The target product, decided ${fee.decidedAt} and recorded as product-intent.json#${fee.intentId}. ` +
          `The live backend still charges ${truth.withdrawal.defaultCommissionPercent}% and processes withdrawals manually; ` +
          `the fee reaches 0% when that pending product change ships.`
        : `Live value; withdrawals are processed manually.`,
    },
    {
      id: 'withdrawal-minimum',
      value: truth.withdrawal.minimumGrossAmount,
      unit: truth.withdrawal.minimumCurrency,
      labels: LABELS['withdrawal-minimum'],
      text: localized(() => `${truth.withdrawal.minimumGrossAmount} ${truth.withdrawal.minimumCurrency}`),
      source: 'product-truth.json#withdrawal.minimumGrossAmount',
      asOf: truthAsOf,
      note: 'Gross amount of one withdrawal request; the team checks the payout details by hand.',
    },
    {
      id: 'payout-rails',
      value: [...rails],
      labels: LABELS['payout-rails'],
      text: { ru: WORDING.rails.ru, uk: WORDING.rails.uk, en: WORDING.rails.en },
      source: 'product-truth.json#withdrawal.wizardMethods',
      asOf: truthAsOf,
      note: 'Balance withdrawal rails. A single task may additionally award a card payout, a bank transfer or a gift.',
    },
    {
      id: 'platforms',
      value: [...WORDING.platforms.ids],
      labels: LABELS.platforms,
      text: { ru: WORDING.platforms.ru, uk: WORDING.platforms.uk, en: WORDING.platforms.en },
      source: 'gen-facts-json.mjs#WORDING.platforms',
      asOf: WORDING.reviewedAt,
      note: 'Where a clip may be published; every task names its own platforms on the card.',
    },
    {
      id: 'geography',
      value: WORDING.geography.value,
      labels: LABELS.geography,
      text: { ru: WORDING.geography.ru, uk: WORDING.geography.uk, en: WORDING.geography.en },
      source: 'gen-facts-json.mjs#WORDING.geography',
      asOf: WORDING.reviewedAt,
      note: 'No exclusion list: clippers from any country are paid the same way.',
    },
  ]

  if (facts.length !== FACT_IDS.length || facts.some((fact, index) => fact.id !== FACT_IDS[index])) {
    throw new Error('gen-facts-json: the published facts drifted from FACT_IDS')
  }

  return {
    schemaVersion: FACTS_SCHEMA_VERSION,
    // Deterministic by default: the newest input timestamp, not the wall clock, so a rebuild with
    // unchanged inputs writes the same file and never dirties the working tree (`prebuild`).
    generatedAt: (now ?? latestInput({ truth, intent, snapshot })).toISOString(),
    url: `https://darebay.com${FACTS_PUBLIC_PATH}`,
    operator: WORDING.operator,
    sources: {
      productTruth: { file: 'data/product-truth.json', verifiedAt: truthAsOf },
      productIntent: intent ? { file: 'data/product-intent.json', decidedAt: intent.decidedAt } : null,
      liveCatalogue: {
        file: 'data/contests-snapshot.json',
        endpoint: snapshot.source.endpoint,
        fetchedAt: snapshot.fetchedAt,
        openTasks: open,
      },
    },
    facts,
  }
}

/** Snapshot-staleness findings. They are printed, never thrown: see SNAPSHOT_MAX_AGE_DAYS. */
export function snapshotWarnings(snapshot, now = new Date()) {
  const ageDays = Math.floor((now.getTime() - Date.parse(snapshot.fetchedAt)) / DAY_MS)
  if (ageDays <= SNAPSHOT_MAX_AGE_DAYS) return []
  return [
    `contests snapshot is ${ageDays} days old (limit ${SNAPSHOT_MAX_AGE_DAYS}); run \`npm run facts:refresh\` ` +
      'and commit data/contests-snapshot.json — the fact card still builds from the committed reading.',
  ]
}

// ---------------------------------------------------------------------------
// The same eleven rows as a Markdown table, so a page and the JSON cannot drift.
// ---------------------------------------------------------------------------

const cell = (value) => String(value).replaceAll('|', '\\|')

// The page shows a reader where a number comes from; the JSON keeps the machine reference
// (`fact.source`). A file path and a JSON pointer mean nothing to a reader, so the table
// names the kind of source instead and leaves the exact pointer to the JSON copy.
const SOURCE_LABELS = {
  'product-truth.json': { ru: 'правила платформы', uk: 'правила платформи', en: 'platform rules' },
  'product-intent.json': { ru: 'решение по продукту', uk: 'рішення щодо продукту', en: 'product decision' },
  'gen-facts-json.mjs': { ru: 'условия заданий', uk: 'умови завдань', en: 'task terms' },
  'contests-snapshot.json': { ru: 'живой каталог', uk: 'живий каталог', en: 'live catalogue' },
}

export function sourceLabel(source, locale) {
  const file = String(source).split('#')[0]
  const labels = SOURCE_LABELS[file]
  if (!labels) throw new Error(`gen-facts-json: no reader label for source ${source}`)
  return labels[locale]
}

export function renderTable(document, locale) {
  const headers = TABLE_HEADERS[locale]
  if (!headers) throw new Error(`gen-facts-json: no table headers for locale ${locale}`)
  const rows = document.facts.map((fact) =>
    `| ${[cell(fact.labels[locale]), cell(fact.text[locale]), cell(sourceLabel(fact.source, locale)), cell(fact.asOf)].join(' | ')} |`
  )
  return [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows].join('\n')
}

const main = () => {
  const { truth, intent, snapshot } = readInputs()
  const document = buildFacts({ truth, intent, snapshot })
  for (const warning of snapshotWarnings(snapshot)) console.warn(`gen-facts-json: ${warning}`)
  mkdirSync(dirname(FACTS_OUTPUT_FILE), { recursive: true })
  writeFileSync(FACTS_OUTPUT_FILE, `${JSON.stringify(document, null, 2)}\n`)
  console.log(
    `facts json: ${document.facts.length} fields -> ${FACTS_PUBLIC_PATH} ` +
      `(truth ${truth.verifiedAt}, catalogue ${dateOf(snapshot.fetchedAt)})`
  )
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main()
