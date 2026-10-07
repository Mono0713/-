'use client'

import { closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, useTransition, type ReactNode } from 'react'
import { useRemoval } from '@/shared/removal'
import { reorderExams } from './actions'

const GRID = 'm-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'

/**
 * The bank's cards as a grid the person arranges: a card follows the pointer once it is dragged a few
 * pixels (clicks still open it) or, on touch, after a short press (so the page still scrolls and a swipe
 * still deletes). The order is kept per account. `enabled` is off while a search or subject filter shows
 * only some of the cards, since a partial list cannot be placed among the rest.
 */
export function SortableExams({ items, enabled }: { items: { id: string; node: ReactNode }[]; enabled: boolean }) {
  const { isRemoved } = useRemoval()
  const [order, setOrder] = useState(() => items.map((i) => i.id))
  const [, save] = useTransition()
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 320, tolerance: 8 } }))
  const byId = new Map(items.map((i) => [i.id, i.node]))
  // new cards (added since) come first, like the server lists them
  const ids = [...items.map((i) => i.id).filter((id) => !order.includes(id)), ...order.filter((id) => byId.has(id))].filter((id) => !isRemoved(id))

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    document.documentElement.removeAttribute('data-sorting')
    if (!over || active.id === over.id) return
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    setOrder(next)
    save(() => reorderExams(next))
  }

  if (!enabled)
    return (
      <ul className={GRID}>
        {ids.map((id) => (
          <li key={id}>{byId.get(id)}</li>
        ))}
      </ul>
    )
  return (
    <DndContext
      id="bank-exams"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => document.documentElement.setAttribute('data-sorting', '')}
      onDragEnd={onDragEnd}
      onDragCancel={() => document.documentElement.removeAttribute('data-sorting')}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <ul className={GRID}>
          {ids.map((id) => (
            <Item key={id} id={id}>
              {byId.get(id)}
            </Item>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function Item({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id, transition: { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' } })
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // the card itself is the handle, so it keeps its own role (a link inside), not "button"
      role={undefined}
      aria-roledescription={undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`touch-manipulation ${isDragging ? 'relative z-20 cursor-grabbing opacity-90 [&>*]:shadow-lg' : ''}`}
    >
      {children}
    </li>
  )
}
