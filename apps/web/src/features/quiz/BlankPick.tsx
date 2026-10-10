'use client'

import { useEffect, useRef, useState } from 'react'
import { useT } from '@/shared/i18n/client'

/**
 * A blank drawn on a figure that is filled with one option label: tapping it opens the labels
 * just below it, and a pick fills the blank. After the answer is shown it is green when right,
 * red when wrong, with the right label beside a wrong one.
 */
export function BlankPick({
  label,
  shown,
  labels,
  value,
  answer,
  texts,
  answerBeside = false,
  locked,
  onPick,
}: {
  /** The blank's own label on the figure, e.g. "3". */
  label: string
  /** What the blank shows for its pick, when not the label itself (a word picked by its number). */
  shown?: (label: string) => string
  /** Option labels in this quiz's order and naming. */
  labels: string[]
  value: string
  /** The right label in this quiz's naming, only once the answer is shown. */
  answer: string | null
  /** What each label stands for. On a phone the list opens as rows with these beside the labels,
   *  since the list itself may be out of sight; wider screens keep the compact row of labels. */
  texts?: string[]
  /** The right label is shown by the caller beside the blank, not on its corner. */
  answerBeside?: boolean
  locked: boolean
  onPick: (label: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  // a blank on the right half of the screen opens its list leftward, so the list stays on screen
  const [rightSide, setRightSide] = useState(false)
  const box = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const right = answer !== null && value === answer
  const tone = answer !== null ? (right ? 'border-good text-good' : 'border-bad/60 text-bad') : open ? 'border-accent text-accent' : 'border-accent/40 text-accent'
  return (
    <span ref={box} className="relative block h-full w-full">
      <button
        type="button"
        disabled={locked}
        onClick={() => {
          setRightSide((box.current?.getBoundingClientRect().left ?? 0) > window.innerWidth / 2)
          setOpen(!open)
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('空格 {label}', { label })}
        className={`num flex h-full w-full items-center justify-center rounded-sm border-2 bg-surface/90 text-sm font-semibold ${tone}`}
      >
        {shown && value ? shown(value) : value}
      </button>
      {answer !== null && !right && !answerBeside && (
        <span className="num absolute -right-2 -top-2.5 whitespace-nowrap rounded bg-good px-1.5 text-xs font-semibold text-on-accent shadow-sm">{shown && answer ? shown(answer) : answer}</span>
      )}
      {open && (
        <span
          role="listbox"
          aria-label={t('空格 {label}', { label })}
          className={`m-menu absolute ${rightSide ? 'right-0' : 'left-0'} top-full z-30 mt-1 rounded-lg border border-line bg-surface p-1.5 shadow-lg ${
            texts ? 'flex max-h-80 w-[min(20rem,calc(100vw-4rem))] flex-col gap-1 overflow-y-auto sm:max-h-none sm:w-max sm:max-w-64 sm:flex-row sm:flex-wrap' : `flex w-max ${shown ? 'max-w-[min(20rem,calc(100vw-2rem))]' : 'max-w-64'} flex-wrap gap-1`
          }`}
        >
          {labels.map((l, i) => (
            <button
              key={l}
              type="button"
              role="option"
              aria-selected={l === value}
              onClick={() => {
                onPick(l === value ? '' : l)
                setOpen(false)
              }}
              className={`m-press min-h-8 min-w-9 shrink-0 rounded-md px-2 text-sm ${texts ? 'flex items-baseline gap-2 py-1.5 text-left sm:block sm:py-0 sm:text-center' : ''} ${l === value ? 'bg-accent text-on-accent' : 'bg-ink/[0.045] text-ink/80 hover:bg-ink/[0.08]'}`}
            >
              {shown ? <span className="font-medium">{shown(l)}</span> : <span className="num font-medium">{l}</span>}
              {texts?.[i] && <span className="line-clamp-2 min-w-0 flex-1 sm:hidden">{texts[i]}</span>}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
