import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CTA_KEYS, ctaAnchor } from '../../links'
import { KNOWN_LOCALES } from '../../registry'
import { ART, ICON_NAMES } from './art'
import { LANDING_COPY, formatDay, headingHtml, keepShortWords } from './copy'
import {
  HUB_CTA,
  SESSION_STORAGE_KEY,
  bandButtons,
  catalogPlacement,
  ctaAfterStages,
  ctaButton,
  ctaLabel,
  heroAction,
  installReturningVisitorLinks,
  isCreatorSection,
  itemLink,
  withoutSignup,
} from './showcase'

describe('CTA buttons', () => {
  it('labels every key in every language, keeping the texts the CTA band always printed', () => {
    for (const language of KNOWN_LOCALES) {
      const copy = LANDING_COPY[language]
      for (const key of CTA_KEYS) expect(ctaLabel(copy, key).trim(), `${language}/${key}`).not.toBe('')
      expect(ctaLabel(copy, 'tasks')).toBe(copy.ctaPrimary)
      expect(ctaLabel(copy, 'business')).toBe(copy.bizCtaPrimary)
      expect(ctaLabel(copy, 'founder')).toBe(copy.bizCtaSecondary)
    }
  })

  it('takes the page’s own label when it has one, and the address only from the key', () => {
    const copy = LANDING_COPY.ru
    expect(ctaButton({ to: 'founder', label: ' Поможем настроить ' }, 'ru', copy)).toEqual({ label: 'Поможем настроить', anchor: ctaAnchor('founder', 'ru') })
    expect(ctaButton({ to: 'signup', label: '   ' }, 'en', LANDING_COPY.en).label).toBe(LANDING_COPY.en.actions.signup)
    expect(ctaButton({ to: 'signup' }, 'en', LANDING_COPY.en).anchor).toEqual({ href: 'https://darebay.com/en/tasks?auth=signup', target: '_self' })
  })

  it('lets a hero button jump to a block of the page, but only with a label and only in-page', () => {
    const copy = LANDING_COPY.ru
    expect(heroAction({ href: '#tools', label: 'Смотреть каталог ↓' }, 'ru', copy)).toEqual({ label: 'Смотреть каталог ↓', anchor: { href: '#tools' } })
    expect(heroAction({ href: '#tools' }, 'ru', copy)).toBeNull()
    expect(heroAction({ href: '/tasks', label: 'x' }, 'ru', copy)).toBeNull()
    expect(heroAction({ to: 'home', label: 'x' }, 'ru', copy)).toBeNull()
    expect(heroAction({ to: 'teams' }, 'uk', LANDING_COPY.uk)?.anchor.href).toBe('https://darebay.com/ua/earn/teams')
  })

  it('links a tile or a step by key or by a page of this site, moved into the reader’s language', () => {
    const copy = LANDING_COPY.en
    expect(itemLink({ to: 'community' }, 'en', copy)).toEqual({ label: copy.actions.community, anchor: ctaAnchor('community', 'en') })
    expect(itemLink({ href: '/zarabotok/kalkulyator-zarabotka-na-narezkah' }, 'en', copy)).toEqual({
      label: copy.more,
      anchor: { href: '/en/earnings/clipping-earnings-calculator' },
    })
    expect(itemLink({ href: '/en/earnings/clipping-earnings-calculator', label: 'Calculate →' }, 'en', copy)?.label).toBe('Calculate →')
    expect(itemLink({}, 'en', copy)).toBeNull()
  })

  it('gives each landing section its CTA pair, and keeps the brands pair it always had', () => {
    expect(HUB_CTA.brands).toEqual(['business', 'founder'])
    expect(HUB_CTA.farm).toEqual(['tasks', 'founder'])
    expect(HUB_CTA.tools).toEqual(['tasks', 'community'])
    for (const pair of Object.values(HUB_CTA)) for (const key of pair) expect(CTA_KEYS).toContain(key)
  })

  // The band of every article of a section, the landing's leaves included: a leaf of the farm or
  // tools section names no buttons of its own (its `cta` holds a title and a lede) and gets the pair.
  it('breaks a long catalogue with the call to action after every third stage, never after the last', () => {
    expect([...ctaAfterStages(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])]).toEqual(['c', 'f'])
    expect([...ctaAfterStages(['a', 'b', 'c', 'd', 'e', 'f'])]).toEqual(['c'])
    expect([...ctaAfterStages(['a', 'b', 'c'])]).toEqual([])
    expect([...ctaAfterStages([])]).toEqual([])
  })

  it('fills an article’s band from its section’s pair, and the page’s own keys win', () => {
    const ru = LANDING_COPY.ru
    expect(bandButtons('farm', {}, 'ru', ru)).toEqual([ctaButton({ to: 'tasks' }, 'ru', ru), ctaButton({ to: 'founder' }, 'ru', ru)])
    expect(bandButtons('tools', {}, 'en', LANDING_COPY.en)).toEqual([ctaButton({ to: 'tasks' }, 'en', LANDING_COPY.en), ctaButton({ to: 'community' }, 'en', LANDING_COPY.en)])
    expect(bandButtons('tools', {}, 'ru', ru)[1]?.anchor.href).toBe('https://t.me/darebaycreatorschat')
    expect(bandButtons('brands', {}, 'uk', LANDING_COPY.uk).map((button) => button?.anchor.href)).toEqual([ctaAnchor('business', 'uk').href, ctaAnchor('founder', 'uk').href])
    // No pair: the catalogue, and the chrome's room for the second button (LCta.vue).
    expect(bandButtons('earnings', {}, 'ru', ru)).toEqual([ctaButton({ to: 'tasks' }, 'ru', ru), null])
    expect(bandButtons('farm', { primary: { to: 'teams' }, secondary: { to: 'community', label: 'Чат' } }, 'ru', ru)).toEqual([
      ctaButton({ to: 'teams' }, 'ru', ru),
      { label: 'Чат', anchor: ctaAnchor('community', 'ru') },
    ])
  })

  it('takes creator readers to all tasks before registration, preserving each application language', () => {
    const paths = { ru: '/tasks', uk: '/ua/tasks', en: '/en/tasks', ar: '/en/tasks' }
    for (const hub of ['earnings', 'farm', 'tools', 'about']) {
      expect(isCreatorSection(hub)).toBe(true)
      for (const language of KNOWN_LOCALES) {
        const copy = LANDING_COPY[language]
        const [first] = bandButtons(hub, {}, language, copy)
        expect(first.anchor, `${hub}/${language}`).toEqual({ href: `https://darebay.com${paths[language]}`, target: '_self' })
        expect(first.label).toBe(copy.ctaPrimary)
      }
    }
    for (const hub of ['brands', 'help', 'legal', '']) expect(isCreatorSection(hub), hub).toBe(false)
  })
})

