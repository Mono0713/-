'use client'

import {
  closestCenter,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DropAnimation,
  type MeasuringConfiguration,
  type Modifier,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { HTMLAttributes, ReactNode } from 'react'

/** What goes on the element that starts a drag (a grip button, or a whole row). */
export type DragHandle = HTMLAttributes<HTMLElement> & { ref: (el: HTMLElement | null) => void }

/**
 * Drag sensors: the mouse after a few pixels (so clicks still click), touch after a short
 * press (so the list still scrolls on phones and tablets) and, where asked, the keyboard.
 */
export function useDragSensors(keyboard: boolean) {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: keyboard ? undefined : { start: [], cancel: [], end: [] } }),
  )
}

/** Lists are reordered up and down only. */
export const alongList: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/** Items move as the list changes under a drag (the dragged one shrinks to a slot), so they are measured throughout. */
export const listMeasuring: MeasuringConfiguration = { droppable: { strategy: MeasuringStrategy.Always } }

/** The same easing as the app's other motion: quick start, soft landing. */
const EASE = 'cubic-bezier(0.2, 0, 0, 1)'
export const dropAnimation: DropAnimation = { duration: 220, easing: EASE }

/**
 * Where the dragged item goes: past every item whose middle the pointer has passed, as in a
 * phone's lists. So the slot stays next to the pointer however tall the items are (question cards
 * differ a lot), and moving the pointer back never makes it jump. The keyboard uses the nearest centre.
 */
export const underPointer: CollisionDetection = (args) => {
  const y = args.pointerCoordinates?.y
  if (y === undefined) return closestCenter(args)
  // Items in list order, measured where they sit without the drag's shifts.
  const items = args.droppableContainers
    .map((container) => ({ container, rect: args.droppableRects.get(container.id) }))
    .filter((item): item is { container: (typeof args.droppableContainers)[number]; rect: NonNullable<typeof item.rect> } => Boolean(item.rect))
    .sort((a, b) => a.rect.top - b.rect.top)
  if (!items.length) return []
  const passed = items.filter(({ container, rect }) => container.id !== args.active.id && rect.top + rect.height / 2 < y).length
  const target = items[Math.min(passed, items.length - 1)]!
  return [{ id: target.container.id, data: { droppableContainer: target.container, value: 0 } }]
}

/** One item in a sortable list; `children` gets the drag handle to put on an element. */
export function Sortable({ id, children, className = '' }: { id: string; children: (handle: DragHandle, dragging: boolean) => ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, transition: { duration: 240, easing: EASE } })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative ${isDragging ? 'z-20' : ''} ${className}`}
    >
      {children({ ref: setActivatorNodeRef, ...attributes, ...listeners }, isDragging)}
    </div>
  )
}
