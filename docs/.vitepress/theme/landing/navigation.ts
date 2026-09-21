import type { Locale } from '../../registry'

export const NAVIGATION_COPY: Record<Locale, { site: string; contents: string }> = {
  ru: { site: 'На сайт', contents: 'В статье' },
  uk: { site: 'На сайт', contents: 'У статті' },
  en: { site: 'Open site', contents: 'In this article' },
  ar: { site: 'إلى الموقع', contents: 'في هذا المقال' },
}

/** The source path is stable during SSR; a section is current only at its path boundary. */
export function navigationCurrent(link: string, relativePath: string): 'page' | 'location' | undefined {
  if (!link.startsWith('/') || link.startsWith('//')) return undefined
  const normalize = (path: string) => `/${path.split(/[?#]/, 1)[0]
    .replace(/^\/+/, '').replace(/(?:^|\/)index\.md$/, '').replace(/\.(?:md|html)$/, '').replace(/\/+$/, '')}`
  const target = normalize(link)
  const current = normalize(relativePath)
  if (current === target) return 'page'
  if (target !== '/' && current.startsWith(`${target}/`)) return 'location'
  return undefined
}

interface OutlineHeader {
  level: number
  title: string
  link: string
  children?: OutlineHeader[]
}

/** Keep VitePress's generated fragment, including custom IDs and non-Latin slugs. */
export function articleContents(headers: readonly OutlineHeader[]) {
  const seen = new Set<string>()
  const items: { title: string; link: string }[] = []
  const visit = (entries: readonly OutlineHeader[]) => {
    for (const header of entries) {
      if (header.level === 2 && header.link.startsWith('#') && header.link.length > 1 && !seen.has(header.link)) {
        seen.add(header.link)
        items.push({ title: header.title, link: header.link })
      }
      if (header.children) visit(header.children)
    }
  }
  visit(headers)
  return items
}
