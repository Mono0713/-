'use client'

import type { ReactNode } from 'react'
import { Markdown } from '@/shared/Markdown'
import { BlankPick } from './BlankPick'

/**
 * 配合題, or blanks filled from a list of labels, laid out like the paper: one line per item with a
 * bracket in front, "( ) 1. level". Tapping the bracket opens the option labels just below it, so the
 * labels are not repeated on every line. Lines start at slot `start` (blanks drawn on a figure come
 * first). `options` (the list to choose from, shown once) sits beside the items on wider screens.
 * After the answer is shown, a bracket is green when right and red with the right label when wrong.
 */
export function MatchingPicker({
  count,
  start = 0,
  items,
  options,
  labels,
  texts,
  values,
  answer,
  locked,
  onPick,
}: {
  count: number
  start?: number
  /** Each line's text, when the question lists its items; otherwise lines show (1), (2)… */
  items: string[] | null
  options?: ReactNode
  /** Option labels in this quiz's order and naming. */
  labels: string[]
  /** What each label stands for, in the same order. */
  texts?: string[]
  values: string[]
  /** The key in this quiz's labels, only once the answer is shown. */
  answer: string[] | null
  locked: boolean
  onPick: (slot: number, label: string) => void
}) {
  const slots = Array.from({ length: count - start }, (_, k) => start + k)
  const lines = (
    <ol className={items ? 'space-y-1.5' : 'grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2'}>
      {slots.map((slot, k) => (
        <li key={slot} className="flex items-start gap-2 text-sm">
          <span className="num shrink-0 leading-8 text-muted">(</span>
          <span className="relative inline-block h-8 w-11 shrink-0">
            <BlankPick
              label={items ? String(k + 1) : String(slot + 1)}
              labels={labels}
              texts={texts}
              answerBeside
              value={values[slot] ?? ''}
              answer={answer ? (answer[slot] ?? '') : null}
              locked={locked}
              onPick={(l) => onPick(slot, l)}
            />
          </span>
          <span className="num shrink-0 leading-8 text-muted">)</span>
          {/* the right label beside a wrong one; a right one keeps the room so the items stay lined up */}
          {answer && (
            <span className={`num mt-1.5 w-5 shrink-0 rounded bg-good text-center text-xs font-semibold leading-5 text-on-accent ${values[slot] === answer[slot] ? 'invisible' : ''}`}>{answer[slot]}</span>
          )}
          {items ? (
            <Markdown className="min-w-0 flex-1 pt-1">{items[k] ?? ''}</Markdown>
          ) : (
            <span className="num leading-8 text-muted">({slot + 1})</span>
          )}
        </li>
      ))}
    </ol>
  )
  if (!options) return lines
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
      {lines}
      {options}
    </div>
  )
}
