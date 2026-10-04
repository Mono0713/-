'use client'

import type { InkDoc, Paper } from '@exam/ink'
import { useEffect, useState } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconChevronLeft, IconChevronRight } from '@/shared/icons'
import { InkPad } from '@/shared/ink/InkPad'

type Practice = Extract<Paper, { kind: 'practice' }>

/** Whether the screen is phone-narrow, where a whole practice row leaves cells too small to write in. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const query = matchMedia('(max-width: 639px)')
    const update = () => setNarrow(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return narrow
}

/**
 * The writing-practice grid. In 書寫模式 on a phone it shows half a row at a time, enlarged:
 * first the model and the characters to trace, then the cells to write on your own. The ink is
 * the same page either way, so switching screens or modes never moves what was written.
 */
export function PracticeSheet({
  paper,
  value,
  onChange,
  readOnly,
  focus,
}: {
  paper: Practice
  value: InkDoc | null | undefined
  onChange?: (doc: InkDoc) => void
  readOnly: boolean
  focus: boolean
}) {
  const t = useT()
  const narrow = useNarrow()
  const [step, setStep] = useState(0)
  const zoomed = focus && narrow && !readOnly
  if (!zoomed) return <InkPad label={t('寫字練習')} value={value} onChange={onChange} readOnly={readOnly} paper={paper} />

  const cell = 1 / paper.columns
  // the first step of each row ends after the traced characters, the second covers the rest
  const split = Math.min(paper.columns, 1 + paper.traced)
  const steps = paper.rows.length * 2
  const at = Math.min(step, steps - 1)
  const row = Math.floor(at / 2)
  const second = at % 2 === 1
  const from = second ? split : 0
  const to = second ? paper.columns : split
  const view = { x: from * cell, y: row * cell, w: (to - from) * cell, h: cell }
  const char = paper.rows[row]!

  return (
    <div className="space-y-2">
      <InkPad key={at} label={t('寫字練習')} value={value} onChange={onChange} readOnly={readOnly} paper={paper} view={view} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStep(at - 1)}
          disabled={at === 0}
          aria-label={t('上一步')}
          className="m-press grid h-10 w-10 place-items-center rounded-lg border border-line bg-surface disabled:opacity-40"
        >
          <IconChevronLeft size={18} />
        </button>
        <p className="min-w-0 flex-1 text-center text-sm">
          <span className="font-hand text-lg">{char}</span>
          <span className="text-muted">
            {' · '}
            {second ? t('自己寫') : t('看範字、描寫')}
            {' · '}
            {t('第 {n} / {total} 字', { n: row + 1, total: paper.rows.length })}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setStep(at + 1)}
          disabled={at === steps - 1}
          aria-label={t('下一步')}
          className="m-press grid h-10 w-10 place-items-center rounded-lg border border-line bg-surface disabled:opacity-40"
        >
          <IconChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
