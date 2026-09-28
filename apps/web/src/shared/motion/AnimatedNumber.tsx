'use client'

import { useEffect, useRef, useState } from 'react'

const easeOut = (p: number) => 1 - Math.pow(1 - p, 4)

/** Eases from 0 to `value` after hydration (or from the old value when it changes). */
export function useCountUp(value: number, duration = 900) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = value
      setShown(value)
      return
    }
    const start = performance.now(), a = from.current
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const v = a + (value - a) * easeOut(p)
      from.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return shown
}

/** Counts up from 0 to `value` once it mounts. */
export function AnimatedNumber({ value, duration = 900, format = (n: number) => String(Math.round(n)) }: { value: number; duration?: number; format?: (n: number) => string }) {
  return <span className="tabular-nums">{format(useCountUp(value, duration))}</span>
}
