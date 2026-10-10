'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useT } from '@/shared/i18n/client'
import { NAV, activeNav } from './nav'

/** Phones: the main sections along the bottom edge, where the thumb reaches. Wider screens use the header or the sidebar. */
export function BottomNav() {
  const t = useT()
  const active = activeNav(usePathname())
  return (
    <nav className="app-bottomnav fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
      <div className="mx-auto flex h-16 max-w-md items-stretch">
        {NAV.map((item, i) => {
          const on = i === active
          const I = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? 'page' : undefined}
              className={`m-press flex flex-1 flex-col items-center justify-center gap-1 text-[11px] ${on ? 'font-medium text-ink' : 'text-muted'}`}
            >
              <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors duration-200 ${on ? 'bg-accent-soft text-accent' : ''}`}>
                <I size={19} strokeWidth={on ? 2.2 : 1.8} />
              </span>
              <span className="max-w-full truncate px-0.5">{t(item.label)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
