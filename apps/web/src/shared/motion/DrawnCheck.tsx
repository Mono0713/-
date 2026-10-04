/** A check mark in a filled circle that pops in and draws its tick. */
export function DrawnCheck({ size = 22, tone = 'var(--color-good)' }: { size?: number; tone?: string }) {
  return (
    <span className="m-scale-in inline-grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: tone }} aria-hidden>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path className="m-draw" d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
      </svg>
    </span>
  )
}
