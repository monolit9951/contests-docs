import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { keepLandingFigures, landingArt, landingProblems, placementProblems, placesCatalog, sourceProblems, usesPageBlocks } from './landingFrontmatter'
import { TOOL_LOCALES } from './tools'
import { ART } from './theme/landing/art'

const HUB = { isHub: true, locale: 'ru' } as const
const LEAF = { isHub: false, locale: 'ru' } as const

// A complete showcase page, the way the contract documents it.
const showcase = () => ({
  showcase: true,
  hero: {
    kicker: 'Контент-завод',
    actions: [{ label: 'Начать на DareBay →', to: 'signup' }, { label: 'Каталог ↓', href: '#tools' }],
    note: 'Регистрация бесплатная.',
    proof: ['Своя версия на каждый аккаунт', 'Вывод на кошелёк от 10 USDT'],
    fork: { text: 'Для бренда?', label: 'Для бизнеса →', to: 'business' },
  },
  flow: {
    title: 'Как это работает',
    steps: [
      { title: 'Материал', text: 'Ролики по одной теме.', darebay: 'в заданиях под офферы.', to: 'tasks' },
      { title: 'Учёт', text: 'Просмотры.', href: '/zarabotok/kak-rabotaet-oplata-za-prosmotry', label: 'Как считают →' },
    ],
  },
  features: {
    title: 'Что уже есть',
    phones: { labels: ['копия 1', 'копия 2'], tag: 'своя версия' },
    items: [{ icon: 'views', title: 'Задания', text: 'За просмотры.', to: 'tasks' }, { title: 'Калькулятор', text: 'Сумма.', href: '/zarabotok/kalkulyator-zarabotka-na-narezkah#calculator' }],
  },
  setup: { title: 'Поможем', items: ['Выбрать задание'], prepare: ['Ссылки'], action: { label: 'Написать', to: 'founder' }, note: 'Отвечает Руслан.' },
  tools: { title: 'Каталог', lede: 'По алфавиту.', cta: { text: 'Нарезал ролик? DareBay платит за засчитанные просмотры.', to: 'signup' } },
  cta: { title: 'Запусти', lede: 'Всё есть.', primary: { to: 'signup' }, secondary: { label: 'Написать', to: 'founder' } },
})

