// The tools catalogue of the tools hub: `data/tools.json`, checked and turned into what a page shows.
//
// WHERE THE DATA GOES. The catalogue is page data, not theme data. A VitePress data loader per
// language (`tools.ru.data.ts`, `tools.en.data.ts`, through toolsLoader.ts) reads the JSON at build
// time; the page that shows the catalogue imports its language's loader and the component in its own
// `<script setup>` and passes the cards in: `<LTools :data="tools" />` (LTools.vue). So the catalogue
// ships in chunks only that page loads, one language each, never in the theme chunk every page
// downloads (`platforms.json` is the counter-example: ~75 KB of
// it rides along on all ~240 pages). What only the editors need never ships at all: `affiliate` (the
// partner programmes), `sources` (field-level provenance) and the raw source of a DareBay card.
//
// WHAT A CARD SAYS. A third-party tool's card prints only facts read off the tool's own pages, each
// dated: the price links to the page it was read on, "as of" the day it was read. Cards are grouped
// by the stage of the work they serve (`categories`, in the order of the work) and sorted A to Z
// inside a group: no ranking, and DareBay is never placed first inside one. DareBay's own tools sit
// in a separate, labelled group above the others and are only ever `live`: nothing "coming soon".
//
// HOW A CARD READS. Short enough to scan on a phone: the name, one line of what the tool does, the
// price and its day, and the links. The free tier and how to pay from Russia sit one tap away in
// the card's own disclosure (`<details>`, no JavaScript): in the page's HTML, for readers and search
// alike, but not in the way of the next card. A card whose data carries a short price
// (`priceBadge`, a few words) shows it as a badge beside the name and moves the full price into
// the disclosure; a payment class (`pay`) adds a one-word label of how to pay.
//
// Checked twice: `validateToolsCatalog` fails the build on a malformed entry (the loader calls it),
// and `tools.test.ts` holds the schema, the copy rules and the product-truth lint over every string.
// Extensions spelled out, as in links.ts: scripts read this file under plain Node too.
import { ctaAnchor, isCtaKey, sitePathOf, sourceAnchor, type CtaKey, type SourceAnchor } from './links.ts'
import { PAGES, localesOf, pagePath, type Locale } from './registry.ts'
import { ART, ICON_NAMES } from './theme/landing/art.ts'

/** The languages the catalogue is written in. A tool may be listed in a subset (`locales`). */
export const TOOL_LOCALES = ['ru', 'en'] as const
export type ToolLocale = (typeof TOOL_LOCALES)[number]
export type ToolText = Partial<Record<ToolLocale, string>>

export interface ToolCategory {
  readonly id: string
  readonly label: ToolText
  /** One line under the group's heading. */
  readonly lede?: ToolText
  /**
   * Why the stage is held back: a decision it waits for. A held stage and its tools stay in the file,
   * checked like any other, and reach no page (`toolsView` skips them); deleting the line lists them.
   */
  readonly hold?: string
}

/**
 * How a tool is paid for, as the reader of a catalogue sees it: a card in their country (`rub` for a
 * Russian one), a card issued abroad, nothing to pay, not open to them, or only through an app
 * store. One word on the card (`TOOLS_COPY.pay`); the sentence behind it stays in `availability`.
 */
export const PAY_CLASSES = ['rub', 'foreign-card', 'free', 'unavailable', 'app-store'] as const
export type PayClass = (typeof PAY_CLASSES)[number]

/** A card's short price fits a badge beside the tool's name ("от 790 ₽/мес", "$15/mo"). */
export const PRICE_BADGE_MAX = 22