describe('the section catalogue', () => {
  it('is listed exactly once: above a plain index, inside or after a showcase, never on an article', () => {
    expect(catalogPlacement({ isHub: false })).toBeNull()
    expect(catalogPlacement({ isHub: false, showcase: true, catalogInline: true })).toBeNull()
    expect(catalogPlacement({ isHub: true })).toBe('top')
    expect(catalogPlacement({ isHub: true, showcase: 'yes' })).toBe('top')
    expect(catalogPlacement({ isHub: true, showcase: true })).toBe('after')
    expect(catalogPlacement({ isHub: true, showcase: true, catalogInline: true })).toBe('inline')
  })

  // The layout and LCatalog read that one decision; held here so neither can drift into a second list.
  it('is rendered by the layout and by LCatalog from that decision only', () => {
    const read = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8')
    const layout = read('LandingLayout.vue')
    expect(layout).toContain("<LCatalog v-if=\"catalog === 'after'\" />")
    expect(layout).toContain("<template v-else-if=\"catalog === 'top'\">")
    expect(layout.match(/<HubIndex\b/g)).toHaveLength(1)
    const wrapper = read('LCatalog.vue')
    expect(wrapper).toContain("placement === 'inline' || placement === 'after'")
    expect(wrapper.match(/<HubIndex\b/g)).toHaveLength(1)
  })
})

