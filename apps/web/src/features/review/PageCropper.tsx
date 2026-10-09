'use client'

import type { Point, Quad } from '@exam/core'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { fileUrl } from '@/shared/files'
import { useT } from '@/shared/i18n/client'

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const pct = (p: Point) => ({ left: `${p.x * 100}%`, top: `${p.y * 100}%` })

/**
 * A page's photo as taken, with the paper's outline over it: each of the four corners and each of
 * the four edges is dragged on its own (an edge carries both its ends), so a sheet photographed at an
 * angle is followed exactly. Outside the outline is dimmed; 套用 flattens the inside into a rectangle.
 */
export function PageCropper({ image, quad, onChange }: { image: string; quad: Quad; onChange: (quad: Quad) => void }) {
  const t = useT()
  const area = useRef<HTMLDivElement>(null)
  // the photo's shape, so the edge grips lie along their edges
  const [aspect, setAspect] = useState(1)
  const drag = useRef<{ x: number; y: number; start: Quad; moves: number[] } | null>(null)
  const [active, setActive] = useState<string | null>(null)

  const begin = (e: ReactPointerEvent, id: string, moves: number[]) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, start: quad, moves }
    setActive(id)
  }
  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    const r = area.current?.getBoundingClientRect()
    if (!d || !r) return
    const dx = (e.clientX - d.x) / r.width
    const dy = (e.clientY - d.y) / r.height
    onChange(d.start.map((p, i) => (d.moves.includes(i) ? { x: clamp01(p.x + dx), y: clamp01(p.y + dy) } : p)) as Quad)
  }
  const end = () => {
    drag.current = null
    setActive(null)
  }
  const grip = { onPointerMove: move, onPointerUp: end, onPointerCancel: end }

  const outline = quad.map((p) => `${p.x} ${p.y}`).join(' L')
  return (
    <div ref={area} className="relative select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fileUrl(image)}
        alt={t('原始照片')}
        draggable={false}
        onLoad={(e) => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || 1)}
        className="block h-auto w-full"
      />
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <path d={`M0 0H1V1H0Z M${outline}Z`} fillRule="evenodd" className="fill-night/50" />
        <path d={`M${outline}Z`} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" className="stroke-accent" />
      </svg>
      {quad.map((a, i) => {
        const b = quad[(i + 1) % 4]!
        const angle = (Math.atan2((b.y - a.y) / aspect, b.x - a.x) * 180) / Math.PI
        const id = `edge-${i}`
        return (
          <span
            key={id}
            aria-hidden
            onPointerDown={(e) => begin(e, id, [i, (i + 1) % 4])}
            {...grip}
            style={{ ...pct({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
            className="absolute z-[2] grid h-11 w-14 cursor-grab touch-none place-items-center active:cursor-grabbing"
          >
            <span className={`block h-1.5 w-7 rounded-full bg-surface shadow ring-2 ring-accent transition-transform ${active === id ? 'scale-110' : ''}`} />
          </span>
        )
      })}
      {quad.map((p, i) => {
        const id = `corner-${i}`
        return (
          <span
            key={id}
            aria-hidden
            onPointerDown={(e) => begin(e, id, [i])}
            {...grip}
            style={{ ...pct(p), transform: 'translate(-50%, -50%)' }}
            className="absolute z-[3] grid h-11 w-11 cursor-grab touch-none place-items-center active:cursor-grabbing"
          >
            <span className={`block h-4 w-4 rounded-full bg-surface shadow ring-[3px] ring-accent transition-transform ${active === id ? 'scale-125' : ''}`} />
          </span>
        )
      })}
    </div>
  )
}
