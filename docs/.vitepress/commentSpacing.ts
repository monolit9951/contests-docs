interface SpacingToken {
  readonly type: string
  content: string
  readonly children?: SpacingToken[] | null
}

interface SpacingState {
  readonly tokens: SpacingToken[]
}

interface MarkdownRenderer {
  readonly core: {
    readonly ruler: {
      push(ruleName: string, rule: (state: SpacingState) => void): void
    }
  }
}

/**
 * Punctuation that closes a clause, so no space belongs in front of it: the Latin and Cyrillic
 * marks, closing brackets and quotes, and the Arabic comma, semicolon and question mark.
 */
const CLOSING_PUNCTUATION = '.,;:!?)\\]}»”’…،؛؟'
const OPENS_WITH_CLOSING_PUNCTUATION = new RegExp(`^[${CLOSING_PUNCTUATION}]`)
// One comment that cannot run on past its own `-->`: a lazy `[\s\S]*?` would stretch across the
// text between two comments to satisfy what follows it, and delete that text.
const COMMENT = String.raw`<!--(?:(?!-->)[\s\S])*-->`
/** A run of comments that punctuation follows, with the spaces written in front of and between them. */
const SPACED_COMMENTS_BEFORE_PUNCTUATION = new RegExp(`[ \\t]*(?:${COMMENT}[ \\t]*)+(?=[${CLOSING_PUNCTUATION}])`, 'g')
const COMMENTS = new RegExp(COMMENT, 'g')
/** One whole comment: how markdown-it hands over a comment written inside a sentence. */
const WHOLE_COMMENT = new RegExp(`^${COMMENT}$`)

/**
 * Removes the comments from raw Markdown text, taking along the spaces in front of a comment that
 * punctuation follows: "claim <!-- source: … -->." reads "claim.". For text built from the
 * Markdown source instead of the rendered page, such as the FAQPage answers in config.ts.
 */
export const stripComments = (text: string): string =>
  text.replace(SPACED_COMMENTS_BEFORE_PUNCTUATION, '').replace(COMMENTS, '')

/**
 * Drops the spaces an editor wrote in front of a comment that punctuation follows.
 *
 * The guides cite their figures as `claim <!-- source: URL DATE -->.`, the space kept for the
 * editor's eye. The comment never reaches the reader (Vue drops it from the built page), but the
 * space in front of it did: pages read "в крипти . Але" and "per 1,000 views , and", and so did
 * every copy, screen reader and answer engine quoting them. A page with `sources: visible` already
 * sets its marker right after the claim (`installSourcesRule` in sources.ts); this rule does the
 * same for a comment on any page. It runs before that rule and changes nothing that rule would not
 * have changed, so the citations of a flagged page render as before.
 *
 * Only a comment that punctuation follows loses the spaces, looking past further comments, the spaces
 * between them and the end of an emphasis or a link (`**claim <!-- … -->**.`). In front of a word
 * the space stays: once the comment is gone, it is what keeps the two words apart.
 */
export function installCommentSpacingRule(md: MarkdownRenderer): void {
  md.core.ruler.push('darebay-comment-spacing', (state) => {
    for (const token of state.tokens) {
      if (token.type !== 'inline' || !token.children) continue
      const children = token.children
      children.forEach((child, position) => {
        if (child.type !== 'html_inline' || !WHOLE_COMMENT.test(child.content)) return
        const before = children[position - 1]
        if (before?.type !== 'text') return
        let next = position + 1
        // Spaces written between two comments, `claim <!-- a --> <!-- b -->.`, go with them.
        const between: SpacingToken[] = []
        while (next < children.length) {
          const token = children[next]
          if (token.type === 'text' && /^[ \t]*$/.test(token.content)) between.push(token)
          else if (!token.type.endsWith('_close') && !(token.type === 'html_inline' && WHOLE_COMMENT.test(token.content))) break
          next++
        }
        const after = children[next]
        if (after?.type === 'text' && OPENS_WITH_CLOSING_PUNCTUATION.test(after.content)) {
          before.content = before.content.replace(/[ \t]+$/, '')
          for (const token of between) token.content = ''
        }
      })
    }
  })
}