// A page imports LTools (and so everything LTools imports) into its own chunk. Should anything in
// that graph import `vitepress`, Rollup splits VitePress's client module from its `Content`
// component across chunks and warns of a circular chunk order that "will likely lead to broken
// execution order" on every page (seen on 2026-09-29 with a `useData` import in LTools).
describe('the module graph of the blocks a page imports itself', () => {
  const importsOf = (file: string): string[] => {
    const source = readFileSync(file, 'utf8')
    return [...source.matchAll(/^\s*import\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((match) => match[1])
  }
  const resolve = (from: string, specifier: string): string | null => {
    if (!specifier.startsWith('.')) return null
    const base = join(from, '..', specifier)
    return [base, `${base}.ts`, `${base}.vue`].find((candidate) => /\.(ts|vue)$/.test(candidate) && existsSync(candidate)) ?? null
  }

  // LTools, and since 2026-09-30 LFlow, LFeatures and LSetup: only the landings show them, so they
  // ride in those pages' chunks instead of the theme chunk (landingFrontmatter.ts PAGE_BLOCKS).
  it.each(['LTools.vue', 'LFlow.vue', 'LFeatures.vue', 'LSetup.vue'])('%s never imports vitepress, however deep', (entry) => {
    const seen = new Set<string>()
    const queue = [join(import.meta.dirname, entry)]
    while (queue.length) {
      const file = queue.pop()!
      if (seen.has(file)) continue
      seen.add(file)
      for (const specifier of importsOf(file)) {
        expect(specifier, `${file} imports ${specifier}`).not.toMatch(/^vitepress(\/|$)/)
        const next = resolve(file, specifier)
        if (next) queue.push(next)
      }
    }
    expect(seen.size).toBeGreaterThan(2)
  })

  it('is registered in the theme for none of them, and the section catalogue stays registered', () => {
    const theme = readFileSync(join(import.meta.dirname, '..', 'index.ts'), 'utf8')
    for (const block of ['LTools', 'LFlow', 'LFeatures', 'LSetup']) expect(theme, block).not.toMatch(new RegExp(`import ${block}\\b|app\\.component\\('${block}'`))
    expect(theme).toContain("app.component('LCatalog', LCatalog)")
  })
})

describe('registration links for a returning visitor', () => {
  it('drop only the registration dialog, keeping the page, the tree and the fragment', () => {
    expect(withoutSignup('https://darebay.com/tasks?auth=signup')).toBe('https://darebay.com/tasks')
    expect(withoutSignup('https://darebay.com/en/tasks?auth=signup#top')).toBe('https://darebay.com/en/tasks#top')
    expect(withoutSignup('https://darebay.com/tasks?type=clips')).toBe('https://darebay.com/tasks?type=clips')
    expect(withoutSignup('https://darebay.com/tasks?auth=signupx')).toBe('https://darebay.com/tasks?auth=signupx')
    for (const language of KNOWN_LOCALES) expect(withoutSignup(ctaAnchor('signup', language).href)).toBe(ctaAnchor('tasks', language).href)
  })

  it('reads the session the application writes (contests-frontend authToken.ts TOKEN_STORAGE_KEY)', () => {
    expect(SESSION_STORAGE_KEY).toBe('userToken')
  })

  // CI has no browser, so the listener runs here against the smallest document it needs: one
  // capturing click listener, `closest`, and the storage the application writes.
  it('opens the catalogue itself for a signed-in reader, and leaves every other click alone', () => {
    const scope = globalThis as Record<string, unknown>
    const saved = { document: scope.document, window: scope.window }
    const listeners: { type: string; listener: (event: unknown) => void; capture: unknown }[] = []
    let storage: () => string | null = () => null
    scope.document = { addEventListener: (type: string, listener: (event: unknown) => void, capture: unknown) => listeners.push({ type, listener, capture }) }
    scope.window = { localStorage: { getItem: (key: string) => (key === SESSION_STORAGE_KEY ? storage() : null) } }
    try {
      installReturningVisitorLinks()
      installReturningVisitorLinks()
      expect(listeners.map(({ type, capture }) => [type, capture])).toEqual([['click', true]])
      const click = (href: string) => {
        const link = { href }
        listeners[0].listener({ target: { closest: (selector: string) => (selector === 'a[href*="?auth=signup"]' && href.includes('?auth=signup') ? link : null) } })
        return link.href
      }
      const signup = ctaAnchor('signup', 'ru').href
      expect(click(signup)).toBe(signup)
      storage = () => 'token'
      expect(click(signup)).toBe(ctaAnchor('tasks', 'ru').href)
      expect(click('https://t.me/ruslanbwork')).toBe('https://t.me/ruslanbwork')
      storage = () => { throw new Error('storage blocked') }
      expect(click(signup)).toBe(signup)
    } finally {
      scope.document = saved.document
      scope.window = saved.window
    }
  })
})

describe('the pictures', () => {
  const heroes = ['farm', 'tools']

  it('draws each section hero within its 2.5 KB budget', () => {
    for (const name of heroes) expect(new TextEncoder().encode(ART[name]).length, name).toBeLessThanOrEqual(2560)
  })

  it('says nothing in words and fetches nothing', () => {
    for (const [name, svg] of Object.entries(ART)) {
      expect(svg, name).toMatch(/^<svg\b[^>]*focusable="false"/)
      expect(svg, name).not.toMatch(/<(text|script|image|foreignObject)\b|\bhref="(?!#)/)
    }
  })

  it('moves only for a reader who has not asked for less motion', () => {
    for (const name of heroes) {
      const style = ART[name].match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
      const outside = style.replace(/@media \(prefers-reduced-motion:no-preference\)\{(?:[^{}]*\{[^{}]*\})*\}/g, '')
      expect(outside, name).not.toMatch(/animation\s*:/)
      expect(style, name).toMatch(/prefers-reduced-motion:no-preference\)\{[^}]*animation:/)
    }
  })

  it('keeps every id of a drawing its own, and every icon on the 24px grid', () => {
    const ids = heroes.flatMap((name) => [...ART[name].matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]))
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^lp-art-/)
    for (const name of ICON_NAMES) expect(ART[`i-${name}`]).toMatch(/^<svg viewBox="0 0 24 24"/)
  })
})

