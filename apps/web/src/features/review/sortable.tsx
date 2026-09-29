'use client'

import { closestCenter, KeyboardSensor, MouseSensor, pointerWithin, TouchSensor, useSensor, useSensors, type CollisionDetection } from '@dnd-kit/core'
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

/**
 * The item under the pointer is where the dragged one goes, however tall either is
 * (question cards differ a lot in height); the keyboard falls back to the nearest centre.
 */
export const underPointer: CollisionDetection = (args) => {
  const hits = args.pointerCoordinates ? pointerWithin(args) : []
  return hits.length ? hits : closestCenter(args)
}

/** One item in a sortable list; `children` gets the drag handle to put on an element. */
export function Sortable({ id, children, className = '' }: { id: string; children: (handle: DragHandle, dragging: boolean) => ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
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
