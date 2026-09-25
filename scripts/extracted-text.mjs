// What a reader who does not look at the page gets from it: copied text, a screen reader, an HTML-to-
// text converter, an answer engine quoting a comparison. Pure functions over the BUILT HTML, which
// `dist-seo-gates.mjs` applies to `dist`.
//
// Three invariants, each of which shipped broken while every page looked right:
//
//  1. A SOURCE MARKER IS "[n]" SET APART FROM THE FIGURE. A superscript is only paint: extracted,
//     "$1–$4 per 1,000 views" followed by a raised 1 became "$1–$4 per 1,000 views1". Every marker —
//     `<sup class="lp-ref">` in a comparison table, `<sup class="src-ref">` in an article — is a hair
//     space (U+200A) and one link reading "[n]". A table's source link sits inside such a marker, no
//     table cell's text runs a digit into "[n]", and every item of an article's Sources list opens
//     with its own "[n]" as text, because the list's CSS marker is not text and the article's "[n]"
//     has to point at something a converter keeps.
//
//  2. A TABLE NUMBER HAS ONE MEANING. A table cell's "[n]" is that platform's n-th source; "How this
//     comparison was built" prints the same list as "Name [n]" (`methodSources` in platforms.ts). Every
//     number in a table row must be there, under that platform's name, opening the same address.
//     Before 2026-09-24 the list printed no numbers at all, so read as text a table's "[1]" pointed at
//     the article's Sources item 1, a different source.
//
//  3. NO TWO WORDS GLUED ACROSS AN ELEMENT. Vue drops the whitespace between two elements written on
//     separate lines, so a state chip ran into its value ("yesyes: the budget is held…"), a platform
//     name into its "best for" line, a source address into its date ("…/campaign-9052026-09-18").
//     Checked inside the blocks that carry the comparison's figures (`TEXT_REGIONS`); the site chrome
//     (menus, the hero's meta line) is outside this gate.

// U+200A as the build writes it (Vue decodes the template's `&#8202;`), or still as an entity.
const HAIR_SPACE = String.raw`(?:\u200a|&#8202;|&#x200a;)`

/** Markup only: no scripts, styles or comments (Vue's `<!--[-->` fragment anchors are not text). */
const markupOnly = (html) =>
  html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

const classesOf = (attrs) => (attrs.match(/\bclass\s*=\s*"([^"]*)"/i)?.[1] ?? '').split(/\s+/).filter(Boolean)
const hrefOf = (attrs) => attrs.match(/\bhref\s*=\s*"([^"]*)"/i)?.[1]
const clip = (value, length = 140) => (value.length > length ? `${value.slice(0, length)}…` : value)

