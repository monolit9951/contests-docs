// The frontmatter of the landing blocks, checked at build time (config.ts `transformPageData`).
//
// A block that reads its content from the frontmatter prints whatever the page gives it, and a
// frontmatter mistake does not fail anything by itself: an unknown CTA key renders a button to
// nowhere, a mistyped page path ships a 404 that no dead-link check sees (VitePress and
// `check-registry` read only Markdown links), a misspelled key (`includes` for `items`) silently
// drops a list. So every such key is checked here, and a page with a problem does not build.
//
// The API itself is documented for authors in the page contract of the showcase landings; the
// rules are the ones below.
import { isCtaKey, localizedSitePath } from './links'
import type { Locale } from './registry'
import { ART, ICON_NAMES } from './theme/landing/art'
import { keepShortWords } from './theme/landing/copy'
import { TOOL_LOCALES, keepFigures } from './tools'

export interface LandingContext {
  /** Whether the page is its section's index. */
  readonly isHub: boolean
  readonly locale: Locale
}

type Fields = Record<string, unknown>
const isRecord = (value: unknown): value is Fields => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

/** The pictures a page shows, as SVG markup: the section's hero drawing, the icons of its tiles. */
export interface LandingArt {
  readonly hero?: string
  readonly icons?: Readonly<Record<string, string>>
}

/**
 * The pictures of a page, read off its frontmatter: a showcase section index gets its section's
 * hero drawing, a `features` block the icons its tiles name. Null when the page shows none.
 */
export function landingArt(frontmatter: Fields, { isHub, hub }: { readonly isHub: boolean; readonly hub: string }): LandingArt | null {
  const hero = isHub && frontmatter.showcase === true ? ART[hub] : undefined
  const items = isRecord(frontmatter.features) && Array.isArray(frontmatter.features.items) ? frontmatter.features.items : []
  const names = [...new Set(items.flatMap((item) => (isRecord(item) && typeof item.icon === 'string' && ART[`i-${item.icon}`] ? [item.icon] : [])))]
  const icons = names.length ? Object.fromEntries(names.map((name) => [name, ART[`i-${name}`]])) : undefined
  return hero || icons ? { ...(hero ? { hero } : {}), ...(icons ? { icons } : {}) } : null
}

/**
 * The landing blocks' texts with every figure kept on one line (`10 USDT`, `3 490 ₽`): a line break
 * inside an amount reads as two numbers. Their titles, in Russian, also keep a short preposition or
 * conjunction with the word after it (`keepShortWords`): «Запусти завод на | DareBay» read as a
 * mistake. Applied to the page data at build time, so the Markdown source (what the linters read)
 * stays as written and no browser runs any of it.
 */
export function keepLandingFigures(frontmatter: Fields, locale: Locale = 'en'): void {
  const fix = (holder: Fields, keys: readonly string[], typeset: (text: string) => string = keepFigures) => {
    for (const key of keys) {
      const value = holder[key]
      if (typeof value === 'string') holder[key] = typeset(value)
      else if (Array.isArray(value)) holder[key] = value.map((item) => (typeof item === 'string' ? typeset(item) : item))
    }
  }
  const title = (text: string) => keepShortWords(keepFigures(text), locale)
  if (isRecord(frontmatter.hero)) fix(frontmatter.hero, ['lede', 'note', 'proof', 'takeaways'])
  for (const block of ['flow', 'features', 'setup', 'cta']) {
    const value = frontmatter[block]
    if (!isRecord(value)) continue
    fix(value, ['lede', 'note', 'items', 'prepare'])
    fix(value, ['title', 'itemsTitle', 'prepareTitle'], title)
    for (const list of ['steps', 'items']) {
      if (Array.isArray(value[list])) {
        for (const item of value[list]) {
          if (!isRecord(item)) continue
          fix(item, ['text', 'darebay'])
          fix(item, ['title'], title)
        }
      }
    }
  }
}