describe('landingProblems', () => {
  it('accepts a complete showcase page', () => {
    expect(landingProblems(showcase(), HUB)).toEqual([])
  })

  it('accepts every page as it was: no landing keys, no problems', () => {
    expect(landingProblems({ title: 'x', hero: { kicker: 'k', lede: 'l', takeaways: ['a'] }, cta: { title: 't', lede: 'l' } }, LEAF)).toEqual([])
  })

  it('refuses a landing on a page that is not a section index', () => {
    expect(landingProblems({ showcase: true }, LEAF).join('\n')).toMatch(/showcase: a showcase is a mode of a section index page/)
    const page = showcase()
    page.showcase = false
    expect(landingProblems(page, HUB).join('\n')).toMatch(/hero: actions, proof, note, fork render only on a showcase section index/)
  })

  it('refuses a destination that is not a CTA key or a page of this site', () => {
    const cases: [(page: ReturnType<typeof showcase>) => void, RegExp][] = [
      [(page) => { page.hero.actions[0].to = 'home' }, /hero\.actions\[0\]\.to: "home" is not a CTA key/],
      [(page) => { page.hero.actions.push({ label: 'x', to: 'tasks' }) }, /hero\.actions: 3 items, expected 0 to 2/],
      [(page) => { page.hero.actions[1].href = '/tasks' }, /hero\.actions\[1\]\.href: expected a "#block" of this page/],
      [(page) => { delete (page.hero.actions[1] as { label?: string }).label }, /hero\.actions\[1\]\.label/],
      [(page) => { page.flow.steps[1].href = '/zarabotok/no-such-page' }, /flow\.steps\[1\]\.href: "\/zarabotok\/no-such-page" is not a page of this site/],
      [(page) => { page.flow.steps[1].href = '/tasks' }, /a link into the application takes a CTA key in "to"/],
      [(page) => { (page.flow.steps[0] as Record<string, unknown>).href = '/zarabotok/' }, /flow\.steps\[0\]: either "to" \(a CTA key\) or "href"/],
      [(page) => { page.setup.action.to = 'telegram' }, /setup\.action\.to: "telegram" is not a CTA key/],
      [(page) => { page.cta.primary.to = 'clips' }, /cta\.primary\.to: "clips" is not a CTA key/],
      [(page) => { page.hero.fork.to = 'brands' }, /hero\.fork\.to/],
      [(page) => { page.tools.cta.to = 'home' }, /tools\.cta\.to: "home" is not a CTA key/],
      [(page) => { page.tools.cta.text = ' ' }, /tools\.cta\.text: expected a non-empty string/],
      [(page) => { (page.tools.cta as Record<string, unknown>).href = '/tasks' }, /tools\.cta: unknown key "href"/],
    ]
    for (const [edit, message] of cases) {
      const page = showcase()
      edit(page)
      expect(landingProblems(page, HUB).join('\n'), String(message)).toMatch(message)
    }
  })

  it('refuses a misspelled key instead of dropping its content', () => {
    const page = showcase() as Record<string, any>
    page.setup.includes = page.setup.items
    delete page.setup.items
    expect(landingProblems(page, HUB).join('\n')).toMatch(/setup: unknown key "includes"[\s\S]*setup\.items: expected a list/)
    const tiles = showcase() as Record<string, any>
    tiles.features.items[0].icon = 'rocket'
    expect(landingProblems(tiles, HUB).join('\n')).toMatch(/features\.items\[0\]\.icon: "rocket" is not an icon/)
  })

  it('keeps the proof chips short and few', () => {
    const page = showcase()
    page.hero.proof = ['a', 'b', 'c', 'd', 'e']
    expect(landingProblems(page, HUB).join('\n')).toMatch(/hero\.proof: 5 items, expected 0 to 4/)
    page.hero.proof = ['Очень длинное доказательство, которое не помещается в один короткий чип']
    expect(landingProblems(page, HUB).join('\n')).toMatch(/hero\.proof\[0\]: \d+ characters, at most 48/)
  })
})

describe('placementProblems', () => {
  const md = (body: string) => `---\ntitle: x\n---\n\n${body}\n`

  it('accepts blocks placed once, each with its content', () => {
    expect(placementProblems(showcase(), md('Text.\n\n<LFlow />\n\n<LFeatures />\n\n<LSetup />\n\n<LTools :data="tools" />\n\n<LCatalog />'), HUB)).toEqual([])
    expect(placementProblems({ title: 'x' }, md('No blocks here.'), LEAF)).toEqual([])
  })

  it('refuses a block without its content, content without its block, and a block twice', () => {
    expect(placementProblems({}, md('<LFlow />'), LEAF)).toEqual(['<LFlow />: the frontmatter has no "flow" for it to show'])
    const { flow, ...noFlow } = showcase()
    expect(flow).toBeDefined()
    expect(placementProblems({ ...noFlow, flow }, md('<LFeatures />\n\n<LSetup />\n\n<LTools :data="tools" />'), HUB)).toEqual([
      'flow: set, but the Markdown never places <LFlow /> on a line of its own',
    ])
    expect(placementProblems({ setup: {} }, md('<LSetup />\n\nText.\n\n<LSetup />'), LEAF)).toEqual(['<LSetup />: placed 2 times; a block stands once on a page'])
    expect(placementProblems({ tools: { title: 'x' } }, md('Text.'), LEAF)).toEqual(['tools: set, but the Markdown never places <LTools :data="…" /> on a line of its own'])
    expect(placementProblems({ showcase: true }, md('<LCatalog />\n\n<LCatalog />'), HUB)).toEqual(['<LCatalog />: placed 2 times; a block stands once on a page'])
  })

  it('refuses a section catalogue anywhere but a showcase section index', () => {
    const message = /<LCatalog \/>: renders only on a showcase section index/
    expect(placementProblems({ showcase: true }, md('<LCatalog />'), HUB)).toEqual([])
    expect(placementProblems({}, md('<LCatalog />'), HUB).join('\n')).toMatch(message)
    expect(placementProblems({ showcase: true }, md('<LCatalog />'), LEAF).join('\n')).toMatch(message)
  })
})

