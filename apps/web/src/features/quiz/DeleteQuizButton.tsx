'use client'

import { useRouter } from 'next/navigation'
import { IconTrash } from '@/shared/icons'
import { Button } from '@/shared/ui'

/** Back to the list, where the quiz is gone at once and a note offers 復原 for a few seconds. */
export function DeleteQuizButton({ quizId, label = '刪除紀錄' }: { quizId: string; label?: string }) {
  const router = useRouter()
  return (
    <Button variant="ghost" icon={<IconTrash size={15} />} onClick={() => router.push(`/quiz?removed=${encodeURIComponent(quizId)}`)}>
      {label}
    </Button>
  )
}
