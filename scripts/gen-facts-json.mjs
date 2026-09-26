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
//   * `data/contests-snapshot.json` — the live catalogue reading written by `facts:refresh`. It is
//                                   cited under `sources.liveCatalogue` and dates `generatedAt`;
//                                   no field or note quotes its task count or rates, because the
//                                   founder retired task counts and today's rates from DareBay's
//                                   copy (2026-09-25). The BUILD never fetches: see the header of
//                                   `scripts/facts-refresh.mjs`.
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
    ar: 'USDT على شبكة TON، ونجوم Telegram',
  },
  platforms: {
    ids: ['TIKTOK', 'YOUTUBE', 'INSTAGRAM'],
    ru: 'TikTok, YouTube, Instagram и другие сайты, названные в задании',
    uk: 'TikTok, YouTube, Instagram та інші сайти, названі в завданні',
    en: 'TikTok, YouTube, Instagram and other sites named in the task',
    ar: 'TikTok وYouTube وInstagram ومواقع أخرى تحددها المهمة',
  },
  geography: {
    value: 'no-country-list',
    ru: 'списка стран нет; не допускаются только люди из санкционных списков',
    uk: 'списку країн немає; не допускаються лише люди із санкційних списків',
    en: 'no country list; only people on sanctions lists are barred',
    ar: 'لا توجد قائمة دول؛ يُستثنى فقط الأشخاص المدرجون في قوائم العقوبات',
  },
  operator: 'Ruslan',
}

/**
 * The languages every label and text below is written in: every language the docs registry KNOWS
 * (`KNOWN_LOCALES` in docs/.vitepress/registry.ts), including one whose tree is not live yet, so the
 * day its fact card is translated the table it has to carry already exists. A plain list rather than
 * an import: this generator runs under plain `node`, without TypeScript stripping. The test suite
 * fails when the two lists part.
 */
export const FACT_LOCALES = Object.freeze(['ru', 'uk', 'en', 'ar'])

/** Column headers of the rendered fact table, per locale. Labels, never values. */
export const TABLE_HEADERS = {
  ru: ['Показатель', 'Значение', 'Источник', 'На дату'],
  uk: ['Показник', 'Значення', 'Джерело', 'Станом на'],
  en: ['Field', 'Value', 'Source', 'As of'],
  ar: ['البند', 'القيمة', 'المصدر', 'بتاريخ'],
}

/** Row labels. The fact NAMES a reader sees; the values next to them are computed. */
const LABELS = {
  'rate-per-1000-views': {
    ru: 'Ставка за 1000 просмотров',
    uk: 'Ставка за 1000 переглядів',
    en: 'Rate per 1,000 views',
    ar: 'السعر لكل 1,000 مشاهدة',
  },
  'cap-per-clip': {
    ru: 'Потолок на один ролик',
    uk: 'Стеля на один ролик',
    en: 'Cap per clip',
    ar: 'الحد الأقصى لكل مقطع',
  },
  'view-threshold': {
    ru: 'Порог просмотров',
    uk: 'Поріг переглядів',
    en: 'View threshold',
    ar: 'حد المشاهدات',
  },
  'contest-creation-fee': {
    ru: 'Комиссия за создание конкурса',
    uk: 'Комісія за створення конкурсу',
    en: 'Contest creation fee',
    ar: 'عمولة إنشاء المسابقة',
  },
  'budget-top-up-fee': {
    ru: 'Комиссия за пополнение бюджета конкурса',
    uk: 'Комісія за поповнення бюджету конкурсу',
    en: 'Contest budget top-up fee',
    ar: 'عمولة شحن ميزانية المسابقة',
  },
  'store-fee': {
    ru: 'Комиссия с покупки в магазине',
    uk: 'Комісія з покупки в магазині',
    en: 'Store purchase fee',
    ar: 'عمولة الشراء من المتجر',
  },
  'withdrawal-fee': {
    ru: 'Комиссия за вывод баланса',
    uk: 'Комісія за виведення балансу',
    en: 'Balance withdrawal fee',
    ar: 'عمولة سحب الرصيد',
  },
  'withdrawal-minimum': {
    ru: 'Минимальная заявка на вывод',
    uk: 'Мінімальна заявка на виведення',
    en: 'Minimum withdrawal request',
    ar: 'الحد الأدنى لطلب السحب',
  },
  'payout-rails': {
    ru: 'Способы выплаты',
    uk: 'Способи виплати',
    en: 'Payout rails',
    ar: 'طرق الدفع',
  },
  platforms: {
    ru: 'Площадки',
    uk: 'Майданчики',
    en: 'Platforms',
    ar: 'المنصات',
  },
  geography: {
    ru: 'География выплат',
    uk: 'Географія виплат',
    en: 'Geography of payouts',
    ar: 'جغرافيا الدفع',
  },
}

