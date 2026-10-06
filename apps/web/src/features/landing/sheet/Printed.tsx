import katex from 'katex'
import 'katex/contrib/mhchem'
import 'katex/dist/katex.min.css'
import { Fragment, type ReactNode } from 'react'

const TOKENS = /(<blank><\/blank>|<u>[^<]*<\/u>|\$[^$]+\$)/g

/** Printed exam text: `$…$` typeset as math (and \ce{} chemistry), `<u>…</u>` underlined, `<blank></blank>` replaced by `blank`. */
export function Printed({ text, blank }: { text: string; blank?: ReactNode }) {
  return (
    <>
      {text.split(TOKENS).map((part, i) => {
        if (part === '<blank></blank>') return <Fragment key={i}>{blank ?? <span className="mx-0.5 inline-block w-[3.2em] border-b border-current/60" />}</Fragment>
        if (part.startsWith('<u>'))
          return (
            <span key={i} className="underline decoration-1 underline-offset-[3px]">
              {part.slice(3, -4)}
            </span>
          )
        if (part.length > 1 && part.startsWith('$') && part.endsWith('$')) return <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(part.slice(1, -1), { throwOnError: false, strict: false }) }} />
        return part
      })}
    </>
  )
}
