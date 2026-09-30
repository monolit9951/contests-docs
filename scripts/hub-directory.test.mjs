import { describe, expect, it } from 'vitest'
import { hubDirectoryFinding, listsSection, sectionCatalogues } from './hub-directory.mjs'

const PAGES = [
  { id: 'farm-hub', hub: 'farm', slugs: { ru: '', en: '' } },
  { id: 'farm-what-is', hub: 'farm', slugs: { ru: 'chto-takoe', en: 'what-is' } },
  { id: 'tools-hub', hub: 'tools', slugs: { ru: '', en: '' } },
  { id: 'tools-ru-only', hub: 'tools', slugs: { ru: 'ozvuchka' } },
]
const catalogue = '<section class="hub-directory" aria-labelledby="catalog-farm-title" data-v-1a2b3c><h2>Все материалы</h2></section>'

describe('the hub-directory gate', () => {
  it('counts the section catalogues by their own class, whatever else the tag carries', () => {
    expect(sectionCatalogues(`<main>${catalogue}</main>`)).toBe(1)
    expect(sectionCatalogues(`<main>${catalogue}${catalogue}</main>`)).toBe(2)
    // The class in a stylesheet or on another element is not a catalogue.
    expect(sectionCatalogues('<div class="hub-directory"></div><p>.hub-directory{}</p>')).toBe(0)
  })

  it('expects one catalogue on a hub index with an article in its language, none anywhere else', () => {
    expect(listsSection(PAGES[0], 'ru', PAGES)).toBe(true)
    expect(listsSection(PAGES[1], 'ru', PAGES)).toBe(false)
    expect(listsSection(PAGES[2], 'ru', PAGES)).toBe(true)
    expect(listsSection(PAGES[2], 'en', PAGES)).toBe(false)
  })

  it('reports a section listed twice, a hub that lists nothing, and a leaf that lists its section', () => {
    expect(hubDirectoryFinding(`<main>${catalogue}</main>`, PAGES[0], 'ru', PAGES)).toBeNull()
    expect(hubDirectoryFinding(`<main>${catalogue}${catalogue}</main>`, PAGES[0], 'ru', PAGES)).toBe('2 section catalogue(s), expected 1')
    expect(hubDirectoryFinding('<main></main>', PAGES[0], 'en', PAGES)).toBe('0 section catalogue(s), expected 1')
    expect(hubDirectoryFinding(`<main>${catalogue}</main>`, PAGES[1], 'ru', PAGES)).toBe('1 section catalogue(s), expected 0')
    expect(hubDirectoryFinding('<main></main>', PAGES[2], 'en', PAGES)).toBeNull()
  })
})
