'use client'

import { untangleBoxes, type DraftQuestion } from '@exam/core'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { fileUrl } from '@/shared/files'
import { IconChevronLeft, IconChevronRight, IconExternal, IconLoader, IconMinus, IconPlus } from '@/shared/icons'

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
  className = '',
}: {
  pages: { pageNumber: number; image: string }[]
  questions: DraftQuestion[]
  selected: number | null
  onSelect: (index: number) => void
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

  const goTo = (pageNumber: number) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-page="${pageNumber}"]`)
    if (!el) return
    if (scrolls()) scroller.current!.scrollBy({ top: el.getBoundingClientRect().top - scroller.current!.getBoundingClientRect().top, behavior: 'smooth' })
    else el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!pages.length) return null
  const scale = ZOOMS[zoom]!
  const index = Math.max(0, pages.findIndex((p) => p.pageNumber === current))
  const pill = 'm-press grid h-8 w-8 place-items-center rounded-full hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent'

  return (
    // A column, so the controls sit at the bottom of the viewer even before the pages fill it.
    <div ref={scroller} onScroll={onScroll} className={`relative flex flex-col ${className}`}>
      {/* Zoomed pages scroll sideways here on phones; wider screens scroll the whole viewer. */}
      <div className="flex-1 overflow-x-auto lg:overflow-visible">
        <div className="space-y-3 pb-1" style={{ width: `${scale * 100}%` }}>
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
                  .flatMap((q, index) => q.locations.filter((l) => l.pageNumber === page.pageNumber).map((l, i) => ({ l, i, index })))
                  .map(({ l, i, index }, order) => (
                    <button
                      key={`${index}-${i}`}
                      type="button"
                      data-q={index}
                      onClick={() => onSelect(index)}
                      title={`第 ${questions[index]!.number} 題`}
                      style={{ '--i': order, left: `${l.bbox.x * 100}%`, top: `${l.bbox.y * 100}%`, width: `${l.bbox.width * 100}%`, height: `${l.bbox.height * 100}%` } as CSSProperties}
                      className={`m-found absolute rounded-sm transition-colors ${
                        index === selected ? 'bg-accent/15 ring-2 ring-accent' : 'ring-1 ring-accent/0 hover:bg-accent/5 hover:ring-accent/40'
                      }`}
                    />
                  ))}
              {pages.length > 1 && (
                <span className="num pointer-events-none absolute left-2 top-2 rounded-md bg-night/70 px-1.5 py-0.5 text-[11px] text-white backdrop-blur">{page.pageNumber}</span>
              )}
            </figure>
          ))}
        </div>
      </div>

      {/* Controls float over the bottom of the pages. */}
      <div className="pointer-events-none sticky bottom-3 left-0 z-10 flex justify-start pt-2 sm:justify-center">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-night/85 px-1 py-1 text-xs text-white shadow-[0_10px_30px_-12px_rgb(22_24_43/0.6)] backdrop-blur-md">
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
  )
}
