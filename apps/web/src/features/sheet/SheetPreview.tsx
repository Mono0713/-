'use client'

import type { DraftExam } from '@exam/core'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/shared/i18n/client'
import { PageBadge, PageControls, usePageControls, ZOOMS } from '@/shared/PageControls'
import { sheetBlocks, type SheetBlock } from './blocks'
import { paginate } from './layout'
import type { SheetCopy } from './SheetQuestion'
import { usePrint } from './usePrint'

/** Space between blocks on a page, in CSS pixels at print size. */
const GAP = 14

/**
 * The exam as printed A4 pages, following every edit, in a viewer like the original pages': each page has its
 * number in the corner and the zoom and page controls float at the bottom. The blocks are measured at print size
 * on an unseen page and packed onto pages without splitting a question. Answers show in red, as on a teacher's
 * copy. Clicking a question picks it, and the picked one is outlined and kept in view.
 * `printing` prints the same pages at full size, with or without the answers (the floating button's 匯出 PDF):
 * the browser's print dialog saves them as PDF.
 */
export function SheetPreview({
  draft,
  selected,
  onSelect,
  onSpace,
  printing,
  onPrinted,
  className = '',
}: {
  draft: DraftExam
  selected: number | null
  onSelect: (index: number) => void
  /** Sets a question's answer room, in lines, dragged on the paper. */
  onSpace?: (index: number, lines: number) => void
  /** The copy being exported as PDF, until `onPrinted`. */
  printing: SheetCopy | null
  onPrinted: () => void
  className?: string
}) {
  const t = useT()
  const copy = printing ?? 'teacher'
  const blocks = useMemo(
    () => sheetBlocks(draft, copy, { range: (from, to) => (from === to ? t('第 {n} 題', { n: from }) : t('第 {from}～{to} 題', { from, to })) }, onSpace),
    [draft, copy, t, onSpace],
  )
  const { measurer, pages } = usePagination(blocks)

  const root = useRef<HTMLDivElement>(null)
  const pane = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(1)
  const [step, setStep] = useState(0)
  useLayoutEffect(() => {
    const el = pane.current
    const page = measurer.current
    if (!el || !page) return
    // a hidden pane (the other side on phones) has no width; it is fitted once shown
    const measure = () => el.clientWidth && page.offsetWidth && setFit(Math.min(1.25, el.clientWidth / page.offsetWidth))
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [measurer])
  const zoom = fit * ZOOMS[step]!

  // keep the picked question in view as it is picked from the list
  useEffect(() => {
    if (selected === null) return
    pane.current?.querySelector(`[data-question="${selected}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  // the page a third of the way down the view is the current one (the pane scrolls on wide screens, the window on phones)
  const [current, setCurrent] = useState(1)
  const onScroll = () => {
    const el = root.current
    if (!el) return
    const scrolls = el.scrollHeight > el.clientHeight + 1
    const line = scrolls ? el.getBoundingClientRect().top + el.clientHeight / 3 : innerHeight / 3
    let page = 1
    for (const p of el.querySelectorAll<HTMLElement>('[data-page]')) if (p.getBoundingClientRect().top <= line) page = Number(p.dataset.page)
    setCurrent(page)
  }
  useEffect(() => {
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  })
  const goTo = (n: number) => root.current?.querySelector(`[data-page="${n}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const controls = usePageControls()

  usePrint(draft.meta.title || t('未命名考卷'), printing !== null, onPrinted)
  const sheets = (interactive: boolean) =>
    pages.map((page, p) => (
      <div key={p} className="a4-page">
        <div className="a4-body" style={{ gap: GAP }}>
          {page.map((i) => (
            <Placed key={blocks[i]!.key} block={blocks[i]!} selected={interactive && blocks[i]!.question === selected && blocks[i]!.key.startsWith('q-')} onSelect={interactive ? onSelect : undefined} />
          ))}
        </div>
        <p className="a4-foot">{t('第 {page} 頁，共 {pages} 頁', { page: p + 1, pages: pages.length })}</p>
      </div>
    ))

  return (
    // a column, so the controls sit at the bottom of the viewer even before the pages fill it
    <div ref={root} onScroll={onScroll} onPointerMove={controls.near} onPointerDown={controls.near} className={`relative flex flex-col ${className}`}>
      <div ref={pane} className="min-w-0 flex-1 overflow-x-auto lg:overflow-visible">
        {/* zoomed in, the pages grow wider than the pane and scroll sideways from their left edge */}
        <div className="flex w-max min-w-full flex-col items-center gap-3 pb-1">
          {sheets(true).map((sheet, p) => (
            <div key={p} data-page={p + 1} className="relative">
              <div style={{ zoom }}>{sheet}</div>
              <PageBadge n={p + 1} />
            </div>
          ))}
        </div>
      </div>

      <PageControls state={controls} current={Math.min(current, pages.length)} total={pages.length} onPage={goTo} zoom={step} onZoom={setStep} />

      {/* the unseen page the blocks are measured on, at print size */}
      <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0 invisible">
        <div ref={measurer} className="a4-page">
          <div className="a4-body" style={{ gap: GAP }}>
            {blocks.map((b) => (
              <div key={b.key}>{b.node}</div>
            ))}
          </div>
          <p className="a4-foot">&nbsp;</p>
        </div>
      </div>

      {printing && createPortal(<div className="a4-print">{sheets(false)}</div>, document.body)}
    </div>
  )
}

function Placed({ block, selected, onSelect }: { block: SheetBlock; selected: boolean; onSelect?: (index: number) => void }) {
  const pick = onSelect && block.question !== undefined ? () => onSelect(block.question!) : undefined
  return (
    <div data-question={block.key.startsWith('q-') ? block.question : undefined} data-selected={selected || undefined} onClick={pick} className={pick ? 'a4-block cursor-pointer' : undefined}>
      {block.node}
    </div>
  )
}

/** Measures every block on the unseen page (again whenever one changes size, e.g. a picture loads) and packs them onto pages. */
function usePagination(blocks: SheetBlock[]) {
  const measurer = useRef<HTMLDivElement>(null)
  const [sizes, setSizes] = useState<{ heights: number[]; room: number }>({ heights: [], room: 0 })
  useLayoutEffect(() => {
    const page = measurer.current
    const body = page?.firstElementChild as HTMLElement | null
    if (!body) return
    const measure = () => {
      const heights = [...body.children].map((el) => el.getBoundingClientRect().height)
      const room = body.clientHeight
      setSizes((s) => (s.room === room && s.heights.length === heights.length && s.heights.every((h, i) => Math.abs(h - heights[i]!) < 0.5) ? s : { heights, room }))
    }
    measure()
    const watch = new ResizeObserver(measure)
    for (const el of body.children) watch.observe(el)
    return () => watch.disconnect()
  }, [blocks])
  const pages = useMemo(() => {
    if (!sizes.room || sizes.heights.length !== blocks.length) return [blocks.map((_, i) => i)]
    return paginate(
      blocks.map((b, i) => ({ height: sizes.heights[i]!, keepWithNext: b.keepWithNext })),
      sizes.room,
      GAP,
    )
  }, [blocks, sizes])
  return { measurer, pages }
}