/** The published order. Eleven fields, the same eleven every fact card prints. */
export const FACT_IDS = Object.freeze(Object.keys(LABELS))
export { LABELS }

// ---------------------------------------------------------------------------
// Formatting. Numbers arrive from the data files and are only rendered here.
// ---------------------------------------------------------------------------

const money = (value) => `$${Number.isInteger(value) ? value : value.toFixed(2)}`
/** A rate is always printed with cents: "$1.00–$2.00" reads as money, "$1–$2" as a guess. */
const rate = (value) => `$${value.toFixed(2)}`
// English groups thousands ("1,000 views"); the Russian and Ukrainian corpus writes them bare
// ("1000 просмотров"), and the truth gate's own patterns are written for that form. Arabic is
// written with Latin digits and groups them the English way ("1,000 مشاهدة"), like the money
// ranges next to it.
const group = (value, locale) => (locale === 'en' || locale === 'ar' ? value.toLocaleString('en-US') : String(value))
const views = (value, locale) =>
  ({
    ru: `${group(value, 'ru')} просмотров`,
    uk: `${group(value, 'uk')} переглядів`,
    en: `${group(value, 'en')} views`,
    ar: `${group(value, 'ar')} مشاهدة`,
  })[locale]

const dateOf = (isoTimestamp) => isoTimestamp.slice(0, 10)
const DAY_MS = 86_400_000

const percentText = (value) => ({ ru: `${value}%`, uk: `${value}%`, en: `${value}%`, ar: `${value}%` })

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

