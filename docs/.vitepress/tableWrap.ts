type RenderRule = (
  tokens: readonly unknown[],
  index: number,
  options: unknown,
  env: unknown,
  self: MarkdownRendererSelf
) => string

interface MarkdownRendererSelf {
  renderToken(tokens: readonly unknown[], index: number, options: unknown): string
  renderAttrs?(token: unknown): string
}

interface MarkdownRenderer {
  readonly renderer: {
    readonly rules: Record<string, RenderRule | undefined>
  }
}

/** The part of a markdown-it token the table labels read and write. */
interface TableToken {
  readonly type: string
  readonly content: string
  readonly children: readonly TableToken[] | null
  meta: unknown
  attrSet(name: string, value: string): void
}

interface MarkdownParser {
  readonly core: {
    readonly ruler: { push(name: string, rule: (state: { readonly tokens: readonly TableToken[] }) => void): void }
  }
}

export const TABLE_WRAP_CLASS = 'lp-md-table'
/** The wrapper of a table a phone reads as a stack of row cards (`installTableLabelRule`). */
export const TABLE_STACK_CLASS = 'lp-md-stack'
/** A row that names a group of the rows under it: a label in its first cell, every other cell empty. */
export const TABLE_GROUP_CLASS = 'lp-md-group'

const renderTokenAsIs: RenderRule = (tokens, index, options, _env, self) =>
  self.renderToken(tokens, index, options)

/**
 * Wraps every Markdown table in its own scroll box.
 *
 * A wide table has to scroll sideways on a phone, and the obvious CSS shortcut for that is
 * `display: block; overflow-x: auto` on the <table> itself. That turns thead and tbody into
 * separate anonymous table boxes, each with its own column-width algorithm, so the header labels
 * stop lining up with the cells underneath them — which is exactly what shipped on the
 * country-by-country tables. The overflow therefore belongs to a wrapper element and the table
 * stays one real table; `.lp-md-table` in landing.css styles the pair.
 */
export function installTableWrapRule(md: MarkdownRenderer): void {
  const rules = md.renderer.rules
  const renderOpen = rules.table_open ?? renderTokenAsIs
  const renderClose = rules.table_close ?? renderTokenAsIs
  rules.table_open = (tokens, index, options, env, self) => {
    const token = tokens[index] as { meta?: { stack?: boolean } | null } | undefined
    const table = renderOpen(tokens, index, options, env, self)
    // VitePress prints `<table tabindex="0">` whatever the token carries: its own attributes
    // (`installTableLabelRule`'s role) go back in here.
    const attrs = token && self.renderAttrs ? self.renderAttrs(token) : ''
    const wrapper = token?.meta?.stack ? `${TABLE_WRAP_CLASS} ${TABLE_STACK_CLASS}` : TABLE_WRAP_CLASS
    return `<div class="${wrapper}">${attrs && !table.includes(attrs) ? table.replace(/^<table\b/, `<table${attrs}`) : table}`
  }
  rules.table_close = (tokens, index, options, env, self) =>
    `${renderClose(tokens, index, options, env, self)}</div>`
}

/** The attribute a stacked cell reads its column's name from (landing.css, `::before`). */
export const TABLE_LABEL_ATTRIBUTE = 'data-label'

/** A header cell as plain text: what its inline Markdown prints, without markup or comments. */
const plainText = (inline: TableToken | undefined): string =>
  (inline?.children ?? [])
    .map((child) => (child.type === 'text' || child.type === 'code_inline' ? child.content : child.type === 'softbreak' ? ' ' : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Lets a phone read a table of three or more columns as a stack of cards, one per row.
 *
 * At 390 px a comparison of four or five columns showed half of itself, and the column cut off was
 * always the one that sold: DareBay's, last by the listicle rule, or the price and the payment of a
 * tools stack (review 2026-09-30). Below 641 px landing.css now lays each row of such a table out as
 * a card: the first cell is its title, every other cell is preceded by its column's name. CSS cannot
 * read a header's text, so this rule copies it onto the cells (`data-label`) and marks the table for
 * its wrapper (`TABLE_STACK_CLASS`, written by `installTableWrapRule`). `display: block` takes the
 * table semantics away in some browsers, so a stacked table carries its ARIA roles explicitly. A
 * table of one or two columns fits a phone as it is and stays a table: it costs no byte it does not
 * need.
 *
 * A row that only names a group (`| **Озвучка в браузере** | | | |`) is marked too
 * (`TABLE_GROUP_CLASS`): it reads as a subheading, not as a data row beside empty cells.
 */
export function installTableLabelRule(md: MarkdownParser): void {
  md.core.ruler.push('lp_table_labels', (state) => {
    const tokens = state.tokens
    for (let open = 0; open < tokens.length; open++) {
      if (tokens[open].type !== 'table_open') continue
      let close = open + 1
      while (close < tokens.length && tokens[close].type !== 'table_close') close++
      const labels: string[] = []
      let inHead = false
      for (let index = open + 1; index < close; index++) {
        const type = tokens[index].type
        if (type === 'thead_open') inHead = true
        else if (type === 'thead_close') inHead = false
        else if (inHead && type === 'th_open') labels.push(plainText(tokens[index + 1]))
      }
      const stack = labels.length >= 3
      if (stack) {
        tokens[open].meta = { ...(tokens[open].meta as object | null), stack: true }
        tokens[open].attrSet('role', 'table')
      }
      let row: TableToken | null = null
      let cells: string[] = []
      for (let index = open + 1; index < close; index++) {
        const token = tokens[index]
        if (token.type === 'thead_open' || token.type === 'tbody_open') {
          if (stack) token.attrSet('role', 'rowgroup')
        } else if (token.type === 'tr_open') {
          row = token
          cells = []
          if (stack) token.attrSet('role', 'row')
        } else if (token.type === 'th_open') {
          if (stack) token.attrSet('role', 'columnheader')
        } else if (token.type === 'td_open') {
          const column = cells.length
          if (stack) {
            token.attrSet('role', 'cell')
            if (column > 0 && labels[column]) token.attrSet(TABLE_LABEL_ATTRIBUTE, labels[column])
          }
          cells.push((tokens[index + 1]?.content ?? '').trim())
        } else if (token.type === 'tr_close') {
          if (row && cells.length > 1 && cells[0] && cells.slice(1).every((cell) => !cell)) row.attrSet('class', TABLE_GROUP_CLASS)
          row = null
        }
      }
      open = close
    }
  })
}
