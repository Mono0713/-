'use client'

import { useState, useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { Button } from '@/shared/ui'
import { createReviewExam } from './teaching'

/** Makes a new exam of the questions the class got mostly wrong, then opens 派作業 with it. */
export function ReviewSetButton({ assignmentId, weak }: { assignmentId: string; weak: number }) {
  const t = useT()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className="space-y-1.5">
      <Button loading={pending} disabled={pending || weak === 0} onClick={() => start(async () => setError((await createReviewExam(assignmentId))?.error ?? null))}>
        {t('錯題組成複習卷')}
      </Button>
      <p className="text-xs text-muted">{weak ? t('把得分率低於 60% 的 {n} 題存成新考卷，再派給班級。', { n: weak }) : t('沒有得分率低於 60% 的題目。')}</p>
      {error && <p className="m-shake text-sm text-bad">{error}</p>}
    </div>
  )
}
