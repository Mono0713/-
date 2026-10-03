import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import 'katex/contrib/mhchem'
import { withMathDelimiters } from './math/delimiters'
import { rehypeTableRows } from './tableRows'

/**
 * Question text: Markdown, tables (side by side when one follows another), LaTeX math ($...$) and chemistry (\ce{...}). Bare LaTeX is shown as a formula too.
 * Memoised: parsing and KaTeX are the costly part of a card, and a drag re-renders every card on each move.
 */
export const Markdown = memo(function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`prose-q leading-relaxed ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }], rehypeTableRows]}>
        {withMathDelimiters(children)}
      </ReactMarkdown>
    </div>
  )
})
