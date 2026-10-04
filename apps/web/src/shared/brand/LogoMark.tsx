/**
 * The Sheetloop mark ("捲角"): a sheet whose corner curls into a loop, in ballpoint blue.
 * It takes the current text color, so it follows the theme; inside an element with the
 * `m-logo` class, the loop rolls a little on hover.
 */
export const MARK_SHEET = 'M14 8H38A6 6 0 0 1 44 14V30A20 20 0 0 0 30 50H14A6 6 0 0 1 8 44V14A6 6 0 0 1 14 8Z'

export function LogoMark({ size = 28, className = 'text-accent' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden className={className}>
      <g transform="translate(-2 -1)">
        <path d={MARK_SHEET} fill="currentColor" />
        <circle className="m-logo-loop" cx="46" cy="47" r="8.5" stroke="currentColor" strokeWidth="5" />
      </g>
    </svg>
  )
}
