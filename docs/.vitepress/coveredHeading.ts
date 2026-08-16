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
 * A cover already owns the page's visible and semantic H1. The Markdown H1 directly after it is
 * the accessible fallback in source, but rendering both leaves crawlers with two primary
 * headings. Remove only that exact duplicate token triplet and fail closed if the source shape
 * drifts; ordinary pages keep their Markdown H1 untouched.
 */
export function removeCoveredDuplicateH1(tokens: MarkdownToken[]): void {
  const covers = tokens
    .map((token, index) => ({ token, index }))
    .filter(({ token }) => token.type === 'html_block' && COVER_CLASS.test(token.content))

  for (const { index } of covers.reverse()) {
    const opening = tokens[index + 1]
    const content = tokens[index + 2]
    const closing = tokens[index + 3]
    if (
      opening?.type !== 'heading_open' || opening.tag !== 'h1' ||
      content?.type !== 'inline' ||
      closing?.type !== 'heading_close' || closing.tag !== 'h1'
    ) {
      throw new Error('docs-cover must be followed immediately by one Markdown H1 fallback')
    }
    tokens.splice(index + 1, 3)
  }
}

export function installCoveredHeadingRule(md: MarkdownRenderer): void {
  md.core.ruler.after('block', 'darebay-covered-heading', (state) => {
    removeCoveredDuplicateH1(state.tokens)
  })
}
