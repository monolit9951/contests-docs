type RenderRule = (
  tokens: readonly unknown[],
  index: number,
  options: unknown,
  env: unknown,
  self: MarkdownRendererSelf
) => string

interface MarkdownRendererSelf {
  renderToken(tokens: readonly unknown[], index: number, options: unknown): string
}

interface MarkdownRenderer {
  readonly renderer: {
    readonly rules: Record<string, RenderRule | undefined>
  }
}

export const TABLE_WRAP_CLASS = 'lp-md-table'

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
  rules.table_open = (tokens, index, options, env, self) =>
    `<div class="${TABLE_WRAP_CLASS}">${renderOpen(tokens, index, options, env, self)}`
  rules.table_close = (tokens, index, options, env, self) =>
    `${renderClose(tokens, index, options, env, self)}</div>`
}
