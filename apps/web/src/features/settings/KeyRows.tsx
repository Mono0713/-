'use client'

import { closestCenter, DndContext, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, useTransition, type ReactNode } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconGrip, IconKey, IconTrash } from '@/shared/icons'
import { useRemoval } from '@/shared/removal'
import { removeApiKey, reorderApiKeys } from './actions'
import type { SavedKey } from './ApiKeys'

/**
 * A service's saved keys, top one used first: each line has its last characters and a delete button,
 * and with two or more a grip to drag it up or down (touch: press briefly first). The order is saved.
 */
export function KeyRows({ provider, name, keys }: { provider: string; name: string; keys: SavedKey[] }) {
  const t = useT()
  const { remove } = useRemoval()
  const [order, setOrder] = useState(() => keys.map((k) => k.slot))
  const [, save] = useTransition()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const bySlot = new Map(keys.map((k) => [k.slot, k]))
  // keys added since keep their place at the end
  const slots = [...order.filter((s) => bySlot.has(s)), ...keys.map((k) => k.slot).filter((s) => !order.includes(s))]
  const sortable = slots.length > 1

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const next = arrayMove(slots, slots.indexOf(String(active.id)), slots.indexOf(String(over.id)))
    setOrder(next)
    save(() => reorderApiKeys(provider, next))
  }

  return (
    <DndContext id={`keys-${provider}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={slots} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1">
          {slots.map((slot) => {
            const k = bySlot.get(slot)!
            return (
              <Row key={slot} slot={slot} sortable={sortable} gripLabel={t('拖曳調整金鑰 …{hint} 的順序', { hint: k.hint ?? '' })}>
                <IconKey size={14} aria-hidden className="shrink-0" />
                <span className="font-mono text-xs">{k.hint ? `…${k.hint}` : t('已設定金鑰')}</span>
                <button
                  type="button"
                  onClick={() => remove({ id: `key:${slot}`, note: t('已移除 {name} 的金鑰', { name }), commit: () => removeApiKey(provider, slot) })}
                  aria-label={t('移除金鑰 …{hint}', { hint: k.hint ?? '' })}
                  className="m-press grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-bad-soft hover:text-bad"
                >
                  <IconTrash size={15} />
                </button>
              </Row>
            )
          })}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function Row({ slot, sortable, gripLabel, children }: { slot: string; sortable: boolean; gripLabel: string; children: ReactNode }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: slot,
    disabled: !sortable,
    transition: { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform && { ...transform, x: 0 }), transition }}
      className={`flex w-fit items-center gap-2 rounded-md pr-1 text-sm text-muted ${isDragging ? 'relative z-10 bg-surface shadow-md' : ''}`}
    >
      {sortable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={gripLabel}
          className={`grid h-7 w-5 shrink-0 touch-none place-items-center text-muted/70 hover:text-ink ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <IconGrip size={15} />
        </button>
      )}
      {children}
    </li>
  )
}
