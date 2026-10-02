'use client'

import {
  closestCenter,
  DragOverlay,
  useDndContext,
  useDndMonitor,
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
import { useEffect, useMemo, useRef, type HTMLAttributes, type ReactNode } from 'react'

/** What goes on the element that starts a drag (a grip button, or a whole row). */
export type DragHandle = HTMLAttributes<HTMLElement> & { ref: (el: HTMLElement | null) => void }

/**
 * Drag sensors. Rows that are also clicked (the outline): the mouse after a few pixels, so clicks
 * still click, and touch after a short press, so the list still scrolls. Grip-only lists (`grip`):
 * the item is picked up as soon as the pointer moves at all, since the grip does nothing else.
 * Where asked, the keyboard too.
 */
export function useDragSensors(keyboard: boolean, grip = false) {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: grip ? 0 : 5 } }),
    useSensor(TouchSensor, { activationConstraint: grip ? { distance: 0 } : { delay: 180, tolerance: 8 } }),
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
  // Every item re-renders on each pointer move of a drag (dnd-kit's context changes); only its
  // position does, so its content is kept unless the item itself changed. Big lists stay smooth.
  const content = useMemo(() => children({ ref: setActivatorNodeRef, ...attributes, ...listeners }, isDragging), [children, setActivatorNodeRef, attributes, listeners, isDragging])
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative ${isDragging ? 'z-20' : ''} ${className}`}
    >
      {content}
    </div>
  )
}

/**
 * Scrolls the page while a drag rests near its top or bottom edge, in place of dnd-kit's own
 * scroller (which steps every 5 ms, starts a fifth of the screen away and only follows the
 * pointer's last direction). Here the speed eases in with the depth into a band at each edge,
 * eases between speeds and is applied once per frame, so it glides. `top` is where the visible
 * list starts (below a sticky toolbar). Put it inside the DndContext and pass `autoScroll={false}`.
 */
export function EdgeScroll({ top = 0 }: { top?: number }) {
  const state = useRef({ dragging: false, y: -1 })
  const topRef = useRef(top)
  topRef.current = top
  const loop = useRef<() => void>(null)
  useDndMonitor({
    onDragStart: () => {
      state.current.dragging = true
      loop.current?.()
    },
    onDragEnd: () => void (state.current.dragging = false),
    onDragCancel: () => void (state.current.dragging = false),
  })
  useEffect(() => {
    const BAND = 110
    const MAX = 1400 // px per second at the very edge
    const track = (e: PointerEvent | TouchEvent) => {
      state.current.y = 'touches' in e ? (e.touches[0]?.clientY ?? state.current.y) : e.clientY
    }
    let raf = 0
    let speed = 0
    let carry = 0
    let last = 0
    const frame = (t: number) => {
      const dt = last ? Math.min(40, t - last) / 1000 : 0
      last = t
      const { dragging, y } = state.current
      const upper = topRef.current + BAND
      const lower = window.innerHeight - BAND
      const depth = !dragging || y < 0 ? 0 : y < upper ? -(upper - y) / BAND : y > lower ? (y - lower) / BAND : 0
      const k = Math.max(-1, Math.min(1, depth))
      const target = Math.sign(k) * k * k * MAX
      // ease toward the target speed so starting and stopping never jerk
      // (a drop stops it at once, so the page never drifts under the landing card)
      speed = dragging ? speed + (target - speed) * Math.min(1, dt * 12) : 0
      if (Math.abs(speed) < 4 && target === 0) speed = 0
      carry += speed * dt
      const whole = Math.trunc(carry)
      if (whole) {
        window.scrollBy({ top: whole, behavior: 'instant' })
        carry -= whole
      }
      if (dragging || speed) raf = requestAnimationFrame(frame)
      else {
        raf = 0
        last = 0
        carry = 0
      }
    }
    loop.current = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }
    window.addEventListener('pointerdown', track, { passive: true })
    window.addEventListener('pointermove', track, { passive: true })
    window.addEventListener('touchmove', track, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', track)
      window.removeEventListener('pointermove', track)
      window.removeEventListener('touchmove', track)
      cancelAnimationFrame(raf)
    }
  }, [])
  return null
}

/**
 * The copy that follows the pointer, drawn by `render` for the dragged item's id. It reads the drag
 * from dnd-kit itself rather than from the list's state, so picking an item up re-renders only this,
 * not the whole page.
 */
export function ActiveOverlay({ render }: { render: (id: string) => ReactNode }) {
  const { active } = useDndContext()
  return (
    <DragOverlay dropAnimation={dropAnimation} modifiers={[alongList]}>
      {active ? render(String(active.id)) : null}
    </DragOverlay>
  )
}
