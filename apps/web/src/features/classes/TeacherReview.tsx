'use client'

import type { QuizAttempt, QuizSummary } from '@exam/quiz'
import { answerKind, groupRange } from '@exam/quiz/logic'
import { useEffect, useState } from 'react'
import { AutoRefresh } from '@/features/imports/AutoRefresh'
import { QuizQuestion } from '@/features/quiz/QuizQuestion'
import { Reveal } from '@/features/quiz/Reveal'
import { Segmented } from '@/shared/Segmented'
import { useT } from '@/shared/i18n/client'
import { IconLoader } from '@/shared/icons'
import { Card } from '@/shared/ui'
import { MarkBox } from './MarkBox'

type Filter = 'all' | 'open' | 'pending'

/**
 * A student's handed-in attempt as the teacher sees it: every answer, and marks and comments on
 * the open ones. `focus` is a question to scroll to, picked on 每題對錯.
 */
export function TeacherReview({ attempt, summary, focus = null }: { attempt: QuizAttempt; summary: QuizSummary; focus?: number | null }) {
  const t = useT()
  const open = attempt.items.map((item) => {
    const kind = answerKind(item.question).kind
    return kind !== 'single' && kind !== 'multiple' && kind !== 'true_false'
  })
  const markable = (i: number) => open[i] && summary.grades[i]!.status !== 'unanswered'
  // Opens on the answers to mark; a marked one stays in view instead of leaving a "pending" list.
  const [filter, setFilter] = useState<Filter>(() => (focus === null && attempt.items.some((_, i) => markable(i)) ? 'open' : 'all'))
  const shown = attempt.items.map((_, i) => i).filter((i) => filter === 'all' || (filter === 'open' ? markable(i) : summary.grades[i]!.status === 'pending'))
  useEffect(() => {
    if (focus !== null) document.getElementById(`q-${focus}`)?.scrollIntoView({ block: 'start' })
  }, [focus])

  return (
    <div className="space-y-4">
      {attempt.teacher?.status === 'running' && (
        <p className="flex items-center gap-2 text-sm text-accent">
          <AutoRefresh everyMs={2000} />
          <IconLoader size={15} className="m-spin" /> {t('AI 老師正在批改，分數會自動更新。')}
        </p>
      )}
      <Segmented
        value={filter}
        onChange={setFilter}
        options={
          [
            ['all', t('全部 {n}', { n: attempt.items.length })],
            ['open', t('問答與填空 {n}', { n: attempt.items.filter((_, i) => markable(i)).length })],
            ['pending', t('待批改 {n}', { n: summary.pending })],
          ] as const
        }
      />
      {shown.map((i) => (
        <Card key={i} id={`q-${i}`} className={`m-enter scroll-mt-20 space-y-4 p-5 ${i === focus ? 'ring-2 ring-accent/40' : ''}`}>
          <QuizQuestion item={attempt.items[i]!} index={i} response={attempt.responses[i] ?? null} groupRange={groupRange(attempt.items, i)} reveal />
          <Reveal item={attempt.items[i]!} grade={summary.grades[i]!} marking={attempt.markings[i] ?? null} />
          {markable(i) && <MarkBox attemptId={attempt.id} index={i} marking={attempt.markings[i] ?? null} />}
        </Card>
      ))}
      {!shown.length && <p className="text-sm text-muted">{t('沒有符合的題目。')}</p>}
    </div>
  )
}