// A Russian heading broke «Контент-завод на | DareBay» and «для | рилс и | шортсов» (review
// 2026-09-30): display only, the page's title and source stay as written.
describe('Russian display lines', () => {
  it('binds a short preposition or conjunction to the next word, in Russian only', () => {
    expect(keepShortWords('Нейросети и сервисы для рилс и шортсов', 'ru')).toBe('Нейросети и\u00a0сервисы для\u00a0рилс и\u00a0шортсов')
    expect(keepShortWords('В заданиях и в Telegram', 'ru')).toBe('В\u00a0заданиях и\u00a0в\u00a0Telegram')
    expect(keepShortWords('Сравнение (для команд)', 'ru')).toBe('Сравнение (для\u00a0команд)')
    expect(keepShortWords('Уникализация видео', 'ru')).toBe('Уникализация видео')
    expect(keepShortWords('Tools for Reels and Shorts', 'en')).toBe('Tools for Reels and Shorts')
    expect(keepShortWords(keepShortWords('на DareBay', 'ru'), 'ru')).toBe('на\u00a0DareBay')
  })

  it('keeps a hyphenated compound on one line and escapes the rest', () => {
    expect(headingHtml('Контент-завод на DareBay: <всё> & сразу', 'ru')).toBe('<span class="lp-nw">Контент-завод</span> на\u00a0DareBay: &lt;всё&gt; &amp; сразу')
    expect(headingHtml('ИИ-контент-завод', 'ru')).toBe('<span class="lp-nw">ИИ-контент-завод</span>')
    expect(headingHtml('A content-farm <b>', 'en')).toBe('A content-farm &lt;b&gt;')
  })

  it('keeps the short words, quotes and punctuation bound to a compound inside its unit', () => {
    // `.lp-nw` is an inline-block, a line-break point on both sides even next to a no-break space: the
    // W2 H1 read «Работа на | контент-заводе | : вакансии» on a phone (review 2026-09-30).
    expect(headingHtml('Работа на контент-заводе: вакансии и старт', 'ru')).toBe('Работа <span class="lp-nw">на\u00a0контент-заводе:</span> вакансии и\u00a0старт')
    expect(headingHtml('Что такое «ИИ-контент-завод»?', 'ru')).toBe('Что\u00a0такое <span class="lp-nw">«ИИ-контент-завод»?</span>')
    expect(headingHtml('Нарезки (для крипто-проектов), и всё', 'ru')).toBe('Нарезки <span class="lp-nw">(для\u00a0крипто-проектов),</span> и\u00a0всё')
    expect(headingHtml('Сколько стоит клиппинг-кампания: бюджет', 'ru')).toBe('Сколько стоит <span class="lp-nw">клиппинг-кампания:</span> бюджет')
  })

  it('writes a day the way the page’s language does, ISO for machines and other languages', () => {
    expect(formatDay('2026-09-30', 'ru')).toBe('30.09.2026')
    expect(formatDay('2026-09-30', 'uk')).toBe('30.09.2026')
    expect(formatDay('2026-09-30', 'en')).toBe('2026-09-30')
    expect(formatDay('30.09.2026', 'ru')).toBe('30.09.2026')
  })
})
