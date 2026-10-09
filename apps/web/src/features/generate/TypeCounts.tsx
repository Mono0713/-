'use client'

import type { QuestionType } from '@exam/core'
import { useT } from '@/shared/i18n/client'
import { IconMinus, IconPlus } from '@/shared/icons'
import { TYPE_LABELS } from '@/shared/labels'
import { MAX_PER_TYPE } from './plan'

/** 題型與題數: one row per question type with a − n + stepper; a type at 0 is left out of the exam. */
export function TypeCounts({ counts, onChange }: { counts: [QuestionType, number][]; onChange: (type: QuestionType, count: number) => void }) {
  const t = useT()
  return (
    <ul className="grid gap-x-6 sm:grid-cols-2">
      {counts.map(([type, count]) => {
        const label = t('{type}題', { type: t(TYPE_LABELS[type]) })
        const step = (by: number) => onChange(type, Math.min(MAX_PER_TYPE, Math.max(0, count + by)))
        return (
          <li key={type} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
            <span className={`text-sm transition-colors ${count ? 'font-medium' : 'text-muted'}`}>{label}</span>
            <span className="flex items-center gap-1">
              <button type="button" onClick={() => step(-1)} disabled={!count} aria-label={t('{type}少一題', { type: label })} className="m-press grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-30">
                <IconMinus size={15} />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_PER_TYPE}
                value={count}
                autoComplete="off"
                aria-label={t('{type}題數', { type: label })}
                onChange={(e) => onChange(type, Math.min(MAX_PER_TYPE, Math.max(0, Math.round(Number(e.target.value) || 0))))}
                className={`num w-10 rounded-md bg-transparent py-1 text-center text-sm outline-none [appearance:textfield] focus:bg-surface focus:shadow-[0_0_0_1px_var(--color-line)] [&::-webkit-inner-spin-button]:appearance-none ${count ? 'text-accent font-semibold' : 'text-muted'}`}
              />
              <button type="button" onClick={() => step(1)} disabled={count >= MAX_PER_TYPE} aria-label={t('{type}多一題', { type: label })} className="m-press grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-30">
                <IconPlus size={15} />
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
