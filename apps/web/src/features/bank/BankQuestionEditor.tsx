'use client'

import type { BankQuestion } from '@exam/bank'
import type { DraftQuestion } from '@exam/core'
import { useState, useTransition } from 'react'
import { QuestionEditor } from '@/features/questions/QuestionEditor'
import { Button, Card, inputClass } from '@/shared/ui'
import { deleteBankQuestion, updateBankQuestion } from './actions'

export function BankQuestionEditor({ question }: { question: BankQuestion }) {
  const [q, setQ] = useState<DraftQuestion>(question)
  const [subject, setSubject] = useState(question.subject ?? '')
  const [state, setState] = useState<'saved' | 'dirty'>('saved')
  const [pending, start] = useTransition()

  const save = () =>
    start(async () => {
      await updateBankQuestion(question.id, q, subject.trim() || null)
      setState('saved')
    })

  return (
    <Card className="p-5">
      <label className="mb-4 block text-sm">
        <span className="mb-1 block text-xs font-medium text-muted">科目</span>
        <input
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value)
            setState('dirty')
          }}
          className={inputClass}
        />
      </label>
      <QuestionEditor
        value={q}
        importId={question.importId}
        onChange={(v) => {
          setQ(v)
          setState('dirty')
        }}
      />
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
        <Button variant="danger" onClick={() => confirm('從題庫刪除這一題？') && start(() => deleteBankQuestion(question.id))}>
          刪除
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">{state === 'saved' ? '已儲存' : '有未儲存的修改'}</span>
          <Button variant="primary" onClick={save} disabled={pending || state === 'saved'}>
            {pending ? '儲存中…' : '儲存'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
