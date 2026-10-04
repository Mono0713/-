'use client'

import type { Marking, QuizAttempt, QuizSummary } from '@exam/quiz'
import { answerKind } from '@exam/quiz/logic'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { AutoRefresh } from '@/features/imports/AutoRefresh'
import { QuizQuestion } from '@/features/quiz/QuizQuestion'
import { Reveal } from '@/features/quiz/Reveal'
import { Segmented } from '@/shared/Segmented'
import { useT } from '@/shared/i18n/client'
import { msg } from '@/shared/i18n/format'
import { IconLoader } from '@/shared/icons'
import { Button, Card, inputClass } from '@/shared/ui'
import { teacherMark } from './actions'

type Filter = 'all' | 'open' | 'pending'

const CREDITS = [
  [1, msg('答對')],
  [0.5, msg('部分')],
  [0, msg('答錯')],
] as const

/** A student's handed-in attempt as the teacher sees it: every answer, and marks and comments on the open ones. */
export function TeacherReview({ attempt, summary }: { attempt: QuizAttempt; summary: QuizSummary }) {
  const t = useT()
  const open = attempt.items.map((item) => {
    const kind = answerKind(item.question).kind
    return kind !== 'single' && kind !== 'multiple' && kind !== 'true_false'
  })
  const markable = (i: number) => open[i] && summary.grades[i]!.status !== 'unanswered'
  // Opens on the answers to mark; a marked one stays in view instead of leaving a "pending" list.
  const [filter, setFilter] = useState<Filter>(() => (attempt.items.some((_, i) => markable(i)) ? 'open' : 'all'))
  const shown = attempt.items.map((_, i) => i).filter((i) => filter === 'all' || (filter === 'open' ? markable(i) : summary.grades[i]!.status === 'pending'))

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
        <Card key={i} className="m-enter space-y-4 p-5">
          <QuizQuestion item={attempt.items[i]!} index={i} response={attempt.responses[i] ?? null} reveal />
          <Reveal item={attempt.items[i]!} grade={summary.grades[i]!} marking={attempt.markings[i] ?? null} />
          {markable(i) && <MarkBox attemptId={attempt.id} index={i} marking={attempt.markings[i] ?? null} />}
        </Card>
      ))}
      {!shown.length && <p className="text-sm text-muted">{t('沒有符合的題目。')}</p>}
    </div>
  )
}

/** The teacher's mark on one answer: right, part, wrong, and a comment in their own words. */
function MarkBox({ attemptId, index, marking }: { attemptId: string; index: number; marking: Marking | null }) {
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
