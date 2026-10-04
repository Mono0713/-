'use client'

import { useT } from '@/shared/i18n/client'

/**
 * 配合題: one row per item, each answered by picking one option label (as shown in this quiz).
 * After the answer is shown, the right label is green and a wrong pick red.
 */
export function MatchingPicker({
  count,
  labels,
  values,
  answer,
  locked,
  onPick,
}: {
  count: number
  /** Option labels in this quiz's order and naming. */
  labels: string[]
  values: string[]
  /** The key in this quiz's labels, only once the answer is shown. */
  answer: string[] | null
  locked: boolean
  onPick: (slot: number, label: string) => void
}) {
  const t = useT()
  return (
    <ol className="grid gap-2 sm:grid-cols-2">
      {Array.from({ length: count }, (_, slot) => (
        <li key={slot} className="flex items-center gap-2">
          <span className="num w-8 shrink-0 text-right text-xs text-muted">({slot + 1})</span>
          <span className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('第 {n} 項', { n: slot + 1 })}>
            {labels.map((label) => {
              const picked = values[slot] === label
              const right = answer !== null && answer[slot] === label
              const tone = right
                ? 'bg-good-soft text-good ring-1 ring-good'
                : answer !== null && picked
                  ? 'bg-bad-soft text-bad ring-1 ring-bad'
                  : picked
                    ? 'bg-accent text-on-accent'
                    : 'bg-ink/[0.045] text-ink/80 hover:bg-ink/[0.08]'
              return (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  disabled={locked}
                  onClick={() => onPick(slot, picked ? '' : label)}
                  className={`m-press num h-9 min-w-10 rounded-lg px-3 text-sm font-medium ${tone}`}
                >
                  {label}
                </button>
              )
            })}
          </span>
        </li>
      ))}
    </ol>
  )
}
