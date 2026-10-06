'use client'

import { DndContext, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { DraftQuestion } from '@exam/core'
import { IconCheck, IconPlus, IconX } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { TYPE_LABELS } from '@/shared/labels'
import { markSymbols } from '@/shared/markSymbols'
import { Glide } from '@/shared/motion/Glide'
import { alongList, listMeasuring, Sortable, underPointer, type useDragSensors } from './sortable'

/** Short plain-text preview of a question stem for the outline. */
function preview(stem: string) {
  return stem
    .replace(/\$\$?[^$]*\$\$?/g, '…')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/-{3,}/g, '')
    .replace(/[#*_`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Left column when opened: the exam's details and every question with its review state; rows can be dragged. */
export function Outline({
  questions,
  keys,
  visibleKeys,
  sensors,
  onDragEnd,
  selected,
  flaggedOnly,
  isFlagged,
  onSelect,
  onAdd,
  onClose,
  meta,
}: {
  questions: DraftQuestion[]
  keys: string[]
  visibleKeys: string[]
  sensors: ReturnType<typeof useDragSensors>
  onDragEnd: (e: DragEndEvent) => void
  selected: number | null
  flaggedOnly: boolean
  isFlagged: (q: DraftQuestion) => boolean
  onSelect: (index: number) => void
  onAdd: () => void
  onClose: () => void
  meta: React.ReactNode
}) {
  const t = useT()
  return (
    <nav
      aria-label={t('題目大綱')}
      className="m-enter -ml-2 mr-3 hidden w-[248px] shrink-0 space-y-6 self-start px-2 lg:sticky lg:top-[calc(var(--bar)+1rem)] lg:block lg:max-h-[calc(100dvh-var(--bar)-1.5rem)] lg:overflow-y-auto lg:pb-4 [scrollbar-gutter:stable]"
    >
      <section>
        <p className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold tracking-[0.12em] text-muted">
          {t('考卷資訊')}
          <button type="button" onClick={onClose} className="m-press grid h-6 w-6 place-items-center rounded-md hover:bg-ink/[0.05] hover:text-ink" aria-label={t('收起題目大綱')} title={t('收起題目大綱')}>
            <IconX size={14} />
          </button>
        </p>
        <div className="space-y-2.5 rounded-2xl bg-surface p-3 shadow-sheet">{meta}</div>
      </section>
      <section>
        <p className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold tracking-[0.12em] text-muted">
          {t('題目')} <span className="num tracking-normal">{questions.length}</span>
        </p>
        <DndContext id="review-outline" sensors={sensors} collisionDetection={underPointer} modifiers={[alongList]} measuring={listMeasuring} onDragEnd={onDragEnd}>
          <SortableContext items={visibleKeys} strategy={verticalListSortingStrategy}>
            <Glide>
            <ol className="space-y-px">
              {questions.map((q, index) => {
                if (flaggedOnly && !isFlagged(q)) return null
                const on = selected === index
                const section = q.section && q.section !== questions[index - 1]?.section ? q.section : null
                return (
                  <li key={keys[index]}>
                    {section && <p className="mb-1 mt-3 truncate px-2 text-[11px] text-muted/80">{markSymbols(section)}</p>}
                    <Sortable id={keys[index]!}>
                      {(handle, dragging) => (
                        <button
                          type="button"
                          {...handle}
                          onClick={() => onSelect(index)}
                          title={t('點一下跳到這題，拖曳可以排序')}
                          data-glide
                          className={`relative flex w-full touch-manipulation items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] ${
                            dragging ? 'bg-surface text-ink shadow-[0_12px_28px_-10px_rgb(22_24_43/0.35),0_0_0_1px_rgb(22_24_43/0.08)]' : on ? 'bg-surface text-ink shadow-sheet' : 'text-muted hover:text-ink'
                          }`}
                        >
                          <span className={`num w-6 shrink-0 text-right text-[12px] ${on ? 'text-accent' : ''}`}>{q.number}</span>
                          <span className="min-w-0 flex-1 truncate">{preview(q.stem) || t(TYPE_LABELS[q.type])}</span>
                          {isFlagged(q) ? (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-hl" title={t('待確認')} />
                          ) : (
                            <IconCheck size={13} strokeWidth={2.6} className="shrink-0 text-good/70" aria-label={t('已確認')} />
                          )}
                        </button>
                      )}
                    </Sortable>
                  </li>
                )
              })}
            </ol>
            </Glide>
          </SortableContext>
        </DndContext>
        <button type="button" onClick={onAdd} className="m-press mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted hover:bg-ink/[0.04] hover:text-accent">
          <IconPlus size={14} className="ml-2.5" /> {t('新增題目')}
        </button>
      </section>
    </nav>
  )
}
