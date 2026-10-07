'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconChevronLeft, IconChevronRight, IconMinus, IconPlus } from '@/shared/icons'

/** Zoom steps of a page viewer, as a share of the fitted width. */
export const ZOOMS = [1, 1.25, 1.5, 2, 2.5]

/**
 * The controls fade to see-through when the pointer has been away from them for a moment, and come back
 * as it nears them (or on any tap, for touch screens). `near` goes on the scrolling area around them.
 */
export function usePageControls() {
  const controls = useRef<HTMLDivElement>(null)
  const [idle, setIdle] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const wake = () => {
    setIdle(false)
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      if (!controls.current?.matches(':hover, :focus-within')) setIdle(true)
    }, 2200)
  }
  useEffect(() => {
    wake()
    return () => clearTimeout(idleTimer.current)
  }, [])
  const near = (e: ReactPointerEvent) => {
    if (e.pointerType === 'touch') return wake()
    const r = controls.current?.firstElementChild?.getBoundingClientRect()
    if (!r) return
    const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right)
    const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom)
    if (Math.hypot(dx, dy) < 90) wake()
  }
  return { controls, idle, wake, near }
}

export const pill = 'm-press grid h-8 w-8 place-items-center rounded-full hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent'

/**
 * The navy pill floating over the bottom of a page viewer: previous / page n of total / next (with more than
 * one page), zoom out, the zoom (pressed: fit the width), zoom in, and any `extra` buttons after a divider.
 */
export function PageControls({
  state,
  current,
  total,
  onPage,
  zoom,
  onZoom,
  extra,
}: {
  state: ReturnType<typeof usePageControls>
  /** The page in view, counted from 1. */
  current: number
  total: number
  onPage: (page: number) => void
  /** Index into ZOOMS. */
  zoom: number
  onZoom: (zoom: number) => void
  extra?: React.ReactNode
}) {
  const t = useT()
  const { controls, idle, wake } = state
  return (
    <div ref={controls} onPointerEnter={wake} onPointerLeave={wake} onFocus={wake} className="pointer-events-none sticky bottom-3 left-0 z-10 flex justify-start pt-2 sm:justify-center">
      <div
        data-idle={idle || undefined}
        className="pointer-events-auto flex translate-y-0 items-center transition-[opacity,translate] duration-300 data-[idle]:translate-y-1 data-[idle]:opacity-30 data-[idle]:duration-700"
      >
        <div className="flex items-center gap-0.5 rounded-full bg-night/85 px-1 py-1 text-xs text-white shadow-[0_10px_30px_-12px_rgb(22_24_43/0.6)] backdrop-blur-md">
          {total > 1 && (
            <>
              <button type="button" className={pill} onClick={() => onPage(current - 1)} disabled={current <= 1} aria-label={t('上一頁')} title={t('上一頁')}>
                <IconChevronLeft size={15} />
              </button>
              <span className="num min-w-10 text-center tabular-nums" aria-live="polite">
                {current}
                <span className="text-white/50">/{total}</span>
              </span>
              <button type="button" className={pill} onClick={() => onPage(current + 1)} disabled={current >= total} aria-label={t('下一頁')} title={t('下一頁')}>
                <IconChevronRight size={15} />
              </button>
              <span className="mx-0.5 h-4 w-px bg-white/20" />
            </>
          )}
          <button type="button" className={pill} onClick={() => onZoom(Math.max(0, zoom - 1))} disabled={zoom === 0} aria-label={t('縮小')} title={t('縮小')}>
            <IconMinus size={14} />
          </button>
          <button type="button" onClick={() => onZoom(0)} className="num min-w-11 rounded-full py-1.5 text-center tabular-nums hover:bg-white/15" title={t('符合寬度')}>
            {Math.round(ZOOMS[zoom]! * 100)}%
          </button>
          <button type="button" className={pill} onClick={() => onZoom(Math.min(ZOOMS.length - 1, zoom + 1))} disabled={zoom === ZOOMS.length - 1} aria-label={t('放大')} title={t('放大')}>
            <IconPlus size={14} />
          </button>
          {extra && (
            <>
              <span className="mx-0.5 h-4 w-px bg-white/20" />
              {extra}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** The page number in the top-left corner of a page, as on the original pages. */
export function PageBadge({ n }: { n: number }) {
  return <span className="num pointer-events-none absolute left-2 top-2 z-[2] rounded-md bg-night/70 px-1.5 py-0.5 text-[11px] text-white backdrop-blur">{n}</span>
}
