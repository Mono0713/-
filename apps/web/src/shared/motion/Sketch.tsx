// Slightly wavy pencil lines, as if someone were sketching the page before it arrives.
const LINES = [
  'M2 8 C60 5 120 10 180 7 S250 6 278 8',
  'M2 7 C50 9 110 5 160 8 S210 7 236 7',
  'M2 8 C70 6 140 9 200 7 S255 8 266 7',
  'M2 7 C40 8 90 6 140 8',
]

/** Loading placeholder: `lines` pencil strokes that draw themselves over and over. */
export function Sketch({ lines = 4, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`m-sketch grid gap-3 ${className}`} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <svg key={i} viewBox="0 0 280 14" preserveAspectRatio="none" className="h-3.5 w-full overflow-visible">
          <path pathLength={1} d={LINES[i % LINES.length]} style={{ animationDelay: `${(i % LINES.length) * 150}ms` }} />
        </svg>
      ))}
    </div>
  )
}
