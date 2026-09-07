import { describe, expect, it } from 'vitest'
import { installTableWrapRule, TABLE_WRAP_CLASS } from './tableWrap'

const rendererWith = (rules: Record<string, unknown> = {}) => ({ renderer: { rules } })
const self = { renderToken: (_tokens: readonly unknown[], _index: number, _options: unknown) => '<table>' }

describe('Markdown table scroll wrapper', () => {
  it('wraps the table VitePress would have rendered, keeping its own attributes', () => {
    // VitePress adds `tabindex="0"` through its own table_open rule; the wrapper must not drop it.
    const md = rendererWith({ table_open: () => '<table tabindex="0">' })

    installTableWrapRule(md)

    expect(md.renderer.rules.table_open!([], 0, {}, {}, self)).toBe(
      `<div class="${TABLE_WRAP_CLASS}"><table tabindex="0">`
    )
    expect(md.renderer.rules.table_close!([], 0, {}, {}, self)).toBe('<table></div>')
  })

  it('falls back to the default token rendering when no table rule is installed', () => {
    const md = rendererWith()

    installTableWrapRule(md)

    expect(md.renderer.rules.table_open!([], 0, {}, {}, self)).toBe(
      `<div class="${TABLE_WRAP_CLASS}"><table>`
    )
  })

})
