'use client'

import type { QuizAttempt, QuizSummary } from '@exam/quiz'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Confetti } from '@/shared/motion/Confetti'
import { Odometer } from '@/shared/motion/Odometer'
import { ProgressRing } from '@/shared/motion/ProgressRing'
import { Segmented } from '@/shared/Segmented'
import { AutoRefresh } from '@/features/imports/AutoRefresh'
import { useT } from '@/shared/i18n/client'
import { rich } from '@/shared/i18n/rich'
import { IconLoader, IconSparkles } from '@/shared/icons'
import { Button, Card } from '@/shared/ui'
import { askTeacher, markAnswer, translateQuestion } from './actions'
import { QuizQuestion } from './QuizQuestion'
import { GRADE_LABELS, Reveal } from './Reveal'

type Filter = 'all' | 'missed' | 'pending'

/** Score and every question with its answer, after the quiz is over. Open answers can be marked here. */
export function QuizResults({ attempt, summary, teacher, locale }: { attempt: QuizAttempt; summary: QuizSummary; teacher: boolean; locale: string }) {
  const t = useT()
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [, start] = useTransition()
  const [asking, startAsking] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const running = attempt.teacher?.status === 'running'
  const ask = () =>
    startAsking(async () => {
      setError((await askTeacher(attempt.id))?.error ?? null)
      router.refresh()
    })
  const { grades } = summary
  // On a class assignment the teacher or AI marks; the student does not mark their own.
  const own = !attempt.assignment || Boolean(attempt.assignment.preview)
  const withheldNote = own ? undefined : t('老師還沒有公開答案。')
  const mark = (i: number, credit: number | null) =>
    start(async () => {
      await markAnswer(attempt.id, i, credit)
      router.refresh()
    })

  const missed = (i: number) => ['wrong', 'partial', 'unanswered'].includes(grades[i]!.status)
  const shown = attempt.items.map((_, i) => i).filter((i) => filter === 'all' || (filter === 'missed' ? missed(i) : grades[i]!.status === 'pending'))
  const percent = summary.max ? Math.round((summary.score / summary.max) * 100) : null
  const minutes = attempt.finishedAt ? Math.max(1, Math.round((new Date(attempt.finishedAt).getTime() - new Date(attempt.startedAt).getTime()) / 60_000)) : null

  const counts = (Object.keys(GRADE_LABELS) as (keyof typeof GRADE_LABELS)[])
    .map((status) => [status, grades.filter((g) => g.status === status).length] as const)
    .filter(([, n]) => n > 0)

  return (
    <div className="space-y-6">
      <Card className="m-enter relative flex flex-wrap items-center gap-x-10 gap-y-4 overflow-visible p-5">
        {/* full marks: confetti from the score, and the teacher's red stamp in the corner */}
        {percent === 100 && (
          <>
            <Confetti className="inset-x-0 -top-40 bottom-0 z-10" />
            <span aria-label={t('滿分')} className="m-stamp absolute -top-6 right-2 max-sm:scale-75 sm:right-8 sm:top-1/2 sm:-translate-y-1/2">
              {t('滿分')}
            </span>
          </>
        )}
        {percent !== null && (
          <div className="relative grid place-items-center">
            <ProgressRing value={percent / 100} size={84} stroke={9} tone={percent >= 60 ? 'var(--color-good)' : 'var(--color-warn)'} />
            <span className="num absolute text-lg leading-none">
              <Odometer value={`${percent}%`} />
            </span>
          </div>
        )}
        <div>
          <p className="text-xs text-muted">{t('得分')}</p>
          <p className="num text-3xl">
            <Odometer value={Number.isInteger(summary.score) ? String(summary.score) : summary.score.toFixed(1)} />
            <span className="text-lg text-muted"> / {summary.max}</span>
          </p>
        </div>
        {minutes !== null && (
          <div>
            <p className="text-xs text-muted">{t('用時')}</p>
            <p className="text-3xl font-semibold tabular-nums">
              {rich(t('{n}<unit> 分鐘</unit>', { n: minutes }), { unit: (c) => <span className="text-lg text-muted">{c}</span> })}
            </p>
          </div>
        )}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {counts.map(([status, n]) => (
            <li key={status}>
              {t(GRADE_LABELS[status][0])} <span className="font-semibold tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
        {running ? (
          <p className="flex w-full items-center gap-2 text-sm text-accent">
            <AutoRefresh everyMs={2000} />
            <IconLoader size={15} className="m-spin" /> {t('AI 老師正在批改問答題和填空題，分數會自動更新。')}
          </p>
        ) : (
          summary.pending > 0 && (
            <div className="flex w-full flex-wrap items-center gap-3 text-sm">
              <p className="text-accent">
                {t('有 {n} 題等待批改。', { n: summary.pending })}{attempt.teacher?.status === 'failed' ? t('AI 批改沒有完成，可以再試一次，') : ''}
                {own ? (teacher ? t('可以對照參考答案自己評分，或請 AI 老師批改。') : t('可以對照參考答案自己評分。')) : teacher ? t('老師會批改，也可以先請 AI 老師批改。') : t('老師會批改。')}
              </p>
              {teacher && (
                <Button onClick={ask} loading={asking} icon={<IconSparkles size={15} />}>
                  {t('請 AI 老師批改')}
                </Button>
              )}
            </div>
          )
        )}
        {!running && attempt.teacher?.status === 'done' && attempt.teacher.model && (
          <p className="w-full text-xs text-muted">{t('標示「AI 批改」的題目由 {model} 批改；同一題同樣的答案只會問 AI 一次。', { model: attempt.teacher.model })}</p>
        )}
        {error && <p className="w-full text-sm text-bad">{error}</p>}
      </Card>

      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          ['all', t('全部 {n}', { n: attempt.items.length })],
          ['missed', t('答錯與未作答 {n}', { n: attempt.items.filter((_, i) => missed(i)).length })],
          ['pending', t('待批改 {n}', { n: summary.pending })],
        ] as const}
      />

      {shown.map((i) => (
        <Card key={i} className="m-enter space-y-4 p-5">
          <QuizQuestion item={attempt.items[i]!} index={i} response={attempt.responses[i] ?? null} reveal locale={locale} onTranslate={() => translateQuestion(attempt.id, i)} />
          <Reveal item={attempt.items[i]!} grade={grades[i]!} marking={attempt.markings[i] ?? null} onMark={own ? (credit) => mark(i, credit) : undefined} withheldNote={withheldNote} tutor={{ attemptId: attempt.id, index: i, turns: attempt.tutoring?.[i] ?? [] }} />
        </Card>
      ))}
      {!shown.length && <p className="text-sm text-muted">{t('沒有符合的題目。')}</p>}
    </div>
  )
}
