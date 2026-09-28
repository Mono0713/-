'use client'

import type { DraftQuestion } from '@exam/core'
import { fileUrl } from '@/shared/files'

/** The source page with a box around each question; the selected one is highlighted, clicking a box selects it. */
export function PageViewer({
  pages,
  pageNumber,
  onPageChange,
  questions,
  selected,
  onSelect,
}: {
  pages: { pageNumber: number; image: string }[]
  pageNumber: number
  onPageChange: (n: number) => void
  questions: DraftQuestion[]
  selected: number | null
  onSelect: (index: number) => void
}) {
  const page = pages.find((p) => p.pageNumber === pageNumber) ?? pages[0]
  if (!page) return null
  const boxes = questions.flatMap((q, index) => q.locations.filter((l) => l.pageNumber === page.pageNumber).map((l) => ({ index, bbox: l.bbox, number: q.number })))
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {pages.map((p) => (
          <button
            key={p.pageNumber}
            type="button"
            onClick={() => onPageChange(p.pageNumber)}
            className={`rounded-md px-2.5 py-1 text-xs ${p.pageNumber === page.pageNumber ? 'bg-ink text-paper' : 'bg-surface text-muted hover:text-ink'}`}
          >
            第 {p.pageNumber} 頁
          </button>
        ))}
        <a href={fileUrl(page.image)} target="_blank" rel="noreferrer" className="ml-auto text-xs text-muted hover:text-ink">
          看大圖 ↗
        </a>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-line bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fileUrl(page.image)} alt={`第 ${page.pageNumber} 頁`} className="block h-auto w-full" />
        {boxes.map((b, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(b.index)}
            title={`第 ${b.number} 題`}
            className={`absolute rounded-sm transition-colors ${
              b.index === selected ? 'bg-accent/15 ring-2 ring-accent' : 'ring-1 ring-accent/0 hover:bg-accent/5 hover:ring-accent/40'
            }`}
            style={{ left: `${b.bbox.x * 100}%`, top: `${b.bbox.y * 100}%`, width: `${b.bbox.width * 100}%`, height: `${b.bbox.height * 100}%` }}
          />
        ))}
      </div>
    </div>
  )
}
