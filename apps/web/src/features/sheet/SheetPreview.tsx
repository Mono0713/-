'use client'

import type { DraftExam } from '@exam/core'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/shared/i18n/client'
import { IconPrint } from '@/shared/icons'
import { Segmented } from '@/shared/Segmented'
import { Button } from '@/shared/ui'
import { sheetBlocks, type SheetBlock } from './blocks'
import { paginate } from './layout'
import type { SheetCopy } from './SheetQuestion'
import { usePrint } from './usePrint'

/** Space between blocks on a page, in CSS pixels at print size. */
const GAP = 14

/**
 * The exam as printed A4 pages, following every edit. The blocks are measured at print size on an
 * unseen page and packed onto pages without splitting a question; the pages are drawn scaled to the
 * pane. Clicking a question picks it, and the picked one is outlined and kept in view.
 * 匯出 PDF prints the same pages at full size (the browser's print dialog saves them as PDF).
 */
export function SheetPreview({ draft, selected, onSelect, className = '' }: { draft: DraftExam; selected: number | null; onSelect: (index: number) => void; className?: string }) {
  const t = useT()
  const [copy, setCopy] = useState<SheetCopy>('student')
  const blocks = useMemo(
    () => sheetBlocks(draft, copy, { range: (from, to) => (from === to ? t('第 {n} 題', { n: from }) : t('第 {from}～{to} 題', { from, to })) }),
    [draft, copy, t],
  )
  const { measurer, pages } = usePagination(blocks)

  const pane = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  useLayoutEffect(() => {
    const el = pane.current
    const page = measurer.current
    if (!el || !page) return
    // a hidden pane (the other side on phones) has no width; it is fitted once shown
    const fit = () => el.clientWidth && page.offsetWidth && setZoom(Math.min(1.25, el.clientWidth / page.offsetWidth))
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => watch.disconnect()
  }, [measurer])

  // keep the picked question in view as it is picked from the list
  useEffect(() => {
    if (selected === null) return
    pane.current?.querySelector(`[data-question="${selected}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  const { print, printing } = usePrint(draft.meta.title || t('未命名考卷'))
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
    <div className={`flex flex-col ${className}`}>
      <div className="sticky top-[var(--bar)] z-10 flex flex-wrap items-center gap-2 bg-paper/90 py-2 backdrop-blur-md lg:top-0 lg:pt-0">
        <Segmented
          value={copy}
          onChange={setCopy}
          options={[
            ['student', t('學生版')],
            ['teacher', <span key="teacher" title={t('附答案')}>{t('教師版')}</span>],
          ]}
        />
        <span className="num hidden text-xs text-muted sm:inline">{t('共 {n} 頁', { n: pages.length })}</span>
        <Button variant="primary" className="ml-auto" icon={<IconPrint size={16} />} loading={printing} onClick={print}>
          {t('匯出 PDF')}
        </Button>
      </div>

      <div ref={pane} className="min-w-0">
        <div className="flex flex-col items-center gap-4 pb-6" style={{ zoom }}>
          {sheets(true)}
        </div>
      </div>

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