/** A page's Markdown without its frontmatter and without fenced code: what renders as markup. */
const markupOf = (source: string): string => source.replace(/^---\n[\s\S]*?\n---/, '').replace(/^(```|~~~)[\s\S]*?^\1/gm, '')

/**
 * Whether a page's Markdown places the section catalogue itself: a line that opens with
 * `<LCatalog`, outside the frontmatter and outside fenced code.
 */
export const placesCatalog = (source: string): boolean => /^<LCatalog\b/m.test(markupOf(source))

/**
 * The landing blocks a page imports in its own `<script setup>` rather than finding them registered
 * in the theme: only the landings show them, so they ride in those pages' chunks, never in the theme
 * chunk every page downloads (theme/index.ts). LTools also takes its catalogue (below).
 */
export const PAGE_BLOCKS = ['LFlow', 'LFeatures', 'LSetup', 'LTools'] as const

/** Whether a page shows a block that reads its language from the page data (`frontmatter.locale`). */
export const usesPageBlocks = (frontmatter: Fields): boolean => ['flow', 'features', 'setup'].some((key) => frontmatter[key] !== undefined)

/**
 * Problems of a page's Markdown source the frontmatter does not show. A block that is not a global
 * component (`PAGE_BLOCKS`) and is placed without being imported renders as an unknown element with
 * no error at all. The tools catalogue also needs the catalogue of the page's own language
 * (`tools.<locale>.data`, one loader per language so a page downloads only its own cards) passed in,
 * or it would print nothing, or another language's cards.
 */
export function sourceProblems(source: string, locale: Locale): string[] {
  const markup = markupOf(source)
  const problems: string[] = []
  for (const block of PAGE_BLOCKS) {
    if (!new RegExp(`^<${block}\\b`, 'm').test(markup)) continue
    if (!new RegExp(`^\\s*import\\s+${block}\\s+from\\s+['"][^'"]*\\/theme\\/landing\\/${block}\\.vue['"]`, 'm').test(markup)) {
      problems.push(`<${block}>: the page must import it: import ${block} from '…/.vitepress/theme/landing/${block}.vue'`)
    }
  }
  const tag = markup.match(/^<LTools\b[^>]*>/m)?.[0]
  if (!tag) return problems
  const data = markup.match(/^\s*import\s*\{\s*data\s+as\s+(\w+)\s*\}\s*from\s*['"][^'"]*\/tools\.(\w+)\.data['"]/m)
  if (!(TOOL_LOCALES as readonly string[]).includes(locale)) problems.push(`<LTools>: the catalogue has no ${locale} cards (data/tools.json is written in ${TOOL_LOCALES.join(', ')})`)
  else if (!data) problems.push(`<LTools>: the page must import the catalogue of its language: import { data as tools } from '…/.vitepress/tools.${locale}.data'`)
  else if (data[2] !== locale) problems.push(`<LTools>: the page imports the ${data[2]} catalogue; import tools.${locale}.data, the cards of this page's language`)
  else if (!new RegExp(`:data="${data[1]}"`).test(tag)) problems.push(`<LTools>: pass the imported catalogue in: <LTools :data="${data[1]}" />`)
  return problems
}

/**
 * The blocks a page places in its Markdown and the frontmatter key each one reads. A block renders
 * nothing without its key, and a key renders nowhere without its tag; each block has a fixed id
 * (`#flow`, `#features`, `#setup`, `#tools`), so it stands once on a page.
 */
export const LANDING_BLOCKS = { LFlow: 'flow', LFeatures: 'features', LSetup: 'setup', LTools: 'tools', LCatalog: null } as const

/**
 * Problems of where the page places its blocks: a tag without its content, content without its tag,
 * a block twice, a section catalogue on a page that lists none (`<LCatalog />` renders only on a
 * showcase section index; anywhere else the tag would silently show nothing).
 */
export function placementProblems(frontmatter: Fields, source: string, { isHub }: Pick<LandingContext, 'isHub'>): string[] {
  const markup = markupOf(source)
  const problems: string[] = []
  if (/^<LCatalog\b/m.test(markup) && !(isHub && frontmatter.showcase === true)) {
    problems.push('<LCatalog />: renders only on a showcase section index (showcase: true); a plain index lists its section by itself')
  }
  for (const [tag, key] of Object.entries(LANDING_BLOCKS)) {
    const placed = markup.match(new RegExp(`^<${tag}\\b`, 'gm'))?.length ?? 0
    if (placed > 1) problems.push(`<${tag} />: placed ${placed} times; a block stands once on a page`)
    if (!key || key === 'tools') continue
    if (placed && frontmatter[key] === undefined) problems.push(`<${tag} />: the frontmatter has no "${key}" for it to show`)
    if (!placed && frontmatter[key] !== undefined) problems.push(`${key}: set, but the Markdown never places <${tag} /> on a line of its own`)
  }
  if (frontmatter.tools !== undefined && !/^<LTools\b/m.test(markup)) problems.push('tools: set, but the Markdown never places <LTools :data="…" /> on a line of its own')
  return problems
}

/** Limits a block keeps to so that it still reads as a landing block, not as a page of its own. */
export const LANDING_LIMITS = {
  heroActions: 2,
  heroProof: 4,
  proofLength: 48,
  noteLength: 140,
  flowSteps: [2, 6],
  featureItems: [1, 12],
  phones: [1, 3],
  phoneLabelLength: 24,
  setupItems: [1, 8],
  setupPrepare: [0, 8],
} as const

/** Every problem of the page's landing frontmatter, as `key: what`. Empty when there is none. */
export function landingProblems(frontmatter: Fields, { isHub, locale }: LandingContext): string[] {
  const problems: string[] = []
  const add = (where: string, what: string) => problems.push(`${where}: ${what}`)

  const only = (where: string, value: Fields, keys: readonly string[]) => {
    for (const key of Object.keys(value)) if (!keys.includes(key)) add(where, `unknown key "${key}" (expected ${keys.join(', ')})`)
  }
  const text = (where: string, value: unknown, { optional = false, max = Infinity } = {}) => {
    if (value === undefined && optional) return
    if (!isText(value)) add(where, 'expected a non-empty string')
    else if (value.length > max) add(where, `${value.length} characters, at most ${max}`)
  }
  const list = (where: string, value: unknown, [min, max]: readonly [number, number]): unknown[] => {
    if (value === undefined && min === 0) return []
    if (!Array.isArray(value)) {
      add(where, 'expected a list')
      return []
    }
    if (value.length < min || value.length > max) add(where, `${value.length} items, expected ${min} to ${max}`)
    return value
  }
  const key = (where: string, value: unknown) => {
    if (!isCtaKey(value)) add(where, `"${String(value)}" is not a CTA key (tasks, signup, teams, traffic, store, business, founder, community)`)
  }
  const page = (where: string, value: unknown) => {
    if (typeof value !== 'string' || !value.startsWith('/') || !localizedSitePath(value, locale).docsPage) {
      add(where, `"${String(value)}" is not a page of this site; a link into the application takes a CTA key in "to"`)
    }
  }
  // A step or a tile may carry one link: a CTA key or a page of this site.
  const link = (where: string, item: Fields) => {
    if (item.to !== undefined && item.href !== undefined) add(where, 'either "to" (a CTA key) or "href" (a page of this site), not both')
    if (item.to !== undefined) key(`${where}.to`, item.to)
    if (item.href !== undefined) page(`${where}.href`, item.href)
    if (item.label !== undefined) text(`${where}.label`, item.label)
    if (item.label !== undefined && item.to === undefined && item.href === undefined) add(where, '"label" without a link')
  }

  const showcase = frontmatter.showcase
  if (showcase !== undefined && typeof showcase !== 'boolean') add('showcase', 'expected true or false')
  if (showcase === true && !isHub) add('showcase', 'a showcase is a mode of a section index page; this page is not one')
  const isShowcase = showcase === true && isHub

  const hero = frontmatter.hero
  if (isRecord(hero)) {
    const landingKeys = ['actions', 'proof', 'note', 'fork'].filter((name) => hero[name] !== undefined)
    if (landingKeys.length && !isShowcase) add('hero', `${landingKeys.join(', ')} render only on a showcase section index (showcase: true)`)
    list('hero.actions', hero.actions ?? [], [0, LANDING_LIMITS.heroActions]).forEach((action, index) => {
      const where = `hero.actions[${index}]`
      if (!isRecord(action)) return add(where, 'expected { label, to } or { label, href: "#block" }')
      only(where, action, ['label', 'to', 'href'])
      if ((action.to === undefined) === (action.href === undefined)) return add(where, 'expected exactly one of "to" (a CTA key) and "href" (a "#block" of this page)')
      if (action.to !== undefined) key(`${where}.to`, action.to)
      else if (typeof action.href !== 'string' || !/^#[\w-]+$/.test(action.href)) add(`${where}.href`, 'expected a "#block" of this page')
      text(`${where}.label`, action.label, { optional: action.to !== undefined })
    })
    list('hero.proof', hero.proof ?? [], [0, LANDING_LIMITS.heroProof]).forEach((item, index) => text(`hero.proof[${index}]`, item, { max: LANDING_LIMITS.proofLength }))
    text('hero.note', hero.note, { optional: true, max: LANDING_LIMITS.noteLength })
    if (hero.fork !== undefined) {
      if (!isRecord(hero.fork)) add('hero.fork', 'expected { text, label, to }')
      else {
        only('hero.fork', hero.fork, ['text', 'label', 'to'])
        text('hero.fork.text', hero.fork.text)
        text('hero.fork.label', hero.fork.label)
        key('hero.fork.to', hero.fork.to)
      }
    }
  }

  const cta = frontmatter.cta
  if (isRecord(cta)) {
    only('cta', cta, ['title', 'lede', 'primary', 'secondary'])
    for (const slot of ['primary', 'secondary'] as const) {
      const button = cta[slot]
      if (button === undefined) continue
      if (!isRecord(button)) {
        add(`cta.${slot}`, 'expected { to, label? }')
        continue
      }
      only(`cta.${slot}`, button, ['to', 'label'])
      key(`cta.${slot}.to`, button.to)
      text(`cta.${slot}.label`, button.label, { optional: true })
    }
  }

  const flow = frontmatter.flow
  if (flow !== undefined) {
    if (!isRecord(flow)) add('flow', 'expected { title, lede?, steps }')
    else {
      only('flow', flow, ['title', 'lede', 'steps'])
      text('flow.title', flow.title)
      text('flow.lede', flow.lede, { optional: true })
      list('flow.steps', flow.steps, LANDING_LIMITS.flowSteps).forEach((step, index) => {
        const where = `flow.steps[${index}]`
        if (!isRecord(step)) return add(where, 'expected { title, text, darebay?, to? | href?, label? }')
        only(where, step, ['title', 'text', 'darebay', 'to', 'href', 'label'])
        text(`${where}.title`, step.title)
        text(`${where}.text`, step.text)
        text(`${where}.darebay`, step.darebay, { optional: true })
        link(where, step)
      })
    }
  }

  const features = frontmatter.features
  if (features !== undefined) {
    if (!isRecord(features)) add('features', 'expected { title, lede?, phones?, items }')
    else {
      only('features', features, ['title', 'lede', 'phones', 'items'])
      text('features.title', features.title)
      text('features.lede', features.lede, { optional: true })
      if (features.phones !== undefined) {
        if (!isRecord(features.phones)) add('features.phones', 'expected { labels, tag? }')
        else {
          only('features.phones', features.phones, ['labels', 'tag'])
          list('features.phones.labels', features.phones.labels, LANDING_LIMITS.phones).forEach((label, index) =>
            text(`features.phones.labels[${index}]`, label, { max: LANDING_LIMITS.phoneLabelLength }))
          text('features.phones.tag', features.phones.tag, { optional: true, max: LANDING_LIMITS.phoneLabelLength })
        }
      }
      list('features.items', features.items, LANDING_LIMITS.featureItems).forEach((item, index) => {
        const where = `features.items[${index}]`
        if (!isRecord(item)) return add(where, 'expected { icon?, title, text, to? | href?, label? }')
        only(where, item, ['icon', 'title', 'text', 'to', 'href', 'label'])
        if (item.icon !== undefined && !ICON_NAMES.includes(String(item.icon))) add(`${where}.icon`, `"${String(item.icon)}" is not an icon (${ICON_NAMES.join(', ')})`)
        text(`${where}.title`, item.title)
        text(`${where}.text`, item.text)
        link(where, item)
      })
    }
  }

  const setup = frontmatter.setup
  if (setup !== undefined) {
    if (!isRecord(setup)) add('setup', 'expected { title, lede?, items, prepare?, action, note? }')
    else {
      only('setup', setup, ['title', 'lede', 'items', 'itemsTitle', 'prepare', 'prepareTitle', 'action', 'note'])
      text('setup.title', setup.title)
      for (const name of ['lede', 'itemsTitle', 'prepareTitle', 'note']) text(`setup.${name}`, setup[name], { optional: true })
      list('setup.items', setup.items, LANDING_LIMITS.setupItems).forEach((item, index) => text(`setup.items[${index}]`, item))
      list('setup.prepare', setup.prepare, LANDING_LIMITS.setupPrepare).forEach((item, index) => text(`setup.prepare[${index}]`, item))
      if (!isRecord(setup.action)) add('setup.action', 'expected { label?, to }')
      else {
        only('setup.action', setup.action, ['label', 'to'])
        key('setup.action.to', setup.action.to)
        text('setup.action.label', setup.action.label, { optional: true })
      }
    }
  }

  const tools = frontmatter.tools
  if (tools !== undefined) {
    if (!isRecord(tools)) add('tools', 'expected { title, lede?, ownTitle?, ownLede?, cta? }')
    else {
      only('tools', tools, ['title', 'lede', 'ownTitle', 'ownLede', 'cta'])
      text('tools.title', tools.title)
      for (const name of ['lede', 'ownTitle', 'ownLede']) text(`tools.${name}`, tools[name], { optional: true })
      // The catalogue's own call to action, shown after every third stage (LTools.vue).
      if (tools.cta !== undefined) {
        if (!isRecord(tools.cta)) add('tools.cta', 'expected { text, to, label? }')
        else {
          only('tools.cta', tools.cta, ['text', 'to', 'label'])
          text('tools.cta.text', tools.cta.text, { max: LANDING_LIMITS.noteLength })
          key('tools.cta.to', tools.cta.to)
          text('tools.cta.label', tools.cta.label, { optional: true })
        }
      }
    }
  }
  return problems
}
