'use client'

import type { BoundingBox } from '@exam/core'
import { useEffect, useRef, useState } from 'react'
import { fileUrl } from '@/shared/files'
import { useT } from '@/shared/i18n/client'
import { IconCheck, IconChevronLeft, IconChevronRight, IconLoader } from '@/shared/icons'

export interface CropPage {
  pageNumber: number
  image: string
}

type Drag = { mode: 'move' | 'draw' | `${'n' | 's' | ''}${'w' | 'e' | ''}`; x: number; y: number; start: BoundingBox; before: BoundingBox }

const MIN = 0.015
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

/**
 * Frames a figure on its original page, right inside the question card: the page shows with the
 * figure's box; drag the box to move it, its corners and edges to resize it, or draw a new one
 * anywhere on the page. Other pages are a step away. 套用 crops the picture again from the page.
 */
export function FigureCropper({
  pages,
  pageNumber,
  bbox,
  busy,
  onApply,
  onCancel,
}: {
  pages: CropPage[]
  pageNumber: number
  bbox: BoundingBox
  busy: boolean
  onApply: (pageNumber: number, bbox: BoundingBox) => void
  onCancel: () => void
}) {
  const t = useT()
  const [page, setPage] = useState(pages.some((p) => p.pageNumber === pageNumber) ? pageNumber : pages[0]!.pageNumber)
  const [box, setBox] = useState(bbox)
  const sheet = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const index = pages.findIndex((p) => p.pageNumber === page)

  // The box starts in sight when the page is taller than the room.
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const id = requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest' }))
    return () => cancelAnimationFrame(id)
  }, [page])

  const point = (e: React.PointerEvent) => {
    const r = sheet.current!.getBoundingClientRect()
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) }
  }
  const down = (e: React.PointerEvent, mode: Drag['mode']) => {
    if (busy) return
    e.preventDefault()
    e.stopPropagation()
    const p = point(e)
    drag.current = { mode, ...p, start: mode === 'draw' ? { x: p.x, y: p.y, width: 0, height: 0 } : box, before: box }
    sheet.current!.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = point(e)
    const dx = p.x - d.x, dy = p.y - d.y
    const s = d.start
    if (d.mode === 'move') return setBox({ ...s, x: clamp(s.x + dx, 0, 1 - s.width), y: clamp(s.y + dy, 0, 1 - s.height) })
    if (d.mode === 'draw') return setBox({ x: Math.min(d.x, p.x), y: Math.min(d.y, p.y), width: Math.abs(dx), height: Math.abs(dy) })
    let { x, y } = s
    let right = s.x + s.width, bottom = s.y + s.height
    if (d.mode.includes('w')) x = clamp(s.x + dx, 0, right - MIN)
    if (d.mode.includes('e')) right = clamp(right + dx, x + MIN)
    if (d.mode.includes('n')) y = clamp(s.y + dy, 0, bottom - MIN)
    if (d.mode.includes('s')) bottom = clamp(bottom + dy, y + MIN)
    setBox({ x, y, width: right - x, height: bottom - y })
  }
  const up = () => {
    // A click without a drag keeps the box it had.
    if (drag.current?.mode === 'draw' && (box.width < MIN || box.height < MIN)) setBox(drag.current.before)
    drag.current = null
  }

  const handles: { mode: Drag['mode']; className: string }[] = [
    { mode: 'nw', className: '-left-1.5 -top-1.5 cursor-nwse-resize' },
    { mode: 'ne', className: '-right-1.5 -top-1.5 cursor-nesw-resize' },
    { mode: 'sw', className: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
    { mode: 'se', className: '-bottom-1.5 -right-1.5 cursor-nwse-resize' },
    { mode: 'n', className: '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
    { mode: 's', className: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
    { mode: 'w', className: '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
    { mode: 'e', className: '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
  ]
  const usable = box.width >= MIN && box.height >= MIN
  const step = 'm-press grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-ink/[0.06] hover:text-ink disabled:opacity-30'

  return (
    <div className="m-expand space-y-2">
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-line bg-paper">
        <div ref={sheet} className="relative cursor-crosshair touch-none select-none overflow-hidden" onPointerDown={(e) => down(e, 'draw')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileUrl(pages[index]!.image)} alt={t('第 {n} 頁', { n: page })} draggable={false} className="block w-full bg-white" />
          {usable && (
            <div
              ref={frame}
              onPointerDown={(e) => down(e, 'move')}
              className="absolute cursor-move rounded-[2px] outline-2 outline-accent shadow-[0_0_0_9999px_rgb(15_21_40/0.38)]"
              style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}
            >
              {handles.map((h) => (
                <span key={h.mode} onPointerDown={(e) => down(e, h.mode)} className={`absolute grid h-3 w-3 place-items-center ${h.className}`}>
                  {/* a bigger grab area than the dot it shows */}
                  <span className="absolute -inset-2" />
                  <span className="h-2 w-2 rounded-[2px] bg-white ring-[1.5px] ring-accent" />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-1">
        {pages.length > 1 && (
          <div className="flex items-center gap-0.5 text-xs text-muted">
            <button type="button" className={step} disabled={index <= 0 || busy} onClick={() => setPage(pages[index - 1]!.pageNumber)} aria-label={t('上一頁')}>
              <IconChevronLeft size={15} />
            </button>
            <span className="num min-w-12 text-center">{t('第 {n} 頁', { n: page })}</span>
            <button type="button" className={step} disabled={index >= pages.length - 1 || busy} onClick={() => setPage(pages[index + 1]!.pageNumber)} aria-label={t('下一頁')}>
              <IconChevronRight size={15} />
            </button>
          </div>
        )}
        <span className="min-w-0 flex-1 basis-40 text-[11px] text-muted">{t('拖曳框線調整範圍，或在頁面上重畫一個框。')}</span>
        <button type="button" onClick={onCancel} disabled={busy} className="m-press h-8 rounded-lg px-3 text-xs text-muted hover:bg-ink/[0.05] hover:text-ink">
          {t('取消')}
        </button>
        <button
          type="button"
          onClick={() => onApply(page, box)}
          disabled={busy || !usable}
          className="m-press flex h-8 items-center gap-1 rounded-lg bg-accent pl-2 pr-3 text-xs font-medium text-on-accent disabled:opacity-50"
        >
          {busy ? <IconLoader size={14} className="m-spin" /> : <IconCheck size={14} strokeWidth={2.6} />}
          {t('套用')}
        </button>
      </div>
    </div>
  )
}
