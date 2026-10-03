'use client'

import type { BankExam } from '@exam/bank'
import type { ExamMeta } from '@exam/core'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useRemoval } from '@/shared/removal'
import { Button, Card, inputClass } from '@/shared/ui'
import { deleteExam, updateExamMeta } from './actions'

const FIELDS = [
  ['title', '考卷名稱'],
  ['subject', '科目'],
  ['institution', '學校'],
  ['term', '學期'],
] as const

/** Title, subject and the rest of an exam's details, saved on demand. */
export function ExamMetaForm({ exam }: { exam: BankExam }) {
  const [meta, setMeta] = useState<Partial<ExamMeta>>(() => Object.fromEntries(FIELDS.map(([k]) => [k, exam[k]])))
  const [dirty, setDirty] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()
  const { remove } = useRemoval()

  return (
    <Card className="p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FIELDS.map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
            <input
              autoComplete="off"
              value={meta[key] ?? ''}
              onChange={(e) => {
                setMeta((m) => ({ ...m, [key]: e.target.value.trim() ? e.target.value : null }))
                setDirty(true)
              }}
              className={inputClass}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Button
          variant="danger"
          onClick={() => {
            // back to the bank, where the card is already gone and a note offers 復原
            remove({ id: exam.id, note: '已刪除考卷', commit: () => deleteExam(exam.id) })
            router.push('/bank')
          }}
        >
          刪除考卷
        </Button>
        <Button variant="primary" disabled={!dirty || pending} onClick={() => start(async () => { await updateExamMeta(exam.id, meta); setDirty(false) })}>
          {pending ? '儲存中…' : dirty ? '儲存' : '已儲存'}
        </Button>
      </div>
    </Card>
  )
}