describe('placesCatalog', () => {
  it('finds a catalogue the Markdown places, and only there', () => {
    expect(placesCatalog('---\ntitle: x\n---\n\nText.\n\n<LCatalog />\n')).toBe(true)
    expect(placesCatalog('---\ntitle: x\n---\n\nText.\n')).toBe(false)
    expect(placesCatalog('---\ntitle: "<LCatalog />"\n---\n\nText.\n')).toBe(false)
    expect(placesCatalog('Text.\n\n```md\n<LCatalog />\n```\n')).toBe(false)
    expect(placesCatalog('Text.\n\n    <LCatalog />\n')).toBe(false)
  })
})

describe('sourceProblems', () => {
  const page = (script: string, tag = '<LTools :data="tools" />') => `---\ntitle: x\n---\n\n<script setup>\n${script}\n</script>\n\nText.\n\n${tag}\n`
  const component = "import LTools from '../.vitepress/theme/landing/LTools.vue'"
  const data = (locale: string) => `import { data as tools } from '../.vitepress/tools.${locale}.data'`

  it('accepts a page that imports its language’s catalogue and the component and passes the one to the other', () => {
    expect(sourceProblems(page(`${component}\n${data('ru')}`), 'ru')).toEqual([])
    expect(sourceProblems(page(`${component}\n${data('en')}`), 'en')).toEqual([])
    expect(sourceProblems('No catalogue here.', 'ru')).toEqual([])
  })

  it('refuses a tag that would render as an unknown element, or render nothing', () => {
    expect(sourceProblems(page(data('ru')), 'ru').join('\n')).toMatch(/the page must import it/)
    expect(sourceProblems(page(component), 'ru').join('\n')).toMatch(/the page must import the catalogue of its language: .*tools\.ru\.data/)
    expect(sourceProblems(page(`${component}\n${data('ru')}`, '<LTools :data="catalogue" />'), 'ru').join('\n')).toMatch(/<LTools :data="tools" \/>/)
  })

  it('refuses a farm block placed without its import: it is no global component', () => {
    const blocks = "import LFlow from '../.vitepress/theme/landing/LFlow.vue'\nimport LFeatures from '../.vitepress/theme/landing/LFeatures.vue'\nimport LSetup from '../.vitepress/theme/landing/LSetup.vue'"
    const farm = (script: string) => `---\ntitle: x\n---\n\n<script setup>\n${script}\n</script>\n\nText.\n\n<LFlow />\n\n<LFeatures />\n\n<LSetup />\n\n<LCatalog />\n`
    expect(sourceProblems(farm(blocks), 'ru')).toEqual([])
    expect(sourceProblems(farm(blocks.split('\n').slice(1).join('\n')), 'en')).toEqual(["<LFlow>: the page must import it: import LFlow from '…/.vitepress/theme/landing/LFlow.vue'"])
    // A tag inside fenced code is an example, not a block.
    expect(sourceProblems('Text.\n\n```md\n<LSetup />\n```\n', 'ru')).toEqual([])
    expect(usesPageBlocks(showcase())).toBe(true)
    expect(usesPageBlocks({ tools: { title: 'x' } })).toBe(false)
  })

  // One loader per language (tools.ru.data.ts, tools.en.data.ts): each page downloads only its own cards.
  it('refuses another language’s cards, and a language the catalogue is not written in', () => {
    expect(sourceProblems(page(`${component}\n${data('ru')}`), 'en').join('\n')).toMatch(/imports the ru catalogue; import tools\.en\.data/)
    expect(sourceProblems(page(`${component}\n${data('uk')}`), 'uk').join('\n')).toMatch(/the catalogue has no uk cards/)
    // The old single loader of both languages is gone.
    expect(sourceProblems(page(`${component}\nimport { data as tools } from '../.vitepress/tools.data'`), 'ru').join('\n')).toMatch(/must import the catalogue of its language/)
    for (const locale of TOOL_LOCALES) expect(existsSync(join(import.meta.dirname, `tools.${locale}.data.ts`)), locale).toBe(true)
  })
})