const localized = (build) => Object.fromEntries(FACT_LOCALES.map((locale) => [locale, build(locale)]))

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
  // reviewed edge it names, exactly as the withdrawal fee above; the note names the decision.
  const cpmHighIntent = intentIndex?.byPath?.get('ppv.stable.bands.cpm.high')
  const cpmTargeted = Boolean(cpmHighIntent && cpmHighIntent.status === 'pending-product-change' && typeof cpmHighIntent.target === 'number' && cpmHighIntent.target !== truth.ppv.stable.bands.cpm.high)
  const cpm = { ...truth.ppv.stable.bands.cpm, high: cpmTargeted ? cpmHighIntent.target : truth.ppv.stable.bands.cpm.high }
  const capBand = truth.ppv.stable.bands.maxPerWork
  const threshold = truth.ppv.stable.defaultMinimumViews
  const thresholdBand = truth.ppv.stable.bands.minViewsThreshold
  const fee = effectiveWithdrawalFee(truth, intentIndex)
  const truthAsOf = truth.verifiedAt

  const facts = [
    {
      id: 'rate-per-1000-views',
      value: { min: cpm.low, max: cpm.high },
      unit: cpm.unit,
      labels: LABELS['rate-per-1000-views'],
      text: localized((locale) => {
        const range = `${rate(cpm.low)}–${rate(cpm.high)}`
        return {
          ru: `${range} за 1000 просмотров, ставку задаёт каждое задание`,
          uk: `${range} за 1000 переглядів, ставку задає кожне завдання`,
          en: `${range} per 1,000 views, set by each task`,
          ar: `${range} لكل 1,000 مشاهدة، تحدده كل مهمة`,
        }[locale]
      }),
      source: cpmTargeted ? `product-intent.json#${cpmHighIntent.id}` : 'product-truth.json#ppv.stable.bands.cpm',
      asOf: cpmTargeted ? cpmHighIntent.decidedAt : truthAsOf,
      note: `${cpmTargeted ? `Band decided ${cpmHighIntent.decidedAt} (product-intent.json#${cpmHighIntent.id})` : 'Reviewed stable band'}. Each task sets its own rate inside it; the exact rate is printed on the task card and cannot change after the start.`,
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
        ar: `حتى ${money(capBand.high)} لكل مقطع`,
      }[locale])),
      source: 'product-truth.json#ppv.stable.bands.maxPerWork.high',
      asOf: truthAsOf,
      note:
        `The highest cap a task may set, founder-approved in product-intent.json#rate-band; ` +
        `each task sets its own cap, and a task may set none. After the start a cap may only be raised.`,
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
        ar: `تحدده المهمة (الافتراضي في النظام ${views(threshold.value, 'ar')})`,
      }[locale])),
      source: 'product-truth.json#ppv.stable.defaultMinimumViews.value',
      asOf: truthAsOf,
      note:
        `The system default a task starts from; a task may set any threshold inside the reviewed band ` +
        `${group(thresholdBand.low, 'en')}\u2013${group(thresholdBand.high, 'en')} views.`,
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
              ar: `دون عمولة، والطلب من ${minimum}`,
            }[locale]
          : {
              ru: `${fee.percent}% от суммы заявки, заявка от ${minimum}`,
              uk: `${fee.percent}% від суми заявки, заявка від ${minimum}`,
              en: `${fee.percent}% of the requested amount, request from ${minimum}`,
              ar: `${fee.percent}% من المبلغ المطلوب، والطلب من ${minimum}`,
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
      text: localized((locale) => WORDING.rails[locale]),
      source: 'product-truth.json#withdrawal.wizardMethods',
      asOf: truthAsOf,
      note: 'USDT on TON, or the payout received in Telegram Stars. A single task may additionally award a card payout, a bank transfer or a gift.',
    },
    {
      id: 'platforms',
      value: [...WORDING.platforms.ids],
      labels: LABELS.platforms,
      text: localized((locale) => WORDING.platforms[locale]),
      source: 'gen-facts-json.mjs#WORDING.platforms',
      asOf: WORDING.reviewedAt,
      note: 'Where a clip may be published; every task names its own platforms on the card.',
    },
    {
      id: 'geography',
      value: WORDING.geography.value,
      labels: LABELS.geography,
      text: localized((locale) => WORDING.geography[locale]),
      source: 'gen-facts-json.mjs#WORDING.geography',
      asOf: WORDING.reviewedAt,
      note:
        'No country list: only people on UK, EU or UN sanctions lists are barred. The balance leaves only as ' +
        'USDT on TON, so where the law closes crypto to residents (Bangladesh, Nepal, Egypt, Algeria and Iraq, ' +
        'for example) there is no lawful cash-out route.',
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
export const SOURCE_LABELS = {
  'product-truth.json': { ru: 'правила платформы', uk: 'правила платформи', en: 'platform rules', ar: 'قواعد المنصة' },
  'product-intent.json': { ru: 'решение по продукту', uk: 'рішення щодо продукту', en: 'product decision', ar: 'قرار المنتج' },
  'gen-facts-json.mjs': { ru: 'условия заданий', uk: 'умови завдань', en: 'task terms', ar: 'شروط المهام' },
  'contests-snapshot.json': { ru: 'живой каталог', uk: 'живий каталог', en: 'live catalogue', ar: 'قائمة المهام الحالية' },
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
