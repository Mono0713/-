'use client'

import { Markdown } from '@/shared/Markdown'
import { BlankPick } from './BlankPick'

/** A blank written "__" or "\_\_" is filled in place like "___". */
export const asBlanks = (text: string) => text.replace(/(?:\\_){2,}|(?<!_)__(?!_)/g, '___')

/** An item line "1. level" without its number: "level". */
const word = (item: string) => item.replace(/^\s*(?:[-*]\s*)?[(（]?\d{1,2}\s*[).、．）:]\s*/, '').trim()

/**
 * 配合題 whose definitions each hold a blank for the word (A) "A ___ is a link…", answered like 選詞填空:
 * the words sit once in a box above, and each definition's blank takes one of them. The answer is still
 * kept per word (values[k] = the definition's label), so marking is unchanged; a word put in a second
 * blank leaves the first one. After the answer is shown, a blank is green when right and red with the
 * right word on its corner when wrong.
 */
export function MatchingFill({
  items,
  start,
  definitions,
  values,
  answer,
  locked,
  onChange,
}: {
  /** The words to place, numbered lines of the stem ("1. level"), one per answer slot from `start`. */
  items: string[]
  start: number
  /** The definitions in this quiz's order: their label as shown and their text with its blank. */
  definitions: { label: string; text: string }[]
  values: string[]
  /** The key in this quiz's labels, only once the answer is shown. */
  answer: string[] | null
  locked: boolean
  onChange: (values: string[]) => void
}) {
  const words = items.map(word)
  const numbers = words.map((_, k) => String(k + 1))
  const shown = (n: string) => words[Number(n) - 1] ?? n
  // every blank is as wide as the longest word, so a pick never moves the line
  const width = `${Math.max(4, ...words.map((w) => w.length)) * 0.62 + 1.4}em`
  const slotFor = (label: string, of: (string | undefined)[]) => {
    const k = items.findIndex((_, k) => of[start + k] === label)
    return k < 0 ? '' : String(k + 1)
  }
  const place = (label: string, n: string) => {
    const next = Array.from({ length: start + items.length }, (_, i) => (values[i] === label ? '' : (values[i] ?? '')))
    if (n) next[start + Number(n) - 1] = label
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 rounded-lg border border-line px-3.5 py-2.5">
        {words.map((w, k) => (
          <span key={k} className={`text-sm font-medium transition-opacity ${values[start + k] ? 'opacity-40' : ''}`}>
            {w}
          </span>
        ))}
      </div>
      <ol className="space-y-2">
        {definitions.map((d) => (
          <li key={d.label} className="flex gap-2 text-sm">
            <span className="num shrink-0 font-semibold leading-7 text-muted">({d.label})</span>
            <Markdown
              className="min-w-0 flex-1 leading-7"
              renderBlank={(i) =>
                i === 0 ? (
                  <span className="relative mx-0.5 inline-block h-7 align-middle" style={{ width }}>
                    <BlankPick
                      label={d.label}
                      shown={shown}
                      labels={numbers}
                      value={slotFor(d.label, values)}
                      answer={answer ? slotFor(d.label, answer) : null}
                      locked={locked}
                      onPick={(n) => place(d.label, n)}
                    />
                  </span>
                ) : (
                  '___'
                )
              }
            >
              {asBlanks(d.text)}
            </Markdown>
          </li>
        ))}
      </ol>
    </div>
  )
}
