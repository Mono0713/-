'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * A button that drops down a small panel under it; a click outside or Escape closes it.
 * `children` can be a function that gets `close`, for items that should shut the menu.
 */
export function Menu({
  label,
  button,
  className = '',
  align = 'left',
  side = 'down',
  children,
}: {
  label: string
  button: ReactNode
  className?: string
  align?: 'left' | 'right'
  /** Opens above the button, for one at the bottom of the screen. */
  side?: 'down' | 'up'
  children: ReactNode | ((close: () => void) => ReactNode)
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    addEventListener('pointerdown', onDown)
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('pointerdown', onDown)
      removeEventListener('keydown', onKey)
    }
  }, [open])
  const close = () => setOpen(false)
  return (
    <div ref={root} className="relative min-w-0">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label={label} title={label} className={className}>
        {button}
      </button>
      {open && (
        <div
          role="menu"
          className={`m-scale-in absolute z-50 ${side === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl bg-surface p-1.5 text-sm shadow-[0_18px_40px_-16px_rgb(22_24_43/0.4),0_0_0_1px_rgb(22_24_43/0.06)] ${
            align === 'right' ? 'right-0' : 'left-0'} ${side === 'up' ? (align === 'right' ? 'origin-bottom-right' : 'origin-bottom-left') : align === 'right' ? 'origin-top-right' : 'origin-top-left'
          }`}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  )
}

/** One row of a Menu. */
export const menuItem = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-ink/[0.05]'
