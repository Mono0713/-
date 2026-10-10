'use client'

import { useEffect, useRef, type RefObject } from 'react'

/** Touches that start here belong to the element itself: writing, typing, choosing, or scrolling it sideways. */
const OWN_GESTURES = 'input, textarea, select, [contenteditable], math-field, svg.touch-none, .touch-none, .katex-display, table, [data-no-swipe]'

/** Starts this close to a screen edge are the phone's own back and forward gestures. */
const EDGE = 24

/**
 * Horizontal swipes on touch screens: a quick, mostly sideways stroke calls `onLeft` (finger moved left)
 * or `onRight`. The element follows the finger a little while dragging, so the gesture feels held;
 * mouse and pen input are ignored, and so are strokes that start on something with gestures of its own.
 */
export function useSwipe(ref: RefObject<HTMLElement | null>, { onLeft, onRight }: { onLeft?: () => void; onRight?: () => void }) {
  const handlers = useRef({ onLeft, onRight })
  handlers.current = { onLeft, onRight }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let start: { x: number; y: number; at: number } | null = null
    let sideways = false

    const reset = () => {
      el.style.transition = 'translate 220ms var(--m-ease-out)'
      el.style.translate = ''
      start = null
      sideways = false
    }
    const down = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (e.touches.length !== 1 || !touch) return (start = null)
      const target = e.target as Element | null
      if (target?.closest(OWN_GESTURES) || touch.clientX < EDGE || touch.clientX > innerWidth - EDGE) return (start = null)
      start = { x: touch.clientX, y: touch.clientY, at: performance.now() }
      sideways = false
    }
    const move = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!start || !touch) return
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      if (!sideways) {
        // decide once, after a few pixels: a mostly vertical stroke is a scroll and is left alone
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
        if (Math.abs(dx) < Math.abs(dy) * 1.5) return reset()
        sideways = true
      }
      const allowed = dx < 0 ? handlers.current.onLeft : handlers.current.onRight
      // a small, damped follow; capped so the sheet never travels far
      const shift = Math.max(-28, Math.min(28, dx * (allowed ? 0.25 : 0.08)))
      el.style.transition = 'none'
      el.style.translate = `${shift}px 0`
    }
    const up = (e: TouchEvent) => {
      const touch = e.changedTouches[0]
      if (!start || !touch || !sideways) return reset()
      const dx = touch.clientX - start.x
      const quick = performance.now() - start.at < 600
      reset()
      if (Math.abs(dx) < (quick ? 50 : 90)) return
      if (dx < 0) handlers.current.onLeft?.()
      else handlers.current.onRight?.()
    }

    el.addEventListener('touchstart', down, { passive: true })
    el.addEventListener('touchmove', move, { passive: true })
    el.addEventListener('touchend', up)
    el.addEventListener('touchcancel', reset)
    return () => {
      el.removeEventListener('touchstart', down)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', up)
      el.removeEventListener('touchcancel', reset)
    }
  }, [ref])
}
