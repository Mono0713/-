'use client'

import { useRef, useState, type ReactNode } from 'react'

/**
 * A list whose hover background glides from row to row instead of blinking on each one.
 * Rows opt in with `data-glide`; they should not paint their own hover background.
 */
export function Glide({ children, className = '' }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ top: number; height: number } | null>(null)
  const [shown, setShown] = useState(false)
  const follow = (target: EventTarget | null) => {
    const row = (target as HTMLElement | null)?.closest?.('[data-glide]')
    const el = root.current
    if (!row || !el || !el.contains(row)) return
    const a = el.getBoundingClientRect(), b = row.getBoundingClientRect()
    setBox({ top: b.top - a.top, height: b.height })
    setShown(true)
  }
  return (
    <div
      ref={root}
      className={`relative ${className}`}
      onPointerOver={(e) => e.pointerType === 'mouse' && follow(e.target)}
      onFocus={(e) => follow(e.target)}
      onPointerLeave={() => setShown(false)}
      onPointerDown={() => setShown(false)}
      onBlur={() => setShown(false)}
    >
      {box && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 rounded-lg bg-ink/[0.05]"
          style={{ top: box.top, height: box.height, opacity: shown ? 1 : 0, transition: 'top 260ms var(--m-ease-out), height 260ms var(--m-ease-out), opacity 160ms' }}
        />
      )}
      {children}
    </div>
  )
}
