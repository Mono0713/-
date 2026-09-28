'use client'

import type { QuizAttempt, QuizSummary } from '@exam/quiz'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Card } from '@/shared/ui'
import { markAnswer } from './actions'
import { QuizQuestion } from './QuizQuestion'
import { GRADE_LABELS, Reveal } from './Reveal'

type Filter = 'all' | 'missed' | 'pending'

/** Score and every question with its answer, after the quiz is over. Open answers can be marked here. */
export function QuizResults({ attempt, summary }: { attempt: QuizAttempt; summary: QuizSummary }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [, start] = useTransition()
  const { grades } = summary
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
      <Card className="flex flex-wrap items-center gap-x-10 gap-y-4 p-5">
        <div>
          <p className="text-xs text-muted">得分</p>
          <p className="text-3xl font-semibold tabular-nums">
            {summary.score}
            <span className="text-lg text-muted"> / {summary.max}</span>
          </p>
        </div>
        {percent !== null && (
          <div>
            <p className="text-xs text-muted">得分率</p>
            <p className="text-3xl font-semibold tabular-nums">{percent}%</p>
          </div>
        )}
        {minutes !== null && (
          <div>
            <p className="text-xs text-muted">用時</p>
            <p className="text-3xl font-semibold tabular-nums">
              {minutes}
              <span className="text-lg text-muted"> 分鐘</span>
            </p>
          </div>
        )}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {counts.map(([status, n]) => (
            <li key={status}>
              {GRADE_LABELS[status][0]} <span className="font-semibold tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
        {summary.pending > 0 && <p className="w-full text-sm text-accent">有 {summary.pending} 題問答題要對照參考答案自己評分，分數會跟著更新。</p>}
      </Card>

      <div className="flex gap-1 text-sm">
        {(
          [
            ['all', `全部 ${attempt.items.length}`],
            ['missed', `答錯與未作答 ${attempt.items.filter((_, i) => missed(i)).length}`],
            ['pending', `待自評 ${summary.pending}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-md px-3 py-1.5 ${filter === value ? 'bg-ink text-paper' : 'bg-surface text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.map((i) => (
        <Card key={i} className="space-y-4 p-5">
          <QuizQuestion item={attempt.items[i]!} index={i} response={attempt.responses[i] ?? null} reveal />
          <Reveal item={attempt.items[i]!} grade={grades[i]!} marking={attempt.markings[i] ?? null} onMark={(credit) => mark(i, credit)} />
        </Card>
      ))}
      {!shown.length && <p className="text-sm text-muted">沒有符合的題目。</p>}
    </div>
  )
}
