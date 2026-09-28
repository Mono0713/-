'use client'

import { useTransition } from 'react'
import { Button } from '@/shared/ui'
import { deleteQuiz } from './actions'

export function DeleteQuizButton({ quizId }: { quizId: string }) {
  const [pending, start] = useTransition()
  return (
    <Button variant="danger" disabled={pending} onClick={() => confirm('刪除這次測驗紀錄？') && start(() => deleteQuiz(quizId))}>
      刪除紀錄
    </Button>
  )
}
