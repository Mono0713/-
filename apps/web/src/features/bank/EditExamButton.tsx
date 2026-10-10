'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { Button } from '@/shared/ui'
import { openExamEditor } from './actions'

/** 編輯考卷: opens the exam's editor, making a draft first when its upload is gone. */
export function EditExamButton({ examId }: { examId: string }) {
  const t = useT()
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button loading={pending} disabled={pending} onClick={() => start(async () => router.push(await openExamEditor(examId)))}>
      {t('編輯考卷')}
    </Button>
  )
}
