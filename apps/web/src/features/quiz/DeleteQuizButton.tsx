'use client'

import { useRouter } from 'next/navigation'
import { IconTrash } from '@/shared/icons'
import { useRemoval } from '@/shared/removal'
import { Button } from '@/shared/ui'
import { removeQuiz } from './actions'

/** Back to the list, where the quiz is gone at once and a note offers 復原 for a few seconds. */
export function DeleteQuizButton({ quizId, label = '刪除紀錄', note = '已刪除測驗紀錄', iconOnly = false }: { quizId: string; label?: string; note?: string; iconOnly?: boolean }) {
  const router = useRouter()
  const { remove } = useRemoval()
  return (
    <Button
      variant="ghost"
      icon={<IconTrash size={iconOnly ? 17 : 15} />}
      aria-label={iconOnly ? label : undefined}
      className={iconOnly ? 'px-2.5 text-muted hover:bg-bad-soft hover:text-bad' : ''}
      onClick={() => {
        remove({ id: quizId, note, commit: () => removeQuiz(quizId) })
        router.push('/quiz')
      }}
    >
      {!iconOnly && label}
    </Button>
  )
}
