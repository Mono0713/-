import { useId } from 'react'

/**
 * The Sheetloop mark: a sheet of paper with a loop arrow, on a blue-violet tile.
 * Inside an element with the `m-logo` class, the loop turns once on hover.
 */
export function LogoMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3D6BFF" />
          <stop offset="1" stopColor="#6A45F5" />
        </linearGradient>
        <mask id={`${id}m`}>
          <rect width="64" height="64" fill="#fff" />
          <circle cx="43" cy="43" r="15.5" fill="#000" />
        </mask>
      </defs>
      <rect width="64" height="64" rx="17" fill={`url(#${id}g)`} />
      <g mask={`url(#${id}m)`}>
        <path d="M14 15a4 4 0 0 1 4-4h14.5L42 20.5V47a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z" fill="#fff" />
        <path d="M32.5 11v6.5a3 3 0 0 0 3 3H42" fill="#C9D4FF" />
        <path d="M20 28h14M20 35h8" stroke="#4A5CF0" strokeWidth="3.6" strokeLinecap="round" />
      </g>
      <g className="m-logo-loop" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M51.61 47.01A9.5 9.5 0 1 1 50.06 36.64" />
        <path d="M51.27 29.77L51.53 38.28L43.10 37.13" />
      </g>
    </svg>
  )
}
