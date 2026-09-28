'use client'

import type { QuizMode } from '@exam/quiz'
import { useState, useTransition } from 'react'
import { TYPE_LABELS } from '@/shared/labels'
import { Badge, Button, Card, inputBase } from '@/shared/ui'
import { createQuiz } from './actions'

export interface SetupExam {
  id: string
  title: string
  subject: string | null
  questions: { id: string; section: string | null; number: string; type: keyof typeof TYPE_LABELS; preview: string; hasKey: boolean }[]
}

/** Pick exams and questions, then how to take them. */
export function QuizSetup({ exams, preselected }: { exams: SetupExam[]; preselected: string[] }) {
  const [selected, setSelected] = useState(() => new Set(exams.filter((e) => preselected.includes(e.id)).flatMap((e) => e.questions.map((q) => q.id))))
  const [open, setOpen] = useState<Set<string>>(() => new Set(preselected))
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-3">
        <p className="text-sm text-muted">選擇要考的考卷，展開後可以只挑其中幾題。</p>
        {exams.map((e) => {
          const ids = e.questions.map((q) => q.id)
          const picked = ids.filter((id) => selected.has(id)).length
          const isOpen = open.has(e.id)
          return (
            <Card key={e.id} className="p-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={picked === ids.length && ids.length > 0}
                  ref={(el) => {
                    if (el) el.indeterminate = picked > 0 && picked < ids.length
                  }}
                  onChange={(ev) => toggle(ids, ev.target.checked)}
                  aria-label={`選擇 ${e.title}`}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                <button type="button" onClick={() => toggleOpen(e.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className="truncate font-medium">{e.title}</span>
                  {e.subject && <Badge tone="accent">{e.subject}</Badge>}
                  <span className="ml-auto shrink-0 text-xs text-muted">
                    {picked ? `已選 ${picked} / ${ids.length}` : `${ids.length} 題`} {isOpen ? '▴' : '▾'}
                  </span>
                </button>
              </div>
              {isOpen && (
                <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto border-t border-line pt-2">
                  {e.questions.map((q, i) => (
                    <li key={q.id}>
                      {q.section && q.section !== e.questions[i - 1]?.section && <p className="mt-2 mb-1 truncate px-1 text-xs font-medium text-muted">{q.section}</p>}
                      <label className="flex cursor-pointer items-start gap-3 rounded-md px-1 py-1 text-sm hover:bg-paper">
                        <input type="checkbox" checked={selected.has(q.id)} onChange={(ev) => toggle([q.id], ev.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="w-8 shrink-0 font-medium tabular-nums text-muted">{q.number}</span>
                        <Badge>{TYPE_LABELS[q.type]}</Badge>
                        <span className="min-w-0 flex-1 truncate">{q.preview}</span>
                        {!q.hasKey && <span className="shrink-0 text-xs text-warn">無答案</span>}
                      </label>
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
            <legend className="mb-2 text-xs font-medium text-muted">模式</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['practice', '單題練習', '每寫完一題就看答案與詳解'],
                  ['exam', '考試', '寫完交卷再計分，可以限時'],
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
              <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} />
              題目順序隨機
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} />
              選項順序隨機（選擇題）
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">隨機抽題</span>
              <input type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="全部" className={`${inputBase} w-full`} />
            </label>
            {mode === 'exam' && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">限時（分鐘）</span>
                <input type="number" min={1} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} placeholder="不限時" className={`${inputBase} w-full`} />
              </label>
            )}
          </div>

          {error && <p className="text-sm text-bad">{error}</p>}
          <Button variant="primary" className="w-full" onClick={submit} disabled={!count || pending}>
            {pending ? '準備中…' : count ? `開始（${drawn} 題）` : '請先選題目'}
          </Button>
        </Card>
      </aside>
    </div>
  )
}
