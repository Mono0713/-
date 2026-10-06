'use client'

import type { DraftQuestion } from '@exam/core'
import { useT } from '@/shared/i18n/client'
import { IconEdit, IconGrip, IconIndent, IconLoader, IconOutdent, IconSplit, IconTrash } from '@/shared/icons'
import { attachToPrevious, splitNumber, splitParts } from './parts'
import { iconButton } from './ReviewToolbar'
import type { DragHandle } from './sortable'
import type { useReviewDraft } from './useReviewDraft'
import type { SolveJob } from './useSolver'

type Draft = ReturnType<typeof useReviewDraft>

/** The grip that drags a card to reorder it. */
export function GripButton({ q, handle }: { q: DraftQuestion; handle: DragHandle }) {
  const t = useT()
  return (
    <button type="button" {...handle} className={`${iconButton} cursor-grab touch-none active:cursor-grabbing`} aria-label={t('拖曳第 {n} 題來排序', { n: q.number })} title={t('拖曳排序')}>
      <IconGrip size={16} />
    </button>
  )
}

/**
 * A card's buttons when it is not being edited: AI at work, split into sub-questions, and on the
 * selected card, make it a sub-question of the one before or take it out of its group; then edit,
 * delete and the drag grip. The dragged copy draws the same row (inert, `handle` null) so it lines up.
 */
export function CardActions({ d, q, index, busy, handle }: { d: Draft; q: DraftQuestion; index: number; busy?: SolveJob; handle: DragHandle | null }) {
  const t = useT()
  const chosen = d.selected === index
  const before = index > 0 ? d.draft.questions[index - 1]! : null
  return (
    <>
      {busy && (
        <span className={`${iconButton} !text-accent`} title={busy === 'answer' ? t('AI 作答中…') : t('AI 撰寫中…')}>
          <IconLoader size={15} className="m-spin" />
        </span>
      )}
      {!q.groupId && splitParts(q, '') && (
        <button type="button" onClick={() => d.splitQuestion(index)} className={iconButton} aria-label={t('拆成小題')} title={t('拆成小題：(a)(b) 各自一題，可以分別作答和計分')}>
          <IconSplit size={15} />
        </button>
      )}
      {chosen && before && attachToPrevious(d.draft, index, '') && (
        <button type="button" onClick={() => d.attachPart(index)} className={iconButton} aria-label={t('把第 {n} 題設為第 {main} 題的小題', { n: q.number, main: splitNumber(before.number).main })} title={t('把第 {n} 題設為第 {main} 題的小題', { n: q.number, main: splitNumber(before.number).main })}>
          <IconIndent size={15} />
        </button>
      )}
      {chosen && q.groupId && (
        <button type="button" onClick={() => d.detachQuestion(index)} className={iconButton} aria-label={t('把第 {n} 題移出小題', { n: q.number })} title={t('把第 {n} 題移出小題', { n: q.number })}>
          <IconOutdent size={15} />
        </button>
      )}
      <button type="button" onClick={() => d.setEditing(index)} className={iconButton} aria-label={t('編輯')} title={t('編輯（或點兩下題目）')}>
        <IconEdit size={15} />
      </button>
      <button type="button" onClick={() => d.removeQuestion(index)} className={`${iconButton} hover:bg-bad-soft hover:text-bad`} aria-label={t('刪除')} title={t('刪除')}>
        <IconTrash size={15} />
      </button>
      {handle ? (
        <GripButton q={q} handle={handle} />
      ) : (
        <span className={iconButton.replace('text-muted', 'text-accent')}>
          <IconGrip size={16} />
        </span>
      )}
    </>
  )
}
