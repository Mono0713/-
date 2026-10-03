'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLayoutEffect, useRef, useState } from 'react'
import { NAV, activeNav } from './nav'

/** Main navigation with a pill that slides to the current section. */
export function NavLinks() {
  const active = activeNav(usePathname())
  const refs = useRef<(HTMLAnchorElement | null)[]>([])
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[active]
      setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null)
    }
    measure()
    addEventListener('resize', measure)
    // enable the slide only after the first placement, so the pill doesn't fly in on load
    const id = requestAnimationFrame(() => setReady(true))
    return () => {
      removeEventListener('resize', measure)
      cancelAnimationFrame(id)
    }
  }, [active])

  return (
    <nav className="relative flex gap-0.5 text-sm">
      {pill && (
        <span
          aria-hidden
          className="absolute top-0 h-full rounded-lg bg-surface shadow-[0_1px_2px_rgb(29_33_38/0.08),0_0_0_1px_var(--color-line)]"
          style={{ left: pill.left, width: pill.width, transition: ready ? 'left 420ms var(--m-spring), width 420ms var(--m-spring)' : 'none' }}
        />
      )}
      {NAV.map((item, i) => {
        const on = i === active
        const I = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            ref={(el) => {
              refs.current[i] = el
            }}
            aria-current={on ? 'page' : undefined}
            aria-label={item.label}
            className={`m-press relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 sm:px-3 ${on ? 'font-medium text-ink' : 'text-muted hover:text-ink'} ${on && !pill ? 'bg-surface shadow-[0_0_0_1px_var(--color-line)]' : ''}`}
          >
            <I size={16} strokeWidth={2} className={on ? 'text-accent' : ''} />
            {/* with five sections a phone shows icons only, the current one on its pill */}
            <span className={`whitespace-nowrap ${on ? 'hidden min-[440px]:inline' : 'hidden sm:inline'}`}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
