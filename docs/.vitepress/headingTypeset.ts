// Russian typesetting of the page's Markdown headings, at render time (config.ts `markdown.config`).
//
// A heading that leaves a short preposition or conjunction at a line's end («Кто платит за ролики
// контент- | завода?», «…для | рилс») reads as a mistake (review 2026-09-30). The same rule as the
// hero's H1 (`headingHtml` in theme/landing/copy.ts): a short word is bound to the next one by a
// no-break space, and a hyphenated compound stays on one line together with the short words and the
// punctuation bound to it (`.lp-nw`, `COMPOUND`). Display only, and applied after the anchor rule, so
// every heading keeps the id and the outline title it had; the Markdown source, which the linters and
// the FAQPage answers read, stays as written.
import { COMPOUND, keepShortWords } from './theme/landing/copy.ts'
import { localeFromPath } from './sources.ts'

interface HeadingToken {
  readonly type: string
  content: string
  children: HeadingToken[] | null
}

interface HeadingState {
  readonly tokens: HeadingToken[]
  readonly env?: { readonly relativePath?: string; readonly path?: string }
  readonly Token: new (type: string, tag: string, nesting: number) => HeadingToken
}

interface MarkdownParser {
  readonly core: { readonly ruler: { push(name: string, rule: (state: HeadingState) => void): void } }
}

/** One text token as the tokens it becomes: short words bound, each compound wrapped unbreakable with what binds to it (`COMPOUND`). */
function typeset(token: HeadingToken, Token: HeadingState['Token']): HeadingToken[] {
  const text = keepShortWords(token.content, 'ru')
  const out: HeadingToken[] = []
  const push = (type: string, content: string) => {
    if (!content) return
    const next = new Token(type, '', 0)
    next.content = content
    out.push(next)
  }
  let last = 0
  for (const match of text.matchAll(COMPOUND)) {
    push('text', text.slice(last, match.index))
    push('html_inline', '<span class="lp-nw">')
    push('text', match[0])
    push('html_inline', '</span>')
    last = match.index! + match[0].length
  }
  push('text', text.slice(last))
  return out
}

export function installHeadingTypesetRule(md: MarkdownParser): void {
  md.core.ruler.push('lp_heading_typeset', (state) => {
    const env = state.env ?? {}
    if (localeFromPath(env.relativePath ?? env.path ?? '') !== 'ru') return
    const tokens = state.tokens
    for (let index = 0; index < tokens.length; index++) {
      if (tokens[index].type !== 'heading_open') continue
      const inline = tokens[index + 1]
      if (inline?.type !== 'inline' || !inline.children) continue
      inline.children = inline.children.flatMap((child) => (child.type === 'text' ? typeset(child, state.Token) : [child]))
    }
  })
}
