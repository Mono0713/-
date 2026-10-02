/** A red-pen ring drawn around its parent (which must be position: relative): a wrong pick. */
export function PenCircle() {
  return (
    <svg aria-hidden viewBox="0 0 292 50" preserveAspectRatio="none" className="pointer-events-none absolute -left-3 -top-2.5 h-[calc(100%+20px)] w-[calc(100%+24px)] overflow-visible">
      <path
        className="m-pen"
        pathLength={1}
        d="M44 5 C110 -1 220 0 272 6 C293 10 293 40 268 46 C200 53 90 53 26 46 C3 42 1 10 26 6 C56 2 90 2 124 3"
        fill="none"
        stroke="var(--color-pen)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** A ballpoint tick that draws itself: the right answer. */
export function PenTick({ size = 22, late = false }: { size?: number; late?: boolean }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className="shrink-0 overflow-visible">
      <path className={`m-pen ${late ? 'm-pen-late' : ''}`} pathLength={1} d="M4 13 L10 18.5 L20 6" fill="none" stroke="var(--color-good)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
