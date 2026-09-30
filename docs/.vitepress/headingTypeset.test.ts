import { beforeAll, describe, expect, it } from 'vitest'
import { createMarkdownRenderer } from 'vitepress'
import { installHeadingTypesetRule } from './headingTypeset'

// The renderer VitePress builds with, headers on as the site has them: its anchor rule has made the
// ids before this rule runs, and the outline reads the headings after it.
let md: Awaited<ReturnType<typeof createMarkdownRenderer>>
beforeAll(async () => {
  md = await createMarkdownRenderer('docs', { headers: { level: [2] } }, '/')
  installHeadingTypesetRule(md as unknown as Parameters<typeof installHeadingTypesetRule>[0])
})
const render = (body: string, relativePath: string) => {
  const env: Record<string, unknown> = { relativePath, path: `/docs/${relativePath}`, cleanUrls: true }
  return { html: md.render(body, env), headers: (env.headers ?? []) as { title: string; slug: string }[] }
}
const NBSP = ' '

describe('Russian heading typesetting', () => {
  it('binds a short word to the next and keeps a compound whole, with the id it had', () => {
    const { html, headers } = render('## Кто платит за ролики контент-завода и для кого\n\nТекст про контент-завод и рилс.', 'kontent-zavod/a.md')
    expect(html).toContain(`>Кто платит за${NBSP}ролики <span class="lp-nw">контент-завода</span> и${NBSP}для${NBSP}кого <a class="header-anchor"`)
    // The id comes from the heading as written; the paragraph is not a heading and stays as it was.
    expect(html).toMatch(/<h2 id="кто-платит-за-ролики-контент-завода-и-для-кого"/)
    expect(html).toContain('<p>Текст про контент-завод и рилс.</p>')
    expect(headers.map((header) => header.slug)).toEqual(['кто-платит-за-ролики-контент-завода-и-для-кого'])
  })

  it('leaves other languages and inline markup alone', () => {
    expect(render('## A content-farm for you', 'en/content-farm/a.md').html).toContain('>A content-farm for you <a class="header-anchor"')
    expect(render('### Сколько `стоит` в месяц?', 'instrumenty/a.md').html).toContain(`>Сколько <code>стоит</code> в${NBSP}месяц? <a class="header-anchor"`)
  })
})
