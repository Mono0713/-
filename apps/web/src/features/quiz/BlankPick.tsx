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
  labels,
  value,
  answer,
  locked,
  onPick,
}: {
  /** The blank's own label on the figure, e.g. "3". */
  label: string
  /** Option labels in this quiz's order and naming. */
  labels: string[]
  value: string
  /** The right label in this quiz's naming, only once the answer is shown. */
  answer: string | null
  locked: boolean
  onPick: (label: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
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
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('空格 {label}', { label })}
        className={`num flex h-full w-full items-center justify-center rounded-sm border-2 bg-surface/90 text-sm font-semibold ${tone}`}
      >
        {value}
      </button>
      {answer !== null && !right && (
        <span className="num absolute -right-2 -top-2.5 rounded bg-good px-1.5 text-xs font-semibold text-on-accent shadow-sm">{answer}</span>
      )}
      {open && (
        <span role="listbox" aria-label={t('空格 {label}', { label })} className="m-menu absolute left-0 top-full z-30 mt-1 flex w-max max-w-64 flex-wrap gap-1 rounded-lg border border-line bg-surface p-1.5 shadow-lg">
          {labels.map((l) => (
            <button
              key={l}
              type="button"
              role="option"
              aria-selected={l === value}
              onClick={() => {
                onPick(l === value ? '' : l)
                setOpen(false)
              }}
              className={`m-press num h-8 min-w-9 rounded-md px-2 text-sm font-medium ${l === value ? 'bg-accent text-on-accent' : 'bg-ink/[0.045] text-ink/80 hover:bg-ink/[0.08]'}`}
            >
              {l}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
