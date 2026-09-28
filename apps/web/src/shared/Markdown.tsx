import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import 'katex/contrib/mhchem'

/** Question text: Markdown, tables, LaTeX math ($...$) and chemistry (\ce{...}). */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`prose-q leading-relaxed ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
