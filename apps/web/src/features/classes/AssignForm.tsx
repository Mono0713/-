'use client'

import type { AssignmentAnswers } from '@exam/classes'
import type { QuizMode } from '@exam/quiz'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { msg } from '@/shared/i18n/format'
import { Segmented } from '@/shared/Segmented'
import { Button, Card, inputBase, inputClass } from '@/shared/ui'
import { createAssignments } from './actions'
import { ExamPicker, type AssignExam } from './ExamPicker'

export type { AssignExam } from './ExamPicker'

/** A class the person teaches, to give the exam to. */
export interface AssignClass {
  id: string
  name: string
  students: number
}

const ANSWERS = [
  ['after_submit', msg('交卷後')],
  ['after_close', msg('截止後')],
  ['never', msg('不公布')],
] as const satisfies readonly (readonly [AssignmentAnswers, string])[]

const ANSWER_NOTES: Record<AssignmentAnswers, string> = {
  after_submit: msg('學生交卷後就看得到答案和詳解（練習模式是每做完一題）。'),
  after_close: msg('截止時間到了才公布答案和成績，避免先交的人把答案傳出去。在那之前學生交卷後只看到「已交卷」。沒設截止時間就一直不公布。'),
  never: msg('學生交卷後只看到「已交卷」，看不到分數、對錯和答案。'),
}

/** A `datetime-local` value as an ISO moment, read in the browser's own time zone. */
const toIso = (local: string): string | null => (local ? new Date(local).toISOString() : null)

/** Exams are taken once unless the teacher allows more; practice as often as students like. */
const DEFAULT_ATTEMPTS: Record<QuizMode, string> = { exam: '1', practice: '' }

/** Picks an exam from the teacher's bank, the classes to give it to, and how they take it. */
export function AssignForm({ classes, chosen, exams, preselected }: { classes: AssignClass[]; chosen: string[]; exams: AssignExam[]; preselected: string | null }) {
  const t = useT()
  const [examId, setExamId] = useState(preselected ?? exams[0]?.id ?? '')
  const exam = exams.find((e) => e.id === examId)
  const [classIds, setClassIds] = useState<string[]>(() => (chosen.length ? chosen : classes.length === 1 ? [classes[0]!.id] : []))
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<QuizMode>('exam')
  const [shuffleQuestions, setShuffleQuestions] = useState(true)
  const [shuffleOptions, setShuffleOptions] = useState(true)
  const [timeLimit, setTimeLimit] = useState('')
  const [maxAttempts, setMaxAttempts] = useState(DEFAULT_ATTEMPTS.exam)
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [answers, setAnswers] = useState<AssignmentAnswers>('after_close')
  const [fullscreen, setFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const pickMode = (next: QuizMode) => {
    setMode(next)
    setMaxAttempts(DEFAULT_ATTEMPTS[next])
  }
  const toggleClass = (id: string) => setClassIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const submit = () =>
    start(async () => {
      setError(null)
      // On success it opens the new assignment, or the classes when it went to several.
      const result = await createAssignments(classIds, {
        examId,
        title: title || exam?.title || '',
        settings: { mode, shuffleQuestions, shuffleOptions, timeLimitMinutes: timeLimit ? Number(timeLimit) : null, maxAttempts: maxAttempts ? Number(maxAttempts) : null, answers, fullscreen },
        opensAt: toIso(opensAt),
        closesAt: toIso(closesAt),
      })
      if (result) setError(result.error)
    })

  const label = 'mb-1 block text-xs font-medium text-muted'
  const attempts = (
    <label className="block">
      <span className={label}>{t('可作答次數')}</span>
      <input autoComplete="off" type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} placeholder={t('不限')} className={`${inputBase} w-full`} />
    </label>
  )
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div>
        <span className={label}>{t('考卷')}</span>
        <ExamPicker exams={exams} value={examId} onChange={setExamId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className={label}>{t('派給')}</span>
          <div className="flex flex-wrap gap-1.5">
            {classes.map((c) => {
              const on = classIds.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleClass(c.id)}
                  className={`m-press rounded-lg border px-3 py-1.5 text-left text-sm ${on ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:border-accent/50'}`}
                >
                  {c.name}
                  <span className="ml-1.5 text-xs text-muted">{t('{n} 位學生', { n: c.students })}</span>
                </button>
              )
            })}
          </div>
        </div>
        <label className="block">
          <span className={label}>{t('作業名稱')}</span>
          <input autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={exam?.title ?? ''} maxLength={80} className={inputClass} />
        </label>
      </div>

      <fieldset>
        <legend className={label}>{t('模式')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['exam', t('考試'), t('寫完交卷再計分，可以限時')],
              ['practice', t('練習'), t('每寫完一題就看對錯')],
            ] as const
          ).map(([value, name, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => pickMode(value)}
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
          <span className={label}>{t('開始時間')}</span>
          <input autoComplete="off" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} className={`${inputBase} w-full`} />
        </label>
        <label className="block">
          <span className={label}>{t('截止時間')}</span>
          <input autoComplete="off" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={`${inputBase} w-full`} />
        </label>
        {attempts}
        {mode === 'exam' && (
          <label className="block">
            <span className={label}>{t('限時（分鐘）')}</span>
            <input autoComplete="off" type="number" min={1} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} placeholder={t('不限時')} className={`${inputBase} w-full`} />
          </label>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="m-check" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} />
            {t('每個人的題目順序不同')}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="m-check" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} />
            {t('每個人的選項順序不同')}
          </label>
          {mode === 'exam' && (
            <label className="flex items-center gap-2">
              <input type="checkbox" className="m-check" checked={fullscreen} onChange={(e) => setFullscreen(e.target.checked)} />
              {t('考試時全螢幕')}
            </label>
          )}
        </div>
        {mode === 'exam' && (
          <p className="text-xs text-muted">
            {t('考試會記錄學生離開畫面、切換視窗、按截圖鍵和複製貼上的次數，老師在成績表看得到。')}
            {fullscreen && ` ${t('全螢幕時離開全螢幕也會記錄；iPhone 不支援全螢幕，只記錄離開畫面。')}`}
          </p>
        )}
        {exam && (
          <p className="text-xs text-muted">
            {exam.multiplePartial ? t('多選題部分給分（學測規則），照考卷的設定。') : t('多選題全對才給分，照考卷的設定。')}{' '}
            <Link href={`/bank/exams/${exam.id}`} className="text-accent hover:underline">
              {t('到題庫修改')}
            </Link>
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className={label}>{t('公布答案')}</p>
        {mode === 'practice' ? (
          <p className="text-xs text-muted">{t('練習模式每寫完一題就會看到對錯和答案。')}</p>
        ) : (
          <>
            <Segmented value={answers} options={ANSWERS.map(([v, l]) => [v, t(l)] as const)} onChange={setAnswers} />
            <p className="text-xs text-muted">{t(ANSWER_NOTES[answers])}</p>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line/70 pt-4">
        <Button variant="primary" onClick={submit} loading={pending} disabled={pending || !examId || classIds.length === 0}>
          {classIds.length > 1 ? t('派給 {n} 個班級', { n: classIds.length }) : t('派出作業')}
        </Button>
        <span className="text-xs text-muted">{t('派出去的是現在這份考卷的版本；之後再改題庫，不會影響這份作業。')}</span>
      </div>
      {error && <p className="m-shake text-sm text-bad">{error}</p>}
    </Card>
  )
}
