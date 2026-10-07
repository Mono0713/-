'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconTrash } from '@/shared/icons'

/**
 * Touch screens: drag a row to the left to delete it. Past about a third of its width (or with a quick
 * flick) it slides away and `onDelete` runs, which is expected to offer 復原 like every other delete;
 * short of that it springs back. Mouse and pen are ignored, so desktop keeps its trash button.
 */
export function SwipeToDelete({ onDelete, className = '', children }: { onDelete: () => void; className?: string; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const done = useRef(onDelete)
  done.current = onDelete
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const box = outer.current
    const row = inner.current
    if (!box || !row) return
    let start: { x: number; y: number; at: number } | null = null
    let sideways = false
    let dx = 0
    // a drag must not also open the row's link when the finger lifts
    let swallowClick = false

    const place = (x: number, animate: boolean) => {
      row.style.transition = animate ? 'translate 260ms var(--m-ease-out)' : 'none'
      row.style.translate = x ? `${x}px 0` : ''
    }
    const down = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (e.touches.length !== 1 || !touch || touch.clientX < 24) return (start = null)
      start = { x: touch.clientX, y: touch.clientY, at: performance.now() }
      sideways = false
      dx = 0
    }
    const move = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!start || !touch) return
      // a card being rearranged follows the finger; it is not a swipe to delete
      if (document.documentElement.hasAttribute('data-sorting')) return (start = null)
      const x = touch.clientX - start.x
      const y = touch.clientY - start.y
      if (!sideways) {
        if (Math.abs(x) < 10 && Math.abs(y) < 10) return
        if (x > 0 || Math.abs(x) < Math.abs(y) * 1.5) return (start = null)
        sideways = true
        setDragging(true)
      }
      dx = Math.min(0, x)
      place(dx, false)
    }
    const up = () => {
      if (!start || !sideways) return (start = null)
      swallowClick = true
      setTimeout(() => (swallowClick = false), 400)
      const width = box.offsetWidth
      const flick = performance.now() - start.at < 300 && dx < -80
      start = null
      if (dx < -width / 3 || flick) {
        place(-width, true)
        setTimeout(() => {
          done.current()
          place(0, false)
          setDragging(false)
        }, 240)
      } else {
        place(0, true)
        setTimeout(() => setDragging(false), 260)
      }
    }
    const click = (e: MouseEvent) => {
      if (!swallowClick) return
      e.preventDefault()
      e.stopPropagation()
    }

    box.addEventListener('touchstart', down, { passive: true })
    box.addEventListener('touchmove', move, { passive: true })
    box.addEventListener('touchend', up)
    box.addEventListener('touchcancel', up)
    box.addEventListener('click', click, true)
    return () => {
      box.removeEventListener('touchstart', down)
      box.removeEventListener('touchmove', move)
      box.removeEventListener('touchend', up)
      box.removeEventListener('touchcancel', up)
      box.removeEventListener('click', click, true)
    }
  }, [])

  return (
    <div ref={outer} className={`relative touch-pan-y ${dragging ? 'overflow-hidden' : ''} ${className}`}>
      {dragging && (
        <div aria-hidden className="absolute inset-0 flex items-center justify-end rounded-[inherit] bg-bad pr-6 text-white">
          <IconTrash size={20} />
        </div>
      )}
      <div ref={inner} className="relative h-full rounded-[inherit] bg-surface">
        {children}
      </div>
    </div>
  )
}
