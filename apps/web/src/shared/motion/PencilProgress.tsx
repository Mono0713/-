'use client'

import { useLayoutEffect, useRef } from 'react'
import { useCountUp } from './AnimatedNumber'

const LINE = 'M2 9 C70 7 140 11 268 8'

/**
 * A progress bar drawn by a pencil (Stripe's progress, redrawn): the pencil's tip sits on the
 * line's end and leaves a ballpoint-blue stroke behind it; what is left is a dotted guide.
 * `value` is 0..1 and eases whenever it changes.
 */
export function PencilProgress({ value, label }: { value: number; label: string }) {
  const shown = useCountUp(Math.max(0, Math.min(1, value)), 1200)
  const track = useRef<HTMLDivElement>(null)
  const done = useRef<SVGPathElement>(null)
  const pencil = useRef<SVGSVGElement>(null)

  useLayoutEffect(() => {
    const path = done.current, box = track.current, pen = pencil.current
    if (!path || !box || !pen) return
    const length = path.getTotalLength()
    path.style.strokeDasharray = `${length} ${length + 4}`
    path.style.strokeDashoffset = String(length * (1 - shown) + 0.5)
    // the viewBox is stretched to the track, so map the point into pixels; the tip is at (5.2, 20.8) of the 26px icon
    const point = path.getPointAtLength(shown * length)
    pen.style.transform = `translate(${point.x * (box.clientWidth / 270) - 5.2}px, ${point.y * (box.clientHeight / 16) - 20.8}px)`
  }, [shown])

  return (
    <div className="grid gap-2.5">
      <div className="flex justify-between text-sm text-muted">
        <span>{label}</span>
        <b className="num text-ink">{Math.round(shown * 100)}%</b>
      </div>
      <div ref={track} className="relative h-4" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label}>
        <svg viewBox="0 0 270 16" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <path d={LINE} fill="none" stroke="var(--color-line)" strokeWidth={3} strokeDasharray="2 6" />
          <path ref={done} d={LINE} fill="none" stroke="var(--color-accent)" strokeWidth={3} strokeDasharray="0 1000" />
        </svg>
        <svg ref={pencil} viewBox="0 0 26 26" className="absolute left-0 top-0 h-[26px] w-[26px] overflow-visible" aria-hidden>
          <g transform="rotate(45 13 13)">
            <rect x="9" y="1" width="8" height="16" rx="1.5" fill="var(--color-hl)" stroke="var(--color-ink)" strokeWidth="1.2" />
            <path d="M9 17 L13 24 L17 17 Z" fill="#f2d3a8" stroke="var(--color-ink)" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M12 21.6 L13 24 L14 21.6 Z" fill="var(--color-ink)" />
          </g>
        </svg>
      </div>
    </div>
  )
}
