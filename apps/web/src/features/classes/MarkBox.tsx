'use client'

import type { Marking } from '@exam/quiz'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { msg } from '@/shared/i18n/format'
import { Button, inputClass } from '@/shared/ui'
import { teacherMark } from './actions'

const CREDITS = [
  [1, msg('答對')],
  [0.5, msg('部分')],
  [0, msg('答錯')],
] as const

/** The teacher's mark on one answer: right, part, wrong, and a comment in their own words. */
export function MarkBox({ attemptId, index, marking }: { attemptId: string; index: number; marking: Marking | null }) {
  const t = useT()
  const router = useRouter()
  const mine = marking?.by === 'teacher' ? marking : null
  const [comment, setComment] = useState(mine?.feedback ?? '')
  const [pending, start] = useTransition()
  const base = mine?.credit ?? marking?.credit
  const save = (credit: number | null, text = comment) =>
    start(async () => {
      await teacherMark(attemptId, index, credit, text)
      router.refresh()
    })

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-line p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">{marking?.by === 'ai' ? t('AI 批改的分數，可以改：') : t('老師批改：')}</span>
        {CREDITS.map(([credit, label]) => (
          <Button
            key={credit}
            className="px-3 py-1.5"
            disabled={pending}
            variant={mine?.credit === credit ? (credit === 0 ? 'danger' : 'primary') : 'secondary'}
            onClick={() => save(mine?.credit === credit ? null : credit)}
          >
            {t(label)}
          </Button>
        ))}
      </div>
      <textarea
        autoComplete="off"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        // A comment on an AI mark keeps its score and makes the mark the teacher's.
        onBlur={() => base !== undefined && comment !== (mine?.feedback ?? '') && save(base)}
        rows={2}
        maxLength={2000}
        placeholder={base === undefined ? t('先選分數，再寫給學生的評語') : t('給學生的評語')}
        aria-label={t('評語')}
        className={`${inputClass} resize-y`}
      />
    </div>
  )
}
