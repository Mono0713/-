/** A ballpoint tick that draws itself: the right answer. */
export function PenTick({ size = 22 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className="shrink-0 overflow-visible">
      <path className="m-pen" pathLength={1} d="M4 13 L10 18.5 L20 6" fill="none" stroke="var(--color-good)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
