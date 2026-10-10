'use client'

import { useT } from '@/shared/i18n/client'
import { IconTrash } from '@/shared/icons'
import { useRemoval } from '@/shared/removal'
import { deleteExam } from './actions'

/** The trash on a bank card: the card goes at once and a note offers 復原 for a few seconds. */
export function DeleteExamButton({ id, title }: { id: string; title: string }) {
  const t = useT()
  const { remove } = useRemoval()
  return (
    <button
      type="button"
      onClick={() => remove({ id, note: t('已刪除考卷'), commit: () => deleteExam(id) })}
      aria-label={t('刪除「{title}」', { title })}
      className="m-press relative z-10 -my-1.5 grid h-7 w-7 place-items-center rounded-md text-muted transition-[opacity,color,background-color] hover:bg-bad-soft hover:text-bad focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0"
    >
      <IconTrash size={15} />
    </button>
  )
}
