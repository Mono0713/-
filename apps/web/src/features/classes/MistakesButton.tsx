'use client'

import { useState, useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { Button } from '@/shared/ui'
import { practiceMistakes } from './mistakes'

/** Starts a practice quiz of the questions the student lost points on. */
export function MistakesButton({ assignmentId, count }: { assignmentId: string; count: number }) {
  const t = useT()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className="space-y-1.5">
      <Button loading={pending} disabled={pending} onClick={() => start(async () => setError((await practiceMistakes(assignmentId))?.error ?? null))}>
        {t('練習這次的錯題（{n} 題）', { n: count })}
      </Button>
      <p className="text-xs text-muted">{t('用練習模式重寫答錯、部分對和沒寫的題目，每寫完一題就看對錯，不會算進成績。')}</p>
      {error && <p className="m-shake text-sm text-bad">{error}</p>}
    </div>
  )
}
