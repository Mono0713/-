'use client'

import type { BankExam, ExamPatch } from '@exam/bank'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { useRemoval } from '@/shared/removal'
import { Button, Card, inputClass } from '@/shared/ui'
import { deleteExam, updateExamMeta } from './actions'

const FIELDS = [
  ['title', msg('考卷名稱')],
  ['subject', msg('科目')],
  ['institution', msg('學校')],
  ['term', msg('學期')],
] as const

/** Title, subject and the rest of an exam's details, and how it is scored, saved on demand. */
export function ExamMetaForm({ exam }: { exam: BankExam }) {
  const t = useT()
  const [meta, setMeta] = useState<ExamPatch>(() => ({ ...Object.fromEntries(FIELDS.map(([k]) => [k, exam[k]])), multiplePartial: exam.multiplePartial }))
  const [dirty, setDirty] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()
  const { remove } = useRemoval()

  return (
    <Card className="p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FIELDS.map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">{t(label)}</span>
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
      {/* Scoring belongs to the exam, so every quiz, assignment and share link of it counts the same way. */}
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="m-check mt-0.5"
          checked={meta.multiplePartial ?? true}
          onChange={(e) => {
            setMeta((m) => ({ ...m, multiplePartial: e.target.checked }))
            setDirty(true)
          }}
        />
        <span>
          {t('多選題部分給分')}
          <span className="block text-xs text-muted">{t('每錯一個選項扣 2/n 的分數，扣完為止（學測規則）')}</span>
        </span>
      </label>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Button
          variant="danger"
          onClick={() => {
            // back to the bank, where the card is already gone and a note offers 復原
            remove({ id: exam.id, note: t('已刪除考卷'), commit: () => deleteExam(exam.id) })
            router.push('/bank')
          }}
        >
          {t('刪除考卷')}
        </Button>
        <Button variant="primary" disabled={!dirty || pending} onClick={() => start(async () => { await updateExamMeta(exam.id, meta); setDirty(false) })}>
          {pending ? t('儲存中…') : dirty ? t('儲存') : t('已儲存')}
        </Button>
      </div>
    </Card>
  )
}
