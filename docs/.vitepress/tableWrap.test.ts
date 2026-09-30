import { beforeAll, describe, expect, it } from 'vitest'
import { createMarkdownRenderer } from 'vitepress'
import { installTableLabelRule, installTableWrapRule, TABLE_GROUP_CLASS, TABLE_STACK_CLASS, TABLE_WRAP_CLASS } from './tableWrap'

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

describe('Markdown table labels for a phone', () => {
  // The renderer VitePress builds with: its own table_open prints `<table tabindex="0">` and drops
  // the token's attributes, which is exactly what the wrapper has to put back.
  let md: Awaited<ReturnType<typeof createMarkdownRenderer>>
  beforeAll(async () => {
    md = await createMarkdownRenderer('docs', {}, '/')
    installTableWrapRule(md as unknown as Parameters<typeof installTableWrapRule>[0])
    installTableLabelRule(md as unknown as Parameters<typeof installTableLabelRule>[0])
  })

  it('gives each cell of a wide table its column’s name, the first cell none, and marks it for stacking', () => {
    const html = md.render(['| Этап | **Сервис** | Цена на 29.09.2026<!-- source: https://example.com 2026-09-29 --> | `Оплата` |', '|---|---|---|---|', '| Монтаж | VN | бесплатно | не нужна |', '| **Голос** | | | |', '| Озвучка | TTSMaker | бесплатно | не нужна |'].join('\n'))
    expect(html).toContain(`<div class="${TABLE_WRAP_CLASS} ${TABLE_STACK_CLASS}"><table role="table" tabindex="0">`)
    expect(html).toContain('<thead role="rowgroup">')
    expect(html).toContain('<th role="columnheader">Этап</th>')
    expect(html).toContain('<tr role="row">\n<td role="cell">Монтаж</td>\n<td role="cell" data-label="Сервис">VN</td>\n<td role="cell" data-label="Цена на 29.09.2026">бесплатно</td>\n<td role="cell" data-label="Оплата">не нужна</td>\n</tr>')
    for (const label of ['Сервис', 'Цена на 29.09.2026', 'Оплата']) expect(html.match(new RegExp(`data-label="${label}"`, 'g')), label).toHaveLength(3)
    expect(html).not.toContain('data-label="Этап"')
    // The row that only names a group reads as a subheading; a data row does not.
    expect(html).toContain(`<tr role="row" class="${TABLE_GROUP_CLASS}">\n<td role="cell"><strong>Голос</strong></td>`)
    expect(html.match(new RegExp(TABLE_GROUP_CLASS, 'g'))).toHaveLength(1)
  })

  it('leaves a table of two columns a table: it fits a phone, and only a group row is marked', () => {
    const html = md.render(['| Вопрос | Ответ |', '|---|---|', '| Можно? | Да |', '| **Ещё** | |'].join('\n'))
    expect(html).toContain(`<div class="${TABLE_WRAP_CLASS}"><table tabindex="0">`)
    expect(html).not.toMatch(/data-label|role=|lp-md-stack/)
    expect(html).toContain(`<tr class="${TABLE_GROUP_CLASS}">`)
  })
})
