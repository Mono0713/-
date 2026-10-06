import type { CSSProperties, ReactNode } from 'react'

/** The little stage each picture on the product page sits on. */
export function Frame({ children, className = 'h-40', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div aria-hidden className={`relative overflow-hidden rounded-xl bg-paper ring-1 ring-line/70 ${className}`} style={style}>
      {children}
    </div>
  )
}

/** A grey line standing in for a line of text. */
export function Bar({ w, className = '' }: { w: string; className?: string }) {
  return <span className={`block h-1.5 rounded-full bg-ink/10 ${className}`} style={{ width: w }} />
}

/** The ballpoint tick of the quiz, drawn when its picture comes into view. */
export function Tick({ delay = 0, size = 14 }: { delay?: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0 overflow-visible">
      <path className="m-pen m-play" style={{ animationDelay: `${delay}ms` }} pathLength={1} d="M4 13 L10 18.5 L20 6" fill="none" stroke="var(--color-good)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
