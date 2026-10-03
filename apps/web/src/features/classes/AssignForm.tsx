'use client'

import type { AssignmentAnswers } from '@exam/classes'
import type { QuizMode } from '@exam/quiz'
import { useState, useTransition } from 'react'
import { Listbox } from '@/shared/Listbox'
import { Segmented } from '@/shared/Segmented'
import { Button, Card, inputBase, inputClass } from '@/shared/ui'
import { createAssignment } from './actions'

export interface AssignExam {
  id: string
  title: string
  count: number
  /** Subject, school and when it was added, to tell apart exams with the same title. */
  hint?: string
}

const ANSWERS = [
  ['after_submit', '交卷後'],
  ['after_close', '截止後'],
  ['never', '不公布'],
] as const satisfies readonly (readonly [AssignmentAnswers, string])[]

const ANSWER_NOTES: Record<AssignmentAnswers, string> = {
  after_submit: '學生交卷後就看得到答案和詳解（練習模式是每做完一題）。',
  after_close: '截止時間到了才公布答案和成績，避免先交的人把答案傳出去。在那之前學生交卷後只看到「已交卷」。沒設截止時間就一直不公布。',
  never: '學生交卷後只看到「已交卷」，看不到分數、對錯和答案。',
}

/** A `datetime-local` value as an ISO moment, read in the browser's own time zone. */
const toIso = (local: string): string | null => (local ? new Date(local).toISOString() : null)

/** Picks an exam from the teacher's bank and how the class takes it. */
export function AssignForm({ classId, exams, preselected }: { classId: string; exams: AssignExam[]; preselected: string | null }) {
  const [examId, setExamId] = useState(preselected ?? exams[0]?.id ?? '')
  const exam = exams.find((e) => e.id === examId)
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<QuizMode>('exam')
  const [shuffleQuestions, setShuffleQuestions] = useState(true)
  const [shuffleOptions, setShuffleOptions] = useState(true)
  const [timeLimit, setTimeLimit] = useState('')
  const [maxAttempts, setMaxAttempts] = useState('1')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [answers, setAnswers] = useState<AssignmentAnswers>('after_close')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = () =>
    start(async () => {
      setError(null)
      // On success it opens the new assignment.
      const result = await createAssignment(classId, {
        examId,
        title: title || exam?.title || '',
        settings: { mode, shuffleQuestions, shuffleOptions, timeLimitMinutes: timeLimit ? Number(timeLimit) : null, maxAttempts: maxAttempts ? Number(maxAttempts) : null, answers },
        opensAt: toIso(opensAt),
        closesAt: toIso(closesAt),
      })
      if (result) setError(result.error)
    })

  const label = 'mb-1 block text-xs font-medium text-muted'
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className={label}>考卷</span>
          <Listbox label="考卷" value={examId} groups={[{ options: exams.map((e) => ({ value: e.id, label: `${e.title}（${e.count} 題）`, hint: e.hint })) }]} onChange={setExamId} className={inputClass} />
        </div>
        <label className="block">
          <span className={label}>作業名稱</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={exam?.title ?? ''} maxLength={80} className={inputClass} />
        </label>
      </div>

      <fieldset>
        <legend className={label}>模式</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['exam', '考試', '寫完交卷再計分，可以限時'],
              ['practice', '練習', '每寫完一題就看對錯'],
            ] as const
          ).map(([value, name, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-lg border p-2.5 text-left ${mode === value ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/50'}`}
            >
              <span className={`block text-sm font-medium ${mode === value ? 'text-accent' : ''}`}>{name}</span>
              <span className="mt-0.5 block text-xs text-muted">{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <label className="block">
          <span className={label}>開始時間</span>
          <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} className={`${inputBase} w-full`} />
        </label>
        <label className="block">
          <span className={label}>截止時間</span>
          <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={`${inputBase} w-full`} />
        </label>
        {mode === 'exam' && (
          <label className="block">
            <span className={label}>限時（分鐘）</span>
            <input type="number" min={1} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} placeholder="不限時" className={`${inputBase} w-full`} />
          </label>
        )}
        <label className="block">
          <span className={label}>可作答次數</span>
          <input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} placeholder="不限" className={`${inputBase} w-full`} />
        </label>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="m-check" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} />
          每個人的題目順序不同
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="m-check" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} />
          每個人的選項順序不同
        </label>
      </div>

      <div className="space-y-1.5">
        <p className={label}>公布答案</p>
        {mode === 'practice' ? (
          <p className="text-xs text-muted">練習模式每寫完一題就會看到對錯和答案。</p>
        ) : (
          <>
            <Segmented value={answers} options={ANSWERS} onChange={setAnswers} />
            <p className="text-xs text-muted">{ANSWER_NOTES[answers]}</p>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line/70 pt-4">
        <Button variant="primary" onClick={submit} loading={pending} disabled={pending || !examId}>
          派給全班
        </Button>
        <span className="text-xs text-muted">派出去的是現在這份考卷的版本；之後再改題庫，不會影響這份作業。</span>
      </div>
      {error && <p className="m-shake text-sm text-bad">{error}</p>}
    </Card>
  )
}
