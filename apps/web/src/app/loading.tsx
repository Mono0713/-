import { Sketch } from '@/shared/motion/Sketch'

/** Placeholder while a page's data loads: pencil lines sketching the page. */
export default function Loading() {
  return (
    <div aria-busy aria-label="載入中" className="space-y-6">
      <Sketch lines={2} className="max-w-sm" />
      <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-2xl bg-surface p-5 shadow-sheet">
            <Sketch lines={3} />
          </div>
        ))}
      </div>
    </div>
  )
}
