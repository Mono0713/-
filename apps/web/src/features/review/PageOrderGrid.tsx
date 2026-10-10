'use client'

import { closestCenter, DndContext, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useT } from '@/shared/i18n/client'
import { IconChevronLeft, IconChevronRight } from '@/shared/icons'
import { pageUrl, type SourcePage } from './usePageCrops'

/**
 * The original's pages small, in a grid, dragged into the order they belong in (or moved one place
 * with the arrows). Each shows the place it will take; a page that moved also says where it was.
 */
export function PageOrderGrid({ pages, order, onChange }: { pages: SourcePage[]; order: number[]; onChange: (order: number[]) => void }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    onChange(arrayMove(order, order.indexOf(Number(active.id)), order.indexOf(Number(over.id))))
  }
  const move = (at: number, by: number) => onChange(arrayMove(order, at, at + by))
  return (
    <DndContext id="page-order" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <ol className="grid grid-cols-2 gap-3 pb-1 pt-14 sm:grid-cols-3">
          {order.map((n, at) => (
            <Tile key={n} page={pages.find((p) => p.pageNumber === n)!} at={at} count={order.length} onMove={(by) => move(at, by)} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function Tile({ page, at, count, onMove }: { page: SourcePage; at: number; count: number; onMove: (by: number) => void }) {
  const t = useT()
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: page.pageNumber, transition: { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' } })
  const arrow = 'm-press grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-accent-soft hover:text-accent disabled:opacity-30 disabled:hover:bg-transparent'
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative ${isDragging ? 'z-10 opacity-90' : ''}`}
    >
      <figure
        {...attributes}
        {...listeners}
        aria-label={t('第 {n} 頁', { n: at + 1 })}
        className={`relative cursor-grab touch-manipulation overflow-hidden rounded-lg bg-surface shadow-sheet ring-accent active:cursor-grabbing ${isDragging ? 'shadow-lg ring-2' : ''}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pageUrl(page)} alt="" draggable={false} className="block aspect-[1/1.414] w-full bg-white object-cover object-top" />
        <span className="absolute left-2 top-2 grid h-7 min-w-7 place-items-center rounded-full bg-night/85 px-2 text-sm font-semibold text-white">{at + 1}</span>
      </figure>
      <div className="mt-1 flex items-center justify-between text-xs text-muted">
        <button type="button" onClick={() => onMove(-1)} disabled={at === 0} className={arrow} aria-label={t('往前移')} title={t('往前移')}>
          <IconChevronLeft size={16} />
        </button>
        <span>{page.pageNumber !== at + 1 ? t('原本第 {n} 頁', { n: page.pageNumber }) : ''}</span>
        <button type="button" onClick={() => onMove(1)} disabled={at === count - 1} className={arrow} aria-label={t('往後移')} title={t('往後移')}>
          <IconChevronRight size={16} />
        </button>
      </div>
    </li>
  )
}
