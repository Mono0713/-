'use client'

import type { DraftQuestion } from '@exam/core'
import type { QuizMode } from '@exam/quiz'
import { useState, useTransition } from 'react'
import { QuestionView } from '@/features/questions/QuestionView'
import { useT } from '@/shared/i18n/client'
import { TYPE_LABELS } from '@/shared/labels'
import { Badge, Button, Card, inputBase } from '@/shared/ui'
import { createQuiz } from './actions'

export interface SetupExam {
  id: string
  title: string
  subject: string | null
  /** Questions without their answers, explanations or translations. */
  questions: { id: string; question: DraftQuestion; preview: string; hasKey: boolean }[]
}

/** Pick exams and questions, then how to take them. */
export function QuizSetup({ exams, preselected }: { exams: SetupExam[]; preselected: string[] }) {
  const t = useT()
  const [selected, setSelected] = useState(() => new Set(exams.filter((e) => preselected.includes(e.id)).flatMap((e) => e.questions.map((q) => q.id))))
  const [open, setOpen] = useState<Set<string>>(() => new Set(preselected))
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [mode, setMode] = useState<QuizMode>('practice')
  const [shuffleQuestions, setShuffleQuestions] = useState(true)
  const [shuffleOptions, setShuffleOptions] = useState(true)
  const [timeLimit, setTimeLimit] = useState('')
  const [limit, setLimit] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const toggle = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  const toggleOpen = (id: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const count = selected.size
  const drawn = limit ? Math.min(count, Math.max(1, Number(limit))) : count

  const submit = () => {
    setError(null)
    // Keep the bank order; shuffling happens on the server when asked for.
    const questionIds = exams.flatMap((e) => e.questions.filter((q) => selected.has(q.id)).map((q) => q.id))
    start(async () => {
      // On success the action redirects to the new quiz.
      const result = await createQuiz({
        questionIds,
        limit: limit ? drawn : null,
        settings: { mode, shuffleQuestions, shuffleOptions, timeLimitMinutes: mode === 'exam' && timeLimit ? Number(timeLimit) : null },
      })
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="grid grid-cols-1 gap-6 pb-20 lg:grid-cols-[minmax(0,1fr)_20rem] lg:pb-0">
      <div className="min-w-0 space-y-3">
        <p className="text-sm text-muted">{t('選擇要考的考卷，展開後可以只挑其中幾題。')}</p>
        {exams.map((e) => {
          const ids = e.questions.map((q) => q.id)
          const picked = ids.filter((id) => selected.has(id)).length
          const isOpen = open.has(e.id)
          return (
            <Card key={e.id} className="p-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={picked === ids.length && ids.length > 0}
                  ref={(el) => {
                    if (el) el.indeterminate = picked > 0 && picked < ids.length
                  }}
                  onChange={(ev) => toggle(ids, ev.target.checked)}
                  aria-label={t('選擇 {title}', { title: e.title })}
                  className="m-check mt-0.5"
                />
                <button type="button" onClick={() => toggleOpen(e.id)} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left">
                  <span className="line-clamp-2 min-w-0 font-medium sm:flex-1">{e.title}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {e.subject && <Badge tone="accent">{e.subject}</Badge>}
                    <span className="text-xs text-muted">
                      {picked ? t('已選 {picked} / {total}', { picked, total: ids.length }) : t('{n} 題', { n: ids.length })} {isOpen ? '▴' : '▾'}
                    </span>
                  </span>
                </button>
              </div>
              {isOpen && (
                <ul className="mt-3 space-y-1 border-t border-line pt-2">
                  {e.questions.map(({ id, question: q, preview, hasKey }, i) => (
                    <li key={id}>
                      {q.section && q.section !== e.questions[i - 1]?.question.section && <p className="mt-2 mb-1 px-1 text-xs font-medium text-muted">{q.section}</p>}
                      <div className="flex items-start gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-paper">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 sm:gap-3">
                          <input type="checkbox" checked={selected.has(id)} onChange={(ev) => toggle([id], ev.target.checked)} className="m-check mt-px" />
                          <span className="w-6 shrink-0 font-medium tabular-nums text-muted">{q.number}</span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2">
                              <Badge>{t(TYPE_LABELS[q.type])}</Badge> {preview}
                            </span>
                            {!hasKey && <span className="text-xs text-warn">{t('沒有標準答案')}</span>}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setPreviewing(previewing === id ? null : id)}
                          className="shrink-0 rounded-md px-2 py-0.5 text-xs text-accent hover:bg-accent-soft"
                          aria-expanded={previewing === id}
                        >
                          {previewing === id ? t('收起') : t('看題目')}
                        </button>
                      </div>
                      {previewing === id && (
                        <div className="mb-2 ml-7 rounded-lg border border-line bg-paper p-3">
                          <QuestionView q={q} compact />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Card className="space-y-5 p-4">
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-muted">{t('模式')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['practice', t('單題練習'), t('每寫完一題就看答案與詳解')],
                  ['exam', t('考試'), t('寫完交卷再計分，可以限時')],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`rounded-lg border p-2.5 text-left ${mode === value ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/50'}`}
                >
                  <span className={`block text-sm font-medium ${mode === value ? 'text-accent' : ''}`}>{label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="m-check" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} />
              {t('題目順序隨機')}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="m-check" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} />
              {t('選項順序隨機')}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">{t('隨機抽題')}</span>
              <input autoComplete="off" type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder={t('全部')} className={`${inputBase} w-full`} />
            </label>
            {mode === 'exam' && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">{t('限時（分鐘）')}</span>
                <input autoComplete="off" type="number" min={1} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} placeholder={t('不限時')} className={`${inputBase} w-full`} />
              </label>
            )}
          </div>

          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="hidden lg:block">
            <Button variant="primary" className="w-full" onClick={submit} disabled={!count || pending}>
              {pending ? t('準備中…') : count ? t('開始（{n} 題）', { n: drawn }) : t('請先選題目')}
            </Button>
          </div>
        </Card>
      </aside>

      {/* On phones the settings sit below a long list, so starting stays in reach at the bottom. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 p-3 backdrop-blur lg:hidden">
        <Button variant="primary" className="w-full" onClick={submit} disabled={!count || pending}>
          {pending ? t('準備中…') : count ? t('開始（{n} 題）', { n: drawn }) : t('請先選題目')}
        </Button>
      </div>
    </div>
  )
}
