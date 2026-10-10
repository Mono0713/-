import { memo, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import 'katex/contrib/mhchem'
import { withMathDelimiters } from './math/delimiters'
import { rehypeTableRows } from './tableRows'

/** Marks one blank (a run of ___) for `renderBlank`; inline code so it survives tables and lists. */
const BLANK = /_{3,}/g
const marker = (i: number) => `\u27E6blank:${i}\u27E7`
const MARKER = /^\u27E6blank:(\d+)\u27E7$/

/** How many blanks (runs of three or more underscores) a question's text has. */
export function blankCount(text: string): number {
  return text.match(BLANK)?.length ?? 0
}

/**
 * Question text: Markdown, tables (side by side when one follows another), LaTeX math ($...$) and chemistry (\ce{...}). Bare LaTeX is shown as a formula too.
 * `renderBlank` puts something (an input) in place of each blank (___), counted from 0 in reading order.
 * Memoised: parsing and KaTeX are the costly part of a card, and a drag re-renders every card on each move.
 */
export const Markdown = memo(function Markdown({ children, className = '', renderBlank }: { children: string; className?: string; renderBlank?: (index: number) => ReactNode }) {
  let n = 0
  const text = renderBlank ? children.replace(BLANK, () => `\`${marker(n++)}\``) : children
  return (
    <div className={`prose-q leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }], rehypeTableRows]}
        components={
          renderBlank && {
            code: ({ children: code, node: _node, ...props }) => {
              const hit = typeof code === 'string' ? MARKER.exec(code) : null
              return hit ? <>{renderBlank(Number(hit[1]))}</> : <code {...props}>{code}</code>
            },
          }
        }
      >
        {withMathDelimiters(text)}
      </ReactMarkdown>
    </div>
  )
})
