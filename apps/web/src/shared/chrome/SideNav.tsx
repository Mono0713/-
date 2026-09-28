'use client'

import type { ImportRecord } from '@exam/bank'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLayoutEffect, useRef, useState } from 'react'
import { STATUS_LABELS } from '@/shared/labels'
import { NAV, activeNav } from './nav'

/** Vertical navigation for the dark sidebar; a highlight slides to the current section. */
export function SideNav() {
  const active = activeNav(usePathname())
  const refs = useRef<(HTMLAnchorElement | null)[]>([])
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null)
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const el = refs.current[active]
    setBar(el ? { top: el.offsetTop, height: el.offsetHeight } : null)
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [active])

  return (
    <nav className="relative space-y-0.5 px-3 text-sm">
      {bar && (
        <span
          aria-hidden
          className="absolute inset-x-3 rounded-lg bg-white/[0.08]"
          style={{ top: bar.top, height: bar.height, transition: ready ? 'top 460ms var(--m-spring)' : 'none' }}
        >
          <span className="bg-brand absolute inset-y-2 left-0 w-[3px] rounded-full" />
        </span>
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
            className={`m-press relative flex items-center gap-3 rounded-lg px-3 py-2.5 ${on ? 'font-medium text-white' : 'hover:text-white'} ${on && !bar ? 'bg-white/[0.08]' : ''}`}
          >
            <I size={18} strokeWidth={1.9} className={on ? 'text-[#9DA8FF]' : 'opacity-70'} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

const DOT: Record<ImportRecord['status'], string> = {
  processing: 'bg-[#6C7BFF] animate-pulse',
  waiting: 'bg-amber-400',
  review: 'bg-amber-400',
  saved: 'bg-emerald-400',
  failed: 'bg-red-400',
}

/** One recent import in the sidebar, with a status dot; highlighted while it is open. */
export function RecentLink({ href, title, status }: { href: string; title: string; status: ImportRecord['status'] }) {
  const on = usePathname() === href
  return (
    <Link
      href={href}
      title={`${title} · ${STATUS_LABELS[status]}`}
      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors ${on ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white/85'}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[status]}`} aria-hidden />
      <span className="truncate">{title}</span>
    </Link>
  )
}
