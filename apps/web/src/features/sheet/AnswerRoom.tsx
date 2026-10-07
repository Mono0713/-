'use client'

import { useRef, useState } from 'react'
import { useT } from '@/shared/i18n/client'

/** The handle's height in em: measured on screen, it gives the scale between the pointer and the paper. */
const GRIP_EM = 0.9

/**
 * The room left to answer in, `lines` lines high (a line is 2em): ruled for sentences, blank for working out.
 * With `onResize`, the bottom edge of the question's box can be dragged on the preview to make it taller or shorter, half a line at a
 * time down to nothing; the paper is laid out again when the drag ends. The handle never prints.
 */
export function AnswerRoom({ lines, ruled, onResize, children }: { lines: number; ruled: boolean; onResize?: (lines: number) => void; children?: React.ReactNode }) {
  const t = useT()
  const [dragging, setDragging] = useState<number | null>(null)
  const grip = useRef<HTMLSpanElement>(null)
  const shown = dragging ?? lines
  const start = (e: React.PointerEvent) => {
    if (!onResize || !grip.current) return
    e.preventDefault()
    e.stopPropagation()
    const perLine = (grip.current.getBoundingClientRect().height / GRIP_EM) * 2
    const y = e.clientY
    let next = lines
    const move = (ev: PointerEvent) => {
      next = Math.max(0, Math.round((lines + (ev.clientY - y) / perLine) * 2) / 2)
      setDragging(next)
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      setDragging(null)
      if (next !== lines) onResize(next)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }
  return (
    // no position of its own: the handle lies on the bottom edge of the whole question's box (.a4-block)
    <div className={dragging !== null ? 'sheet-room-active' : undefined}>
      <div className={ruled ? 'sheet-ruled' : undefined} style={{ minHeight: `${shown * 2}em` }}>
        {children}
      </div>
      {onResize && (
        <span
          ref={grip}
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('拖曳調整作答空間')}
          title={t('拖曳調整作答空間')}
          onPointerDown={start}
          onClick={(e) => e.stopPropagation()}
          className="sheet-grip"
          style={{ height: `${GRIP_EM}em` }}
        />
      )}
    </div>
  )
}