export interface ToolEntry {
  readonly id: string
  /** A category id; `null` only for a DareBay tool that serves no single stage (the store). */
  readonly category: string | null
  readonly name: string
  /** The name as a language writes it (`Рилс Босс`), when it differs from `name`. */
  readonly displayName?: ToolText
  /** The letters of the card's badge, when the automatic ones read badly (`monogram`). */
  readonly mono?: string
  /**
   * A DareBay tool's line icon (`art.ts`, the tiles' set) in place of the monogram, so six of our
   * own tools do not read as six identical "D" badges. A third-party card never draws a picture.
   */
  readonly icon?: string
  /** The tool's own site. For a DareBay tool, the darebay.com address its button opens. */
  readonly url: string
  /** The catalogues that list the tool; every catalogue by default. */
  readonly locales?: readonly ToolLocale[]
  readonly whatFor: ToolText
  readonly priceFrom: ToolText
  /** The price in a few words for the card's badge (at most `PRICE_BADGE_MAX` characters); `priceFrom` stays the full line. */
  readonly priceBadge?: ToolText
  /** How the reader pays, per catalogue (`PAY_CLASSES`). */
  readonly pay?: Partial<Record<ToolLocale, PayClass>>
  readonly priceCheckedAt: string
  readonly freeTier: ToolText | null
  readonly availability: ToolText
  /** Our review of the tool per language: a page path, linked only once that page exists there. */
  readonly review?: ToolText | null
  /** Internal: the partner programme. Never rendered, never shipped to a page. */
  readonly affiliate?: unknown
  readonly darebay: { readonly own: false } | { readonly own: true; readonly status: 'live'; readonly to?: CtaKey }
  /**
   * Where the price was read, and the day: the tool's own pricing or help page. A page on another
   * host (the developer's App Store listing, the parent company's site) names its publisher in
   * `owner`, so a reviewer sees why it counts as the service's own page.
   */
  readonly source: { readonly url: string; readonly date: string; readonly owner?: string }
  /** Internal: where each other field was read. Never shipped to a page. */
  readonly sources?: readonly { readonly field: string; readonly url: string; readonly date: string }[]
}

export interface ToolsCatalog {
  /** The day the catalogue as a whole was checked; a card shows its own day only when it differs. */
  readonly checkedAt: string
  readonly categories: readonly ToolCategory[]
  readonly tools: readonly ToolEntry[]
}

// ---- what a page receives ---------------------------------------------------------------------

export interface ToolCard {
  readonly id: string
  readonly name: string
  readonly mono: string
  /** A DareBay tool's icon, as inline SVG markup (`art.ts`): drawn in place of the monogram. */
  readonly icon?: string
  readonly what: string
  readonly price: string
  /** The short price of the badge beside the name; the full `price` then sits in the card's disclosure. */
  readonly badge?: string
  readonly pay?: PayClass
  /** The price's source and the day it was read, formatted for the language (`29.09.2026`). */
  readonly asOf?: { readonly date: string; readonly href: string }
  readonly free?: string
  readonly access: string
  /** Our review in this language, when the page exists. */
  readonly review?: string
  /** The tool's site (external, unfollowed, new tab) or, for a DareBay tool, its place in the product. */
  readonly site: SourceAnchor
  /** A DareBay tool's button by CTA key, so it reads as that key's label ("Начать на DareBay →"). */
  readonly to?: CtaKey
  readonly own: boolean
  /** A DareBay tool's stage of the work, the label of its category. */
  readonly stage?: string
}

export interface ToolGroup {
  readonly id: string
  readonly label: string
  readonly lede?: string
  readonly tools: readonly ToolCard[]
}

/** The catalogue of one language, as `<LTools :data="tools" />` receives it (`tools.<locale>.data.ts`). */
export interface ToolsView {
  /** The language the cards are written in: the component takes its labels from it. */
  readonly locale: ToolLocale
  readonly own: readonly ToolCard[]
  readonly groups: readonly ToolGroup[]
}

export type ToolsData = Partial<Record<ToolLocale, ToolsView>>

// ---- checks -------------------------------------------------------------------------------------

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const isDate = (value: unknown): value is string => typeof value === 'string' && DATE.test(value) && !Number.isNaN(Date.parse(value))
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '' && value === value.trim()
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isHttps = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

const TOOL_KEYS = new Set(['id', 'category', 'name', 'displayName', 'mono', 'icon', 'url', 'locales', 'whatFor', 'priceFrom', 'priceBadge', 'pay', 'priceCheckedAt', 'freeTier', 'availability', 'review', 'affiliate', 'darebay', 'source', 'sources'])
const CATEGORY_KEYS = new Set(['id', 'label', 'lede', 'hold'])
const CATALOG_KEYS = new Set(['checkedAt', 'categories', 'tools'])

