'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A picked-up sheet (Trello, Linear): while mounted, it lifts a little and leans toward the way
 * the pointer moves, easing back as the pointer slows. At most 4°, smoothed every frame.
 */
export function DragTilt({ children, className = '' }: { children: ReactNode; className?: string }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let velocity = 0
    let tilt = 0
    let raf = 0
    const move = (e: PointerEvent) => {
      // sideways movement leans the most; up and down only a little, since lists move that way
      velocity += e.movementX * 0.6 + e.movementY * 0.12
    }
    const frame = () => {
      const target = Math.max(-4, Math.min(4, velocity))
      velocity = 0
      tilt += (target - tilt) * 0.18
      if (el.current) el.current.style.transform = `rotate(${tilt.toFixed(2)}deg) scale(1.02)`
      raf = requestAnimationFrame(frame)
    }
    window.addEventListener('pointermove', move)
    raf = requestAnimationFrame(frame)
    return () => {
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(raf)
    }
  }, [])
  return (
    <div ref={el} className={className} style={{ transform: 'scale(1.02)' }}>
      {children}
    </div>
  )
}
