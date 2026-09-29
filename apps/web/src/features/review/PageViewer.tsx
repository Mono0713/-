'use client'

import type { DraftQuestion } from '@exam/core'
import { useEffect, useRef, useState } from 'react'
import { fileUrl } from '@/shared/files'
import { IconMinus, IconPlus } from '@/shared/icons'

const ZOOMS = [1, 1.25, 1.5, 2, 2.5]

/**
 * Every source page, one under the other, with a box around each question: the selected one is
 * highlighted and scrolled into view, clicking a box selects it. The root is the scroll container
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
  const bar = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(0)
  const [current, setCurrent] = useState(pages[0]?.pageNumber ?? 1)

  // Bring the selected question's box into view unless it already is.
  useEffect(() => {
    const el = scroller.current
    if (!el || selected === null || el.scrollHeight <= el.clientHeight) return
    const box = el.querySelector<HTMLElement>(`[data-q="${selected}"]`)
    if (!box) return
    const view = el.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    const top = view.top + (bar.current?.offsetHeight ?? 0)
    const inside = b.top >= top && b.bottom <= view.bottom && b.left >= view.left && b.right <= view.right
    if (inside) return
    const fits = b.height < view.bottom - top
    el.scrollBy({
      top: b.top - top - (fits ? (view.bottom - top) * 0.15 : 8),
      left: b.left < view.left || b.right > view.right ? b.left - view.left - 16 : 0,
      behavior: 'smooth',
    })
  }, [selected, zoom])

  // The page a third of the way down the visible area is the current one.
  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const line = el.scrollHeight > el.clientHeight ? el.getBoundingClientRect().top + el.clientHeight / 3 : innerHeight / 3
    let page = pages[0]?.pageNumber ?? 1
    for (const p of el.querySelectorAll<HTMLElement>('[data-page]')) if (p.getBoundingClientRect().top <= line) page = Number(p.dataset.page)
    setCurrent(page)
  }
  // On phones the pages scroll with the window instead.
  useEffect(() => {
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  })

  if (!pages.length) return null
  const scale = ZOOMS[zoom]!

  return (
    <div ref={scroller} onScroll={onScroll} className={`relative ${className}`}>
      <div ref={bar} className="sticky left-0 top-[var(--bar,0px)] z-10 lg:top-0 flex items-center gap-2 bg-paper/90 px-1 py-1.5 text-xs text-muted backdrop-blur">
        <span className="num">
          {pages.length > 1 ? (
            <>
              第 <span className="text-ink">{current}</span> / {pages.length} 頁
            </>
          ) : (
            '原卷'
          )}
        </span>
        <div className="ml-auto flex items-center rounded-lg bg-surface shadow-sheet">
          <button type="button" onClick={() => setZoom(Math.max(0, zoom - 1))} disabled={zoom === 0} className="m-press grid h-7 w-7 place-items-center rounded-l-lg hover:text-ink disabled:opacity-40" aria-label="縮小" title="縮小">
            <IconMinus size={14} />
          </button>
          <button type="button" onClick={() => setZoom(0)} className="num w-12 text-center hover:text-ink" title="符合寬度">
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom(Math.min(ZOOMS.length - 1, zoom + 1))}
            disabled={zoom === ZOOMS.length - 1}
            className="m-press grid h-7 w-7 place-items-center rounded-r-lg hover:text-ink disabled:opacity-40"
            aria-label="放大"
            title="放大"
          >
            <IconPlus size={14} />
          </button>
        </div>
      </div>

      {/* Zoomed pages scroll sideways here on phones; wider screens scroll the whole viewer. */}
      <div className="overflow-x-auto lg:overflow-visible">
        <div className="space-y-4 pb-2 pt-1" style={{ width: `${scale * 100}%` }}>
          {pages.map((page) => (
            <figure key={page.pageNumber} data-page={page.pageNumber}>
              <div className="relative overflow-hidden rounded-lg bg-surface shadow-sheet">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fileUrl(page.image)} alt={`第 ${page.pageNumber} 頁`} className="block h-auto w-full" />
                {questions.flatMap((q, index) =>
                  q.locations
                    .filter((l) => l.pageNumber === page.pageNumber)
                    .map((l, i) => (
                      <button
                        key={`${index}-${i}`}
                        type="button"
                        data-q={index}
                        onClick={() => onSelect(index)}
                        title={`第 ${q.number} 題`}
                        className={`absolute rounded-sm transition-colors ${
                          index === selected ? 'bg-accent/15 ring-2 ring-accent' : 'ring-1 ring-accent/0 hover:bg-accent/5 hover:ring-accent/40'
                        }`}
                        style={{ left: `${l.bbox.x * 100}%`, top: `${l.bbox.y * 100}%`, width: `${l.bbox.width * 100}%`, height: `${l.bbox.height * 100}%` }}
                      />
                    )),
                )}
              </div>
              <figcaption className="mt-1.5 flex justify-between px-1 text-[11px] text-muted">
                <span className="num">第 {page.pageNumber} 頁</span>
                <a href={fileUrl(page.image)} target="_blank" rel="noreferrer" className="hover:text-ink">
                  看大圖 ↗
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  )
}