/** Invariant 1: the shape of every source marker and of every Sources list item. */
export function sourceMarkerFindings(html) {
  const markup = markupOnly(html)
  const findings = []

  const marker = new RegExp(`^${HAIR_SPACE}<a\\b[^>]*>\\[[1-9]\\d*\\]</a>$`, 'i')
  const sourceLinksIn = (fragment) => [...fragment.matchAll(/<a\b([^>]*)>/gi)].filter(([, attrs]) => classesOf(attrs).includes('lp-src')).length
  // Two separate questions: is each marker the right shape, and is every table source link inside
  // one. A malformed marker is reported once, as a marker, not again as a link outside a marker.
  let anchoredSources = 0
  for (const [whole, attrs, inner] of markup.matchAll(/<sup\b([^>]*)>([\s\S]*?)<\/sup>/gi)) {
    const classes = classesOf(attrs)
    if (!classes.includes('lp-ref') && !classes.includes('src-ref')) continue
    if (!marker.test(inner)) findings.push(`source marker is not a hair space and one "[n]" link: ${clip(whole)}`)
    if (classes.includes('lp-ref')) anchoredSources += sourceLinksIn(inner)
  }
  const sourceLinks = sourceLinksIn(markup)
  if (sourceLinks !== anchoredSources) {
    findings.push(`${sourceLinks - anchoredSources} table source link(s) outside a <sup class="lp-ref"> marker`)
  }

  // The same promise read off the text itself, whatever markup produced it: in a comparison table no
  // figure runs into a source number, "10[1]" or "$1–$10[1]".
  for (const [, table] of markup.matchAll(/<table\b[^>]*\bclass="[^"]*\blp-table\b[^"]*"[^>]*>([\s\S]*?)<\/table>/gi)) {
    for (const [, cell] of table.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
      const text = decode(cell.replace(/<[^>]*>/g, ''))
      if (/\d\[\d/.test(text)) findings.push(`a figure runs into a source number in a table cell: ${clip(text.trim())}`)
    }
  }

  for (const [, list] of markup.matchAll(/<ol\b[^>]*\bclass="[^"]*\bdb-sources-list\b[^"]*"[^>]*>([\s\S]*?)<\/ol>/gi)) {
    const items = [...list.matchAll(/<li\b[^>]*\bid="src-(\d+)"[^>]*>([\s\S]*?)<\/li>/gi)]
    items.forEach(([, id, inner], index) => {
      if (Number(id) !== index + 1) findings.push(`Sources list item ${index + 1} carries id src-${id}`)
      if (!inner.startsWith(`<span class="src-n">[${id}]</span> `)) {
        findings.push(`Sources list item src-${id} does not open with its number as text: ${clip(inner)}`)
      }
    })
  }
  return findings
}

/** Invariant 2: every "[n]" in a comparison table is "Name [n]", same address, in the method list. */
export function tableNumberingFindings(html) {
  const markup = markupOnly(html)
  const findings = []
  const key = (name, n) => `${name}\u0000${n}`

  const listed = new Map()
  for (const [, section] of markup.matchAll(/<section\b[^>]*\bid="method"[^>]*>([\s\S]*?)<\/section>/gi)) {
    for (const [, item] of section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
      const name = item.match(/<b\b[^>]*>([^<]*)<\/b>/i)?.[1]
      const n = item.match(/<span class="src-n">\[(\d+)\]<\/span>/)?.[1]
      const link = item.match(/<a\b([^>]*)>/i)
      const href = link ? hrefOf(link[1]) : undefined
      if (name === undefined || n === undefined || href === undefined) {
        findings.push(`"How this comparison was built" entry without a name, a "[n]" and a link: ${clip(item)}`)
        continue
      }
      listed.set(key(name, n), href)
    }
  }

  // Found by class list, not by the literal tag: a scoped-style attribute or a second class on the
  // <sup> must not switch this check off.
  const cellMarker = new RegExp(`<sup\\b([^>]*)>${HAIR_SPACE}<a\\b([^>]*)>\\[(\\d+)\\]</a></sup>`, 'gi')
  for (const [, table] of markup.matchAll(/<table\b[^>]*\bclass="[^"]*\blp-table\b[^"]*"[^>]*>([\s\S]*?)<\/table>/gi)) {
    for (const [, row] of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const markers = [...row.matchAll(cellMarker)].filter(([, supAttrs]) => classesOf(supAttrs).includes('lp-ref')).map(([whole, , attrs, n]) => [whole, attrs, n])
      if (!markers.length) continue
      const name = row.match(/<td class="lp-cell-name"><a\b[^>]*>([^<]*)<\/a>/i)?.[1]
      if (name === undefined) {
        findings.push(`table row with source numbers but no platform name: ${clip(row)}`)
        continue
      }
      for (const [, attrs, n] of markers) {
        const href = hrefOf(attrs)
        const entry = listed.get(key(name, n))
        if (entry === undefined) findings.push(`${name} [${n}] in the table is not "${name} [${n}]" in "How this comparison was built"`)
        else if (entry !== href) findings.push(`${name} [${n}] opens ${href} in the table but ${entry} in "How this comparison was built"`)
      }
    }
  }
  return findings
}

/** The blocks whose text is the comparison's figures: tables, cards, sources, method, calculators. */
export const TEXT_REGIONS = Object.freeze(['lp-table', 'lp-card-grid', 'lp-card-foot', 'lp-method', 'lp-calc', 'db-sources'])

// Elements that do not break a line of extracted text (HTML's phrasing content). Everything else —
// a cell, a list item, a paragraph, a <br> — does, and text on either side of it is not glued.
const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'button', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'img', 'input', 'kbd', 'label', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var'])
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decode = (text) =>
  text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi, (_, dec, hex, name) =>
    dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : ENTITY[name.toLowerCase()]
  )
// A join is a problem when a word or a figure meets a word or a figure: "yes" + "yes:", "905" +
// "2026", ")" + "Updated". A closing quote or bracket counts on the left, an opening one or a
// currency sign on the right.
const ENDS_WORD = /[\p{L}\p{N}\p{M})\]%:;,.!?"”’]$/u
const STARTS_WORD = /^[\p{L}\p{N}(\[$₹€£¥"“]/u

/** Invariant 3: text on both sides of an inline element boundary, with no whitespace between. */
export function gluedTextFindings(html) {
  const findings = []
  const open = []
  let regions = 0
  let previous = ''
  let crossedInline = false
  let crossedBlock = false
  const tokens = /<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g
  for (const [, closing, rawTag, attrs = '', rawText] of markupOnly(html).matchAll(tokens)) {
    if (rawText !== undefined) {
      const text = decode(rawText)
      if (!text.trim()) {
        // Whitespace — a hair space included — separates whatever comes next.
        previous = ' '
      } else {
        if (regions && crossedInline && !crossedBlock && ENDS_WORD.test(previous) && STARTS_WORD.test(text)) {
          findings.push(`"${previous.trim().slice(-32)}" runs into "${text.trim().slice(0, 32)}"`)
        }
        previous = text
      }
      crossedInline = crossedBlock = false
      continue
    }
    const tag = rawTag.toLowerCase()
    if (closing) {
      const index = open.map((element) => element.tag).lastIndexOf(tag)
      if (index >= 0) for (const element of open.splice(index)) if (element.region) regions--
    } else if (!VOID.has(tag) && !/\/\s*$/.test(attrs)) {
      const region = classesOf(attrs).some((name) => TEXT_REGIONS.includes(name))
      open.push({ tag, region })
      if (region) regions++
    }
    if (INLINE.has(tag)) crossedInline = true
    else crossedBlock = true
  }
  return findings
}