/** Whether two addresses are on the same site: one host is the other or a subdomain of it (`www.` ignored). */
const sameSite = (a: string, b: string): boolean => {
  const [x, y] = [a, b].map((url) => new URL(url).hostname.replace(/^www\./, ''))
  return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`)
}

/** The languages a tool is listed in. */
export const toolLocales = (tool: Pick<ToolEntry, 'locales'>): readonly ToolLocale[] => tool.locales ?? TOOL_LOCALES

/** Every problem of the catalogue, as `where: what`. Empty when the file is sound. */
export function validateToolsCatalog(input: unknown): string[] {
  const problems: string[] = []
  const add = (where: string, what: string) => problems.push(`${where}: ${what}`)
  if (!isRecord(input)) return ['tools.json: not an object']
  for (const key of Object.keys(input)) if (!CATALOG_KEYS.has(key)) add('tools.json', `unknown key "${key}"`)
  if (!isDate(input.checkedAt)) add('checkedAt', 'expected YYYY-MM-DD')

  const texts = (where: string, value: unknown, locales: readonly ToolLocale[], optional = false) => {
    if (value === undefined && optional) return
    if (!isRecord(value)) return add(where, `expected { ${locales.join(', ')} }`)
    for (const key of Object.keys(value)) if (!(TOOL_LOCALES as readonly string[]).includes(key)) add(where, `unknown language "${key}"`)
    for (const locale of locales) if (!isText(value[locale])) add(`${where}.${locale}`, 'expected a trimmed, non-empty string')
  }

  const categories = Array.isArray(input.categories) ? input.categories : []
  if (!Array.isArray(input.categories) || !categories.length) add('categories', 'expected a non-empty list')
  const categoryIds = new Set<string>()
  categories.forEach((category, index) => {
    const where = `categories[${index}]`
    if (!isRecord(category)) return add(where, 'expected an object')
    for (const key of Object.keys(category)) if (!CATEGORY_KEYS.has(key)) add(where, `unknown key "${key}"`)
    if (typeof category.id !== 'string' || !ID.test(category.id)) add(`${where}.id`, 'expected a kebab-case id')
    else if (categoryIds.has(category.id)) add(`${where}.id`, `"${category.id}" is listed twice`)
    else categoryIds.add(category.id)
    texts(`${where}.label`, category.label, TOOL_LOCALES)
    texts(`${where}.lede`, category.lede, TOOL_LOCALES, true)
    if (category.hold !== undefined && !isText(category.hold)) add(`${where}.hold`, 'expected the decision the stage waits for')
  })

  const tools = Array.isArray(input.tools) ? input.tools : []
  if (!Array.isArray(input.tools) || !tools.length) add('tools', 'expected a non-empty list')
  const toolIds = new Set<string>()
  tools.forEach((tool, index) => {
    if (!isRecord(tool)) return add(`tools[${index}]`, 'expected an object')
    const where = `tools[${typeof tool.id === 'string' ? tool.id : index}]`
    for (const key of Object.keys(tool)) if (!TOOL_KEYS.has(key)) add(where, `unknown key "${key}"`)
    if (typeof tool.id !== 'string' || !ID.test(tool.id)) add(`${where}.id`, 'expected a kebab-case id')
    else if (toolIds.has(tool.id)) add(`${where}.id`, 'listed twice')
    else toolIds.add(tool.id)

    const darebay = tool.darebay
    const own = isRecord(darebay) && darebay.own === true
    if (!isRecord(darebay) || typeof darebay.own !== 'boolean') add(`${where}.darebay`, 'expected { own: boolean }')
    else if (own) {
      // DareBay's own cards describe what works today. "Coming soon" is not a status.
      if (darebay.status !== 'live') add(`${where}.darebay.status`, 'a DareBay tool is listed only when it is "live"')
      if (darebay.to !== undefined && !isCtaKey(darebay.to)) add(`${where}.darebay.to`, `"${String(darebay.to)}" is not a CTA key`)
      for (const key of Object.keys(darebay)) if (!['own', 'status', 'to'].includes(key)) add(`${where}.darebay`, `unknown key "${key}"`)
    } else if (Object.keys(darebay).length !== 1) add(`${where}.darebay`, 'a third-party tool is { own: false } only')

    if (tool.category === null) {
      if (!own) add(`${where}.category`, 'only a DareBay tool may stand outside the stages of the work')
    } else if (typeof tool.category !== 'string' || !categoryIds.has(tool.category)) add(`${where}.category`, `"${String(tool.category)}" is not a category`)
    if (!isText(tool.name)) add(`${where}.name`, 'expected a non-empty string')
    if (tool.mono !== undefined && !(typeof tool.mono === 'string' && /^\S{1,3}$/u.test(tool.mono))) add(`${where}.mono`, 'expected one to three letters')
    if (tool.icon !== undefined) {
      if (!own) add(`${where}.icon`, 'only a DareBay tool draws an icon; a third-party card keeps its letters')
      else if (typeof tool.icon !== 'string' || !ICON_NAMES.includes(tool.icon)) add(`${where}.icon`, `"${String(tool.icon)}" is not an icon (${ICON_NAMES.join(', ')})`)
    }

    if (!isHttps(tool.url)) add(`${where}.url`, 'expected an https address')
    else if (own !== (sitePathOf(tool.url) !== null)) {
      add(`${where}.url`, own ? 'a DareBay tool opens a darebay.com address' : 'a third-party tool opens its own site, not darebay.com')
    }

    let locales: readonly ToolLocale[] = TOOL_LOCALES
    if (tool.locales !== undefined) {
      if (!Array.isArray(tool.locales) || !tool.locales.length || tool.locales.some((locale) => !(TOOL_LOCALES as readonly unknown[]).includes(locale))) {
        add(`${where}.locales`, `expected a non-empty subset of [${TOOL_LOCALES.join(', ')}]`)
      } else locales = tool.locales as ToolLocale[]
    }
    texts(`${where}.whatFor`, tool.whatFor, locales)
    texts(`${where}.priceFrom`, tool.priceFrom, locales)
    texts(`${where}.priceBadge`, tool.priceBadge, locales, true)
    if (isRecord(tool.priceBadge)) {
      for (const [locale, badge] of Object.entries(tool.priceBadge)) {
        if (typeof badge === 'string' && [...badge].length > PRICE_BADGE_MAX) add(`${where}.priceBadge.${locale}`, `${[...badge].length} characters, a badge holds at most ${PRICE_BADGE_MAX}`)
      }
    }
    if (tool.pay !== undefined) {
      if (!isRecord(tool.pay)) add(`${where}.pay`, `expected { ${locales.join(', ')} }`)
      else {
        for (const key of Object.keys(tool.pay)) if (!(TOOL_LOCALES as readonly string[]).includes(key)) add(`${where}.pay`, `unknown language "${key}"`)
        for (const locale of locales) {
          if (!(PAY_CLASSES as readonly unknown[]).includes(tool.pay[locale])) add(`${where}.pay.${locale}`, `expected one of ${PAY_CLASSES.join(', ')}`)
        }
      }
    }
    texts(`${where}.availability`, tool.availability, locales)
    texts(`${where}.displayName`, tool.displayName, [], true)
    if (tool.freeTier !== null) texts(`${where}.freeTier`, tool.freeTier, locales)
    if (!isDate(tool.priceCheckedAt)) add(`${where}.priceCheckedAt`, 'expected YYYY-MM-DD')

    if (tool.review !== undefined && tool.review !== null) {
      if (!isRecord(tool.review)) add(`${where}.review`, 'expected { ru?, en? } page paths')
      else {
        for (const [locale, path] of Object.entries(tool.review)) {
          if (!(TOOL_LOCALES as readonly string[]).includes(locale)) add(`${where}.review`, `unknown language "${locale}"`)
          else if (typeof path !== 'string' || !path.startsWith('/') || (locale === 'en') !== path.startsWith('/en/')) {
            add(`${where}.review.${locale}`, `expected a docs path of the ${locale} tree`)
          }
        }
      }
    }
    if (tool.affiliate !== undefined && tool.affiliate !== null && !isRecord(tool.affiliate)) add(`${where}.affiliate`, 'expected an object or null')

    if (!isRecord(tool.source) || !isHttps(tool.source.url) || !isDate(tool.source.date)) add(`${where}.source`, 'expected { url: https, date: YYYY-MM-DD }')
    else {
      for (const key of Object.keys(tool.source)) if (!['url', 'date', 'owner'].includes(key)) add(`${where}.source`, `unknown key "${key}"`)
      if (tool.source.owner !== undefined && !isText(tool.source.owner)) add(`${where}.source.owner`, 'expected who publishes the page')
      // A third-party price comes from the service's own page (BRIEF §3.1), never from DareBay's.
      if (!own && isHttps(tool.url)) {
        if (sitePathOf(tool.source.url) !== null) add(`${where}.source`, 'a third-party price is read on the service\'s own page, not on darebay.com')
        else if (!sameSite(tool.source.url, tool.url) && tool.source.owner === undefined) {
          add(`${where}.source`, `the price is read on ${new URL(tool.source.url).hostname}, not on the tool's own site: cite its own page, or name the page's publisher in "owner"`)
        }
      }
    }
    if (tool.sources !== undefined) {
      if (!Array.isArray(tool.sources)) add(`${where}.sources`, 'expected a list')
      else tool.sources.forEach((source, n) => {
        if (!isRecord(source) || !isText(source.field) || !isHttps(source.url) || !isDate(source.date)) add(`${where}.sources[${n}]`, 'expected { field, url: https, date }')
      })
    }
  })
  return problems
}

// ---- the view -----------------------------------------------------------------------------------

/**
 * The letters of a card's badge: the initials of a two-word name ("Reels Boss" RB), the capitals of
 * a camel-cased one ("CapCut" CC, "OpusClip" OC), a short all-capitals name as it is ("VN"), else
 * the first letter. Never a logo: no trademark and no image to fetch.
 */
export function monogram(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (!words.length) return '?'
  if (words.length > 1) return (words[0][0] + words[1][0]).toLocaleUpperCase()
  const word = words[0]
  const capitals = word.match(/\p{Lu}/gu) ?? []
  if (word.length <= 3 && word === word.toLocaleUpperCase()) return word
  if (capitals.length >= 2) return capitals.slice(0, 2).join('')
  return word[0].toLocaleUpperCase()
}

const DATE_FORMAT: Record<ToolLocale, Intl.DateTimeFormatOptions> = {
  ru: { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' },
  en: { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' },
}
const LOCALE_TAG: Record<ToolLocale, string> = { ru: 'ru-RU', en: 'en-US' }

/** A day as the language writes it: `29.09.2026`, `September 29, 2026`. */
export const formatToolDate = (date: string, locale: ToolLocale): string =>
  new Intl.DateTimeFormat(LOCALE_TAG[locale], DATE_FORMAT[locale]).format(new Date(`${date}T00:00:00Z`))

/** Whether `path` is a page of the registry in `locale` (a review is linked only then). */
export const isPageIn = (path: string, locale: Locale): boolean => {
  const bare = path.replace(/[?#].*$/, '')
  return PAGES.some((entry) => localesOf(entry).includes(locale) && pagePath(entry, locale) === bare)
}

const nameIn = (tool: ToolEntry, locale: ToolLocale) => tool.displayName?.[locale] ?? tool.name

/** A figure keeps its groups and its unit on one line: `3 490 ₽`, `10 USDT`. */
export const keepFigures = (text: string): string => text.replace(/(?<=\d) (?=\d{3}(?!\d)|₽|USDT\b)/g, '\u00a0')

/** The cards of one language, ready to render. */
export function toolsView(catalog: ToolsCatalog, pageExists: (path: string, locale: Locale) => boolean = isPageIn): ToolsData {
  const view: ToolsData = {}
  const held = new Set(catalog.categories.filter((category) => category.hold !== undefined).map((category) => category.id))
  for (const locale of TOOL_LOCALES) {
    const listed = catalog.tools.filter((tool) => toolLocales(tool).includes(locale) && !(tool.category !== null && held.has(tool.category)))
    if (!listed.length) continue
    const label = (id: string | null) => catalog.categories.find((category) => category.id === id)?.label[locale]
    const card = (tool: ToolEntry): ToolCard => {
      const own = tool.darebay.own
      const name = nameIn(tool, locale)
      const review = tool.review?.[locale]
      const free = tool.freeTier?.[locale]
      const stage = own ? label(tool.category) : undefined
      const badge = tool.priceBadge?.[locale]
      const pay = tool.pay?.[locale]
      return {
        id: tool.id,
        name,
        // DareBay's own cards carry the brand's letter, as the header's logo does, unless they draw
        // their own icon (only DareBay's may: validateToolsCatalog).
        mono: tool.mono ?? (own ? 'D' : monogram(name)),
        ...(own && tool.icon && ART[`i-${tool.icon}`] ? { icon: ART[`i-${tool.icon}`] } : {}),
        what: keepFigures(tool.whatFor[locale]!),
        price: keepFigures(tool.priceFrom[locale]!),
        ...(badge ? { badge: keepFigures(badge) } : {}),
        ...(pay ? { pay } : {}),
        ...(own ? {} : { asOf: { date: formatToolDate(tool.priceCheckedAt, locale), href: tool.source.url } }),
        ...(free ? { free: keepFigures(free) } : {}),
        access: keepFigures(tool.availability[locale]!),
        ...(review && pageExists(review, locale) ? { review } : {}),
        site: tool.darebay.own && tool.darebay.to ? ctaAnchor(tool.darebay.to, locale) : sourceAnchor(tool.url, locale),
        ...(tool.darebay.own && tool.darebay.to ? { to: tool.darebay.to } : {}),
        own,
        ...(stage ? { stage } : {}),
      }
    }
    const byName = (a: ToolCard, b: ToolCard) => a.name.localeCompare(b.name, locale)
    view[locale] = {
      locale,
      own: listed.filter((tool) => tool.darebay.own).map(card),
      groups: catalog.categories.flatMap((category) => {
        if (held.has(category.id)) return []
        const tools = listed.filter((tool) => !tool.darebay.own && tool.category === category.id).map(card).sort(byName)
        return tools.length ? [{ id: category.id, label: category.label[locale]!, ...(category.lede?.[locale] ? { lede: category.lede[locale] } : {}), tools }] : []
      }),
    }
  }
  return view
}
