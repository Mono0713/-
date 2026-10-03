'use client'

import { untangleBoxes, type DraftQuestion } from '@exam/core'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { fileUrl } from '@/shared/files'
import { IconChevronLeft, IconChevronRight, IconExternal, IconLoader, IconMinus, IconPlus } from '@/shared/icons'

const ZOOMS = [1, 1.25, 1.5, 2, 2.5]

type Box = DraftQuestion['locations'][number]['bbox']
/** What a press on the selected box changes: the whole box, or the edges named (n s e w). */
type Grip = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const GRIPS: { grip: Grip; className: string }[] = [
  { grip: 'n', className: '-top-1 inset-x-2 h-2 cursor-ns-resize' },
  { grip: 's', className: '-bottom-1 inset-x-2 h-2 cursor-ns-resize' },
  { grip: 'w', className: '-left-1 inset-y-2 w-2 cursor-ew-resize' },
  { grip: 'e', className: '-right-1 inset-y-2 w-2 cursor-ew-resize' },
  // corners: a 14px target around a small see-through dot, so the dot never hides the text under it
  { grip: 'nw', className: '-left-[7px] -top-[7px] cursor-nwse-resize' },
  { grip: 'ne', className: '-right-[7px] -top-[7px] cursor-nesw-resize' },
  { grip: 'sw', className: '-bottom-[7px] -left-[7px] cursor-nesw-resize' },
  { grip: 'se', className: '-bottom-[7px] -right-[7px] cursor-nwse-resize' },
]
const MIN = 0.012
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The box after a grip moved by (dx, dy), as fractions of the page; it never leaves the page or turns inside out. */
function dragged(b: Box, grip: Grip, dx: number, dy: number): Box {
  if (grip === 'move') return { ...b, x: clamp(b.x + dx, 0, 1 - b.width), y: clamp(b.y + dy, 0, 1 - b.height) }
  let { x, y } = b
  let right = b.x + b.width
  let bottom = b.y + b.height
  if (grip.includes('n')) y = clamp(y + dy, 0, bottom - MIN)
  if (grip.includes('s')) bottom = clamp(bottom + dy, y + MIN, 1)
  if (grip.includes('w')) x = clamp(x + dx, 0, right - MIN)
  if (grip.includes('e')) right = clamp(right + dx, x + MIN, 1)
  return { x, y, width: right - x, height: bottom - y }
}

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
  /** Given, the selected question's box can be moved and resized on the page. */
  onBoxChange?: (index: number, location: number, bbox: Box) => void
  className?: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(0)
  const [current, setCurrent] = useState(pages[0]?.pageNumber ?? 1)
  // Pages that have finished loading; until then each shows a page-shaped placeholder with a spinner.
  const [loaded, setLoaded] = useState<Record<number, 'ok' | 'error'>>({})
  const done = (pageNumber: number, state: 'ok' | 'error') => setLoaded((l) => (l[pageNumber] === state ? l : { ...l, [pageNumber]: state }))
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

  // The selected box: dragged by its body to move, by its edges and corners to resize.
  const [live, setLive] = useState<{ index: number; location: number; bbox: Box } | null>(null)
  const edit = useRef<{ index: number; location: number; grip: Grip; start: Box; x: number; y: number; w: number; h: number } | null>(null)
  const startEdit = (e: ReactPointerEvent, index: number, location: number, bbox: Box, grip: Grip) => {
    if (!onBoxChange || e.button !== 0) return
    const page = (e.currentTarget as HTMLElement).closest('figure')?.getBoundingClientRect()
    if (!page) return
    e.stopPropagation() // not a pan
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    edit.current = { index, location, grip, start: bbox, x: e.clientX, y: e.clientY, w: page.width, h: page.height }
  }
  const moveEdit = (e: ReactPointerEvent) => {
    const d = edit.current
    if (!d) return
    e.stopPropagation()
    setLive({ index: d.index, location: d.location, bbox: dragged(d.start, d.grip, (e.clientX - d.x) / d.w, (e.clientY - d.y) / d.h) })
  }
  const endEdit = (e: ReactPointerEvent) => {
    const d = edit.current
    if (!d) return
    e.stopPropagation()
    edit.current = null
    const bbox = dragged(d.start, d.grip, (e.clientX - d.x) / d.w, (e.clientY - d.y) / d.h)
    setLive(null)
    if (Math.abs(bbox.x - d.start.x) + Math.abs(bbox.y - d.start.y) + Math.abs(bbox.width - d.start.width) + Math.abs(bbox.height - d.start.height) > 0.001) onBoxChange?.(d.index, d.location, bbox)
  }
  const editHandlers = { onPointerMove: moveEdit, onPointerUp: endEdit, onPointerCancel: endEdit }

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
                alt={`第 ${page.pageNumber} 頁`}
                onLoad={() => done(page.pageNumber, 'ok')}
                onError={() => done(page.pageNumber, 'error')}
                className={`block h-auto w-full transition-opacity duration-300 ${loaded[page.pageNumber] === 'ok' ? 'opacity-100' : 'absolute inset-0 opacity-0'}`}
              />
              {!loaded[page.pageNumber] && (
                // The spinner sits in the upper part of the page, where it is in view.
                <div className="absolute inset-0 flex justify-center pt-[38%]" role="status" aria-label={`第 ${page.pageNumber} 頁載入中`}>
                  <div className="flex flex-col items-center gap-2 text-muted">
                    <IconLoader size={26} className="m-spin text-accent" />
                    <span className="text-xs">載入考卷中…</span>
                  </div>
                </div>
              )}
              {loaded[page.pageNumber] === 'error' && (
                <div className="absolute inset-0 grid place-items-center text-sm text-muted" role="alert">
                  這一頁的圖片載入失敗
                </div>
              )}
              {loaded[page.pageNumber] === 'ok' &&
                boxes
                  .flatMap((q, index) => q.locations.map((l, location) => ({ l, location, index })).filter(({ l }) => l.pageNumber === page.pageNumber))
                  .map(({ l, location, index }, order) => {
                    const box = live && live.index === index && live.location === location ? live.bbox : l.bbox
                    const place = { '--i': order, left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` } as CSSProperties
                    if (index === selected && onBoxChange)
                      return (
                        <div
                          key={`${index}-${location}`}
                          data-q={index}
                          title={`第 ${questions[index]!.number} 題：拖曳移動，拉邊角調整大小`}
                          style={place}
                          onPointerDown={(e) => startEdit(e, index, location, l.bbox, 'move')}
                          {...editHandlers}
                          className={`absolute z-[1] touch-none rounded-sm bg-accent/15 ring-2 ring-accent ${live?.index === index ? 'cursor-grabbing' : 'cursor-move'}`}
                        >
                          {GRIPS.map(({ grip, className }) => (
                            <span
                              key={grip}
                              aria-hidden
                              onPointerDown={(e) => startEdit(e, index, location, l.bbox, grip)}
                              {...editHandlers}
                              className={`absolute ${className} ${
                                grip.length === 2
                                  ? 'grid h-3.5 w-3.5 place-items-center after:h-[7px] after:w-[7px] after:rounded-full after:bg-accent/55 after:ring-1 after:ring-surface/80 after:transition-transform hover:after:scale-125'
                                  : ''
                              }`}
                            />
                          ))}
                        </div>
                      )
                    return (
                      <button
                        key={`${index}-${location}`}
                        type="button"
                        data-q={index}
                        onClick={() => onSelect(index)}
                        title={`第 ${questions[index]!.number} 題`}
                        style={place}
                        className={`m-found absolute rounded-sm transition-colors ${
                          index === selected ? 'bg-accent/15 ring-2 ring-accent' : 'ring-1 ring-accent/0 hover:bg-accent/5 hover:ring-accent/40'
                        }`}
                      />
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
                <button type="button" className={pill} onClick={() => goTo(pages[index - 1]!.pageNumber)} disabled={index === 0} aria-label="上一頁" title="上一頁">
                  <IconChevronLeft size={15} />
                </button>
                <span className="num min-w-10 text-center tabular-nums" aria-live="polite">
                  {current}
                  <span className="text-white/50">/{pages.length}</span>
                </span>
                <button type="button" className={pill} onClick={() => goTo(pages[index + 1]!.pageNumber)} disabled={index === pages.length - 1} aria-label="下一頁" title="下一頁">
                  <IconChevronRight size={15} />
                </button>
                <span className="mx-0.5 h-4 w-px bg-white/20" />
              </>
            )}
            <button type="button" className={pill} onClick={() => setZoom(Math.max(0, zoom - 1))} disabled={zoom === 0} aria-label="縮小" title="縮小">
              <IconMinus size={14} />
            </button>
            <button type="button" onClick={() => setZoom(0)} className="num min-w-11 rounded-full py-1.5 text-center tabular-nums hover:bg-white/15" title="符合寬度">
              {Math.round(scale * 100)}%
            </button>
            <button type="button" className={pill} onClick={() => setZoom(Math.min(ZOOMS.length - 1, zoom + 1))} disabled={zoom === ZOOMS.length - 1} aria-label="放大" title="放大">
              <IconPlus size={14} />
            </button>
            <span className="mx-0.5 h-4 w-px bg-white/20" />
            <a href={fileUrl(pages[index]!.image)} target="_blank" rel="noreferrer" className={pill} aria-label="在新分頁開啟這一頁" title="在新分頁開啟這一頁">
              <IconExternal size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