describe('landingArt', () => {
  it('gives a showcase index its section’s drawing and a tile grid only the icons it names', () => {
    const art = landingArt(showcase(), { isHub: true, hub: 'farm' })
    expect(art?.hero).toBe(ART.farm)
    expect(Object.keys(art?.icons ?? {})).toEqual(['views'])
    expect(landingArt({ ...showcase(), showcase: false }, { isHub: true, hub: 'farm' })?.hero).toBeUndefined()
    expect(landingArt({ title: 'x' }, { isHub: true, hub: 'earnings' })).toBeNull()
    expect(landingArt(showcase(), { isHub: true, hub: 'earnings' })?.hero).toBeUndefined()
  })
})

describe('keepLandingFigures', () => {
  it('keeps an amount and its unit together in the blocks’ texts, and leaves the rest alone', () => {
    const page = showcase() as Record<string, any>
    page.flow.steps[0].darebay = 'вывод на кошелёк от 10 USDT, до 20 аккаунтов'
    // «Главное» too: at 768 px the third takeaway of /kontent-zavod/ broke «10 | USDT» (2026-09-30).
    page.hero.takeaways = ['<b>Учёт и выплаты.</b> Вывод на кошелёк от 10 USDT, пакет за 3 490 ₽']
    keepLandingFigures(page)
    expect(page.hero.proof[1]).toBe('Вывод на кошелёк от 10 USDT')
    expect(page.hero.takeaways[0]).toBe('<b>Учёт и выплаты.</b> Вывод на кошелёк от 10 USDT, пакет за 3 490 ₽')
    expect(page.flow.steps[0].darebay).toBe('вывод на кошелёк от 10 USDT, до 20 аккаунтов')
    expect(page.hero.kicker).toBe('Контент-завод')
  })

  it('drops the comments of the blocks’ texts, with the space written before one that punctuation follows', () => {
    // The hero prints its takeaways as raw HTML: «опыт от года <!-- source -->.» read «опыт от года .» (2026-09-30).
    const page = showcase() as Record<string, any>
    page.hero.takeaways = [
      '<b>В штат берут с опытом.</b> Просят опыт от года <!-- source: https://hh.ru/search/vacancy 2026-09-29 -->.',
      '<b>The threshold applies to every post</b> <!-- source: https://vyro.com/help 2026-09-05 -->: a clip at 4,900 views earns nothing',
      'Meta averages $13.48 <!-- source: https://example.com/a 2026-09-04 --> <!-- source: https://example.com/b 2026-09-04 -->, TikTok less',
      'A claim <!-- source: https://example.com/c 2026-09-04 --> and the next word',
    ]
    page.cta.lede = 'Вывод от 10 USDT <!-- source: https://darebay.com/wallet 2026-09-29 -->.'
    keepLandingFigures(page, 'ru')
    expect(page.hero.takeaways).toEqual([
      '<b>В штат берут с опытом.</b> Просят опыт от года.',
      '<b>The threshold applies to every post</b>: a clip at 4,900 views earns nothing',
      'Meta averages $13.48, TikTok less',
      'A claim  and the next word',
    ])
    expect(page.cta.lede).toBe('Вывод от 10\u00a0USDT.')
  })

  it('binds a Russian block title’s short words to the next one, and leaves other languages and texts alone', () => {
    const ru = showcase() as Record<string, any>
    ru.cta.title = 'Запусти завод на DareBay'
    ru.flow.steps[0].title = 'Ролики и аккаунты'
    keepLandingFigures(ru, 'ru')
    expect(ru.cta.title).toBe('Запусти завод на\u00a0DareBay')
    expect(ru.flow.steps[0].title).toBe('Ролики и\u00a0аккаунты')
    expect(ru.flow.steps[0].text).toBe('Ролики по одной теме.')
    const en = showcase() as Record<string, any>
    en.cta.title = 'Launch on DareBay'
    keepLandingFigures(en, 'en')
    expect(en.cta.title).toBe('Launch on DareBay')
  })
})
