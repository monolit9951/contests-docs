import { describe, expect, it } from 'vitest'
import { articleContents, navigationCurrent } from './navigation'

describe('registry navigation current state', () => {
  it('distinguishes a hub itself from a page inside that hub', () => {
    expect(navigationCurrent('/ua/dopomoha/', 'ua/dopomoha/index.md')).toBe('page')
    expect(navigationCurrent('/ua/dopomoha/', 'ua/dopomoha/yak-pratsiuie.md')).toBe('location')
    expect(navigationCurrent('/en/help/', 'en/helpful.md')).toBeUndefined()
  })

  it('does not mark unrelated pages or external product links current', () => {
    expect(navigationCurrent('/', 'zarabotok/index.md')).toBeUndefined()
    expect(navigationCurrent('https://darebay.com/en', 'en/index.md')).toBeUndefined()
    expect(navigationCurrent('//darebay.com/en', 'en/index.md')).toBeUndefined()
  })

  it('recognizes clean URLs and the locale root without inventing slugs', () => {
    expect(navigationCurrent('/en/help/example#part', 'en/help/example.md')).toBe('page')
    expect(navigationCurrent('/en/', 'en/index.md')).toBe('page')
    expect(navigationCurrent('/', 'index.md')).toBe('page')
  })
})

describe('article contents', () => {
  it('uses real level-two fragments verbatim and ignores deep or external entries', () => {
    expect(articleContents([
      { level: 2, title: 'Сколько платят', link: '#сколько-платят', children: [{ level: 3, title: 'Detail', link: '#detail' }] },
      { level: 2, title: 'Custom ID', link: '#facts' },
      { level: 2, title: 'Repeated', link: '#facts' },
      { level: 2, title: 'External', link: '/other' },
      { level: 2, title: 'Empty fragment', link: '#' },
    ])).toEqual([
      { title: 'Сколько платят', link: '#сколько-платят' },
      { title: 'Custom ID', link: '#facts' },
    ])
  })

  it('finds level-two headings nested under a parent and handles heading-free pages', () => {
    expect(articleContents([{ level: 1, title: 'Title', link: '#title', children: [{ level: 2, title: 'Section', link: '#section' }] }])).toEqual([{ title: 'Section', link: '#section' }])
    expect(articleContents([])).toEqual([])
  })
})
