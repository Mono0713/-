'use client'

import type { ReactNode } from 'react'
import { useT } from '@/shared/i18n/client'
import { SwipeToDelete } from '@/shared/motion/SwipeToDelete'
import { useRemoval } from '@/shared/removal'
import { deleteExam } from './actions'

/** A bank card that a finger can drag left to delete, with the same 復原 note as its trash button. */
export function SwipeDeleteExam({ id, children }: { id: string; children: ReactNode }) {
  const t = useT()
  const { remove } = useRemoval()
  return (
    <SwipeToDelete className="h-full rounded-2xl" onDelete={() => remove({ id, note: t('已刪除考卷'), commit: () => deleteExam(id) })}>
      {children}
    </SwipeToDelete>
  )
}
