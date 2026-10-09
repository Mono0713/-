'use client'

import type { BankQuestion } from '@exam/bank'
import type { DraftQuestion } from '@exam/core'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { useRemoval } from '@/shared/removal'
import { QuestionEditor } from '@/features/questions/QuestionEditor'
import { Button, Card } from '@/shared/ui'
import { deleteBankQuestion, updateBankQuestion } from './actions'

/** Edits one saved question. importId is the upload its exam came from, if it still exists. wordBank: a sentence of a 選詞填空, whose box is shared. */
export function BankQuestionEditor({ question, importId, wordBank = false }: { question: BankQuestion; importId: string | null; wordBank?: boolean }) {
  const t = useT()
  const [q, setQ] = useState<DraftQuestion>(question)
  const [state, setState] = useState<'saved' | 'dirty'>('saved')
  const [pending, start] = useTransition()
  const router = useRouter()
  const { remove } = useRemoval()

  const save = () =>
    start(async () => {
      await updateBankQuestion(question.id, q)
      setState('saved')
    })

  return (
    <Card className="p-5">
      <QuestionEditor
        value={q}
        importId={importId}
        wordBank={wordBank}
        onChange={(v) => {
          setQ(v)
          setState('dirty')
        }}
      />
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
        <Button
          variant="danger"
          onClick={() => {
            // back to the exam, where the question is already gone and a note offers 復原
            remove({ id: question.id, note: t('已刪除題目'), commit: () => deleteBankQuestion(question.id) })
            router.push(`/bank/exams/${question.examId}`)
          }}
        >
          {t('刪除')}
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">{state === 'saved' ? t('已儲存') : t('有未儲存的修改')}</span>
          <Button variant="primary" onClick={save} disabled={pending || state === 'saved'}>
            {pending ? t('儲存中…') : t('儲存')}
          </Button>
        </div>
      </div>
    </Card>
  )
}
