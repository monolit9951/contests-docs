interface MarkdownToken {
  readonly type: string
  readonly tag: string
  readonly content: string
}

interface MarkdownState {
  readonly tokens: MarkdownToken[]
}

interface MarkdownRenderer {
  readonly core: {
    readonly ruler: {
      after(afterName: string, ruleName: string, rule: (state: MarkdownState) => void): void
    }
  }
}

const COVER_CLASS = /\bclass=(['"])[^'"]*\bdocs-cover\b[^'"]*\1/

/**
 * Every page is rendered by the landing shell, whose hero owns the page's visible and semantic H1
 * (from the frontmatter title). The Markdown keeps its `# Title` as the source of truth for
 * editors and for anything that reads the raw file, but rendering it too would leave crawlers with
 * two primary headings (dist gate: exactly one h1). So the FIRST Markdown H1 is removed from the
 * token stream, and any legacy `docs-cover` HTML block (the old hub-page cover that carried its
 * own <h1>) is removed with it. A second Markdown H1 is left alone on purpose: that is an
 * authoring mistake the dist gate must surface, not something to hide.
 */
export function removeCoveredDuplicateH1(tokens: MarkdownToken[]): void {
  for (let index = tokens.length - 1; index >= 0; index--) {
    const token = tokens[index]
    if (token.type === 'html_block' && COVER_CLASS.test(token.content)) tokens.splice(index, 1)
  }
  const open = tokens.findIndex((token) => token.type === 'heading_open' && token.tag === 'h1')
  if (open === -1) return
  const content = tokens[open + 1]
  const close = tokens[open + 2]
  if (content?.type !== 'inline' || close?.type !== 'heading_close' || close.tag !== 'h1') {
    throw new Error('a Markdown H1 must be a plain heading: heading_open, inline, heading_close')
  }
  tokens.splice(open, 3)
}

export function installCoveredHeadingRule(md: MarkdownRenderer): void {
  md.core.ruler.after('block', 'darebay-covered-heading', (state) => {
    removeCoveredDuplicateH1(state.tokens)
  })
}
