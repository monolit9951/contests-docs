const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1]

export const parseHreflangCluster = (html, expectedOrigin = 'https://darebay.com') => {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0])
  const entries = links
    .filter((tag) => (attr(tag, 'rel') ?? '').split(/\s+/).includes('alternate') && attr(tag, 'hreflang'))
    .map((tag) => ({ hreflang: attr(tag, 'hreflang'), href: attr(tag, 'href') }))
  const map = new Map()
  const nonDefaultHrefs = new Set()
  const pairs = new Set()
  const errors = []

  for (const entry of entries) {
    if (!entry.href) {
      errors.push(`${entry.hreflang}: href missing`)
      continue
    }
    let url
    try {
      url = new URL(entry.href)
    } catch {
      errors.push(`${entry.hreflang}: invalid href ${entry.href}`)
      continue
    }
    if (url.origin !== expectedOrigin || url.username || url.password || url.hash) {
      errors.push(`${entry.hreflang}: off-origin/invalid href ${entry.href}`)
      continue
    }
    const normalized = url.href
    const pair = `${entry.hreflang}\u0000${normalized}`
    if (pairs.has(pair)) errors.push(`${entry.hreflang}: duplicate pair ${normalized}`)
    pairs.add(pair)
    if (map.has(entry.hreflang)) errors.push(`${entry.hreflang}: duplicate hreflang`)
    if (entry.hreflang !== 'x-default' && nonDefaultHrefs.has(normalized)) {
      errors.push(`${entry.hreflang}: duplicate non-default href ${normalized}`)
    }
    if (entry.hreflang !== 'x-default') nonDefaultHrefs.add(normalized)
    map.set(entry.hreflang, normalized)
  }

  return { entries, map, errors }
}

export const sameHreflangMap = (left, right) => {
  if (left.size !== right.size) return false
  for (const [language, href] of left) if (right.get(language) !== href) return false
  return true
}
