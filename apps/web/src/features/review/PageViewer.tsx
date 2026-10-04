'use client'

import { untangleBoxes, type DraftQuestion } from '@exam/core'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { fileUrl } from '@/shared/files'
import { useT } from '@/shared/i18n/client'
import { IconChevronLeft, IconChevronRight, IconExternal, IconLoader, IconMinus, IconPlus } from '@/shared/icons'
import { GRIPS, type Box } from './boxGeometry'
import { useBoxEditing } from './useBoxEditing'

const ZOOMS = [1, 1.25, 1.5, 2, 2.5]

/**
 * Every source page, one under the other, with a box around each question: the selected one is
 * highlighted and scrolled into view, clicking a box selects it. Page and zoom controls float
 * over the bottom of the pages, so the pages get all the room. The root is the scroll container
 * where the layout gives it a height (`className`); otherwise the pages flow with the window.
 */
export function PageViewer({
  pages,
  questions,
  selected,
  onSelect,
  onBoxChange,
  className = '',
}: {
  pages: { pageNumber: number; image: string }[]
  questions: DraftQuestion[]
  selected: number | null
  onSelect: (index: number) => void
  /** Given, the selected question's box can be moved and resized, and dragged onto another page (`pageNumber`). */
  onBoxChange?: (index: number, location: number, bbox: Box, pageNumber?: number) => void
  className?: string
}) {
  const t = useT()
  const scroller = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(0)
  const [current, setCurrent] = useState(pages[0]?.pageNumber ?? 1)
  // Pages that have finished loading; until then each shows a page-shaped placeholder with a spinner.
  const [loaded, setLoaded] = useState<Record<number, 'ok' | 'error'>>({})
  const done = (pageNumber: number, state: 'ok' | 'error') => setLoaded((l) => (l[pageNumber] === state ? l : { ...l, [pageNumber]: state }))
  // Boxes are outlined one by one once, when their page first shows. After that the class is dropped,
  // so nothing that re-renders or remounts a box (editing it, reordering questions) replays the reveal.
  const [revealed, setRevealed] = useState<Record<number, true>>({})
  useEffect(() => {
    const timers = Object.entries(loaded)
      .filter(([n, state]) => state === 'ok' && !revealed[Number(n)])
      .map(([n]) => {
        const count = questions.reduce((c, q) => c + q.locations.filter((l) => l.pageNumber === Number(n)).length, 0)
        return setTimeout(() => setRevealed((r) => ({ ...r, [n]: true })), 250 + count * 140 + 1400)
      })
    return () => timers.forEach(clearTimeout)
    // counted when the page loads; later edits do not restart the wait
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])
  // Boxes drawn over the start of the next question are trimmed where it begins.
  const boxes = useMemo(() => untangleBoxes(questions), [questions])
  const scrolls = () => {
    const el = scroller.current
    return !!el && el.scrollHeight > el.clientHeight
  }

  // Bring the selected question's box into view unless it already is.
  useEffect(() => {
    const el = scroller.current
    if (!el || selected === null || !scrolls()) return
    const box = el.querySelector<HTMLElement>(`[data-q="${selected}"]`)
    if (!box) return
    const view = el.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    const inside = b.top >= view.top && b.bottom <= view.bottom && b.left >= view.left && b.right <= view.right
    if (inside) return
    const fits = b.height < view.height
    el.scrollBy({
      top: b.top - view.top - (fits ? view.height * 0.15 : 8),
      left: b.left < view.left || b.right > view.right ? b.left - view.left - 16 : 0,
      behavior: 'smooth',
    })
  }, [selected, zoom])

  // The page a third of the way down the visible area is the current one.
  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const line = scrolls() ? el.getBoundingClientRect().top + el.clientHeight / 3 : innerHeight / 3
    let page = pages[0]?.pageNumber ?? 1
    for (const p of el.querySelectorAll<HTMLElement>('[data-page]')) if (p.getBoundingClientRect().top <= line) page = Number(p.dataset.page)
    setCurrent(page)
  }
  // On phones the pages scroll with the window instead.
  useEffect(() => {
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  })

  // The page controls fade to see-through when the pointer has been away from them for a moment,
  // and come back as it nears them (or on any tap, for touch screens).
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
  const nearControls = (e: ReactPointerEvent) => {
    if (e.pointerType === 'touch') return wake()
    const r = controls.current?.firstElementChild?.getBoundingClientRect()
    if (!r) return
    const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right)
    const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom)
    if (Math.hypot(dx, dy) < 90) wake()
  }

  const goTo = (pageNumber: number) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-page="${pageNumber}"]`)
    if (!el) return
    if (scrolls()) scroller.current!.scrollBy({ top: el.getBoundingClientRect().top - scroller.current!.getBoundingClientRect().top, behavior: 'smooth' })
    else el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Zoomed in, the pages can be grabbed and moved with the mouse or pen (touch already pans).
  // A press that moves more than a few pixels is a pan, and the click that ends it selects nothing;
  // a press that stays put is a click on whatever is under it (a question's box).
  const strip = useRef<HTMLDivElement>(null)
  const [panning, setPanning] = useState(false)
  const pan = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const startPan = (e: ReactPointerEvent) => {
    if (zoom === 0 || e.pointerType === 'touch' || e.button !== 0) return
    pan.current = { x: e.clientX, y: e.clientY, moved: false }
  }
  const movePan = (e: ReactPointerEvent) => {
    const p = pan.current
    if (!p) return
    if (e.buttons === 0) return endPan() // released outside before the pan began
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (!p.moved && Math.hypot(dx, dy) < 4) return
    if (!p.moved) {
      // only a real pan captures the pointer, so a plain click still reaches the question's box
      setPanning(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    p.moved = true
    p.x = e.clientX
    p.y = e.clientY
    strip.current?.scrollBy({ left: -dx, behavior: 'instant' })
    const el = scroller.current
    if (el && scrolls()) el.scrollBy({ left: -dx, top: -dy, behavior: 'instant' })
    else window.scrollBy({ top: -dy, behavior: 'instant' })
  }
  const endPan = () => {
    if (pan.current?.moved) {
      // swallow the click that follows a pan
      const stop = (ev: MouseEvent) => {
        ev.stopPropagation()
        ev.preventDefault()
      }
      addEventListener('click', stop, { capture: true, once: true })
      setTimeout(() => removeEventListener('click', stop, { capture: true }), 0)
    }
    pan.current = null
    setPanning(false)
  }

  const { live, carried, startEdit } = useBoxEditing({ scroller, scrolls, onBoxChange })

  if (!pages.length) return null
  const scale = ZOOMS[zoom]!
  const index = Math.max(0, pages.findIndex((p) => p.pageNumber === current))
  const pill = 'm-press grid h-8 w-8 place-items-center rounded-full hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent'

  return (
    // A column, so the controls sit at the bottom of the viewer even before the pages fill it.
    <div ref={scroller} onScroll={onScroll} onPointerMove={nearControls} onPointerDown={nearControls} className={`relative flex flex-col ${className}`}>
      {/* Zoomed pages scroll sideways here on phones; wider screens scroll the whole viewer. */}
      <div ref={strip} className="flex-1 overflow-x-auto lg:overflow-visible">
        <div
          className={`space-y-3 pb-1 ${zoom > 0 ? (panning ? 'cursor-grabbing select-none' : 'cursor-grab') : ''}`}
          style={{ width: `${scale * 100}%` }}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onDragStart={(e) => zoom > 0 && e.preventDefault()}
        >
          {pages.map((page) => (
            <figure
              key={page.pageNumber}
              data-page={page.pageNumber}
              className="group relative overflow-hidden rounded-lg bg-surface shadow-sheet"
              // An A4-shaped page holds the place until the image arrives, so nothing jumps around much.
              style={loaded[page.pageNumber] ? undefined : { aspectRatio: '1 / 1.414' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={(img) => {
                  // A cached image may have loaded before React attached onLoad.
                  if (img?.complete && img.naturalWidth) done(page.pageNumber, 'ok')
                }}
                src={fileUrl(page.image)}
                alt={t('第 {n} 頁', { n: page.pageNumber })}
                onLoad={() => done(page.pageNumber, 'ok')}
                onError={() => done(page.pageNumber, 'error')}
                className={`block h-auto w-full transition-opacity duration-300 ${loaded[page.pageNumber] === 'ok' ? 'opacity-100' : 'absolute inset-0 opacity-0'}`}
              />
              {!loaded[page.pageNumber] && (
                // The spinner sits in the upper part of the page, where it is in view.
                <div className="absolute inset-0 flex justify-center pt-[38%]" role="status" aria-label={t('第 {n} 頁載入中', { n: page.pageNumber })}>
                  <div className="flex flex-col items-center gap-2 text-muted">
                    <IconLoader size={26} className="m-spin text-accent" />
                    <span className="text-xs">{t('載入考卷中…')}</span>
                  </div>
                </div>
              )}
              {loaded[page.pageNumber] === 'error' && (
                <div className="absolute inset-0 grid place-items-center text-sm text-muted" role="alert">
                  {t('這一頁的圖片載入失敗')}
                </div>
              )}
              {loaded[page.pageNumber] === 'ok' &&
                boxes
                  .flatMap((q, index) =>
                    q.locations
                      .map((l, location) => ({ l, location, index, moving: live !== null && live.index === index && live.location === location }))
                      // a box being carried shows on the page under the pointer
                      .filter(({ l, moving }) => (moving ? live!.pageNumber : l.pageNumber) === page.pageNumber),
                  )
                  .map(({ l, location, index, moving }, order) => {
                    const box = moving ? live!.bbox : l.bbox
                    const place = {
                      '--i': order,
                      left: `${box.x * 100}%`,
                      top: `${box.y * 100}%`,
                      width: `${box.width * 100}%`,
                      height: `${box.height * 100}%`,
                      ...((moving || carried.current.has(`${index}-${location}`)) && { animation: 'none' }),
                    } as CSSProperties
                    const editing = index === selected && !!onBoxChange
                    // Every box is the same element whether or not it is selected, so selecting one never
                    // remounts another and replays its reveal (m-found plays once, when the page shows).
                    return (
                      <div
                        key={`${index}-${location}`}
                        role="button"
                        tabIndex={0}
                        aria-label={t('第 {n} 題', { n: questions[index]!.number })}
                        aria-pressed={index === selected}
                        data-q={index}
                        style={place}
                        onClick={() => index !== selected && onSelect(index)}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return
                          e.preventDefault()
                          onSelect(index)
                        }}
                        {...(editing && { onPointerDown: (e: ReactPointerEvent) => startEdit(e, index, location, l.bbox, 'move') })}
                        className={`${revealed[page.pageNumber] ? '' : 'm-found'} absolute rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                          index === selected ? 'z-[1] bg-accent/15 ring-2 ring-accent' : 'cursor-pointer ring-1 ring-accent/0 hover:bg-accent/5 hover:ring-accent/40'
                        } ${editing ? `touch-none ${live?.index === index ? 'cursor-grabbing' : 'cursor-move'}` : ''}`}
                      >
                        {/* invisible grab areas on the edges and corners; nothing drawn over the text */}
                        {editing &&
                          GRIPS.map(({ grip, className }) => (
                            <span
                              key={grip}
                              aria-hidden
                              onPointerDown={(e) => startEdit(e, index, location, l.bbox, grip)}
                              className={`absolute ${className} ${grip.length === 2 ? 'h-3.5 w-3.5' : ''}`}
                            />
                          ))}
                      </div>
                    )
                  })}
              {pages.length > 1 && (
                <span className="num pointer-events-none absolute left-2 top-2 rounded-md bg-night/70 px-1.5 py-0.5 text-[11px] text-white backdrop-blur">{page.pageNumber}</span>
              )}
            </figure>
          ))}
        </div>
      </div>

      {/* Controls float over the bottom of the pages. */}
      <div
        ref={controls}
        onPointerEnter={wake}
        onPointerLeave={wake}
        onFocus={wake}
        className="pointer-events-none sticky bottom-3 left-0 z-10 flex justify-start pt-2 sm:justify-center"
      >
        <div
          data-idle={idle || undefined}
          className="pointer-events-auto flex translate-y-0 items-center transition-[opacity,translate] duration-300 data-[idle]:translate-y-1 data-[idle]:opacity-30 data-[idle]:duration-700"
        >
          <div className="flex items-center gap-0.5 rounded-full bg-night/85 px-1 py-1 text-xs text-white shadow-[0_10px_30px_-12px_rgb(22_24_43/0.6)] backdrop-blur-md">
            {pages.length > 1 && (
              <>
                <button type="button" className={pill} onClick={() => goTo(pages[index - 1]!.pageNumber)} disabled={index === 0} aria-label={t('上一頁')} title={t('上一頁')}>
                  <IconChevronLeft size={15} />
                </button>
                <span className="num min-w-10 text-center tabular-nums" aria-live="polite">
                  {current}
                  <span className="text-white/50">/{pages.length}</span>
                </span>
                <button type="button" className={pill} onClick={() => goTo(pages[index + 1]!.pageNumber)} disabled={index === pages.length - 1} aria-label={t('下一頁')} title={t('下一頁')}>
                  <IconChevronRight size={15} />
                </button>
                <span className="mx-0.5 h-4 w-px bg-white/20" />
              </>
            )}
            <button type="button" className={pill} onClick={() => setZoom(Math.max(0, zoom - 1))} disabled={zoom === 0} aria-label={t('縮小')} title={t('縮小')}>
              <IconMinus size={14} />
            </button>
            <button type="button" onClick={() => setZoom(0)} className="num min-w-11 rounded-full py-1.5 text-center tabular-nums hover:bg-white/15" title={t('符合寬度')}>
              {Math.round(scale * 100)}%
            </button>
            <button type="button" className={pill} onClick={() => setZoom(Math.min(ZOOMS.length - 1, zoom + 1))} disabled={zoom === ZOOMS.length - 1} aria-label={t('放大')} title={t('放大')}>
              <IconPlus size={14} />
            </button>
            <span className="mx-0.5 h-4 w-px bg-white/20" />
            <a href={fileUrl(pages[index]!.image)} target="_blank" rel="noreferrer" className={pill} aria-label={t('在新分頁開啟這一頁')} title={t('在新分頁開啟這一頁')}>
              <IconExternal size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
