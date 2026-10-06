'use client'

import { useState } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconCheck, IconSearch } from '@/shared/icons'
import { inputClass } from '@/shared/ui'

export interface AssignExam {
  id: string
  title: string
  count: number
  subject: string | null
  /** School, term and when it was added, to tell apart exams with the same title. */
  hint?: string
  /** Set on the exam in the bank; the assignment counts multiple choice the same way. */
  multiplePartial: boolean
}

/**
 * The teacher's exams as a list that stays open: a search field and the subjects on top,
 * newest first, so one exam among many is found by typing a word or tapping its subject.
 */
export function ExamPicker({ exams, value, onChange }: { exams: AssignExam[]; value: string; onChange: (id: string) => void }) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState<string | null>(null)
  const subjects = [...new Set(exams.map((e) => e.subject).filter((s): s is string => Boolean(s)))]
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const shown = exams.filter((e) => {
    if (subject && e.subject !== subject) return false
    const text = [e.title, e.subject, e.hint].filter(Boolean).join(' ').toLowerCase()
    return words.every((w) => text.includes(w))
  })
  const chip = (on: boolean) => `m-press rounded-full border px-2.5 py-0.5 text-xs ${on ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:border-accent/50'}`

  return (
    <div className="space-y-2">
      {exams.length > 5 && (
        <div className="relative">
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('搜尋考卷名稱、科目、學校')} aria-label={t('搜尋考卷')} className={`${inputClass} pl-9`} />
        </div>
      )}
      {subjects.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chip(subject === null)} onClick={() => setSubject(null)}>
            {t('全部')}
          </button>
          {subjects.map((s) => (
            <button key={s} type="button" className={chip(subject === s)} onClick={() => setSubject(subject === s ? null : s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <ul role="listbox" aria-label={t('考卷')} className="max-h-72 space-y-1 overflow-y-auto overscroll-contain rounded-lg border border-line p-1">
        {shown.map((e) => {
          const on = e.id === value
          return (
            <li key={e.id}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => onChange(e.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${on ? 'bg-accent-soft' : 'hover:bg-paper'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${on ? 'text-accent' : ''}`}>{e.title}</span>
                  <span className="block truncate text-xs text-muted">{[t('{n} 題', { n: e.count }), e.subject, e.hint].filter(Boolean).join(' · ')}</span>
                </span>
                {on && <IconCheck size={16} className="shrink-0 text-accent" />}
              </button>
            </li>
          )
        })}
        {shown.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">{t('沒有符合的考卷')}</li>}
      </ul>
    </div>
  )
}
