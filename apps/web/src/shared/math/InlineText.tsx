import katex from 'katex'
import 'katex/contrib/mhchem'
import { Fragment } from 'react'

const MATH = /(\$[^$]+\$)/g

/** A short text that stays inline (an answer in a blank): `$…$` typeset as math, \ce{} chemistry included, the rest as written. */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {text.split(MATH).map((part, i) =>
        part.length > 2 && part.startsWith('$') && part.endsWith('$') ? (
          <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(part.slice(1, -1), { throwOnError: false, strict: false }) }} />
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}
