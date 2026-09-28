'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { IconPlus } from '@/shared/icons'

export interface FabAction {
  id: string
  label: string
  icon: ReactNode
  onClick: () => void
  /** Small count shown on the item. */
  badge?: number
  disabled?: boolean
  /** Extra classes for the item row, e.g. 'lg:hidden' for phone-only actions. */
  className?: string
  primary?: boolean
}

/**
 * Floating action button in the bottom-right corner. Pressing it fans out a column of
 * labelled actions; pressing an action, the scrim or Escape folds them back.
 * `badge` on the button itself counts something waiting (it also makes the button pulse).
 */
export function Fab({ actions, badge, label = '更多動作' }: { actions: FabAction[]; badge?: number; label?: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open])

  const n = actions.length
  return (
    <div className="m-fab" data-open={open ? '' : undefined}>
      <div className="m-fab-scrim fixed inset-0 z-40 bg-ink/10 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-hidden />
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
        <ul className="flex flex-col-reverse items-end gap-2.5 pr-1.5" aria-hidden={!open}>
          {actions.map((a, i) => (
            <li key={a.id} className={`m-fab-item flex items-center gap-3 ${a.className ?? ''}`} style={{ '--i': i, '--n': n } as React.CSSProperties}>
              <span className="m-fab-label rounded-lg bg-night px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap text-white shadow-lg">{a.label}</span>
              <button
                type="button"
                tabIndex={open ? 0 : -1}
                disabled={a.disabled}
                onClick={() => {
                  setOpen(false)
                  a.onClick()
                }}
                aria-label={a.label}
                className={`m-press relative grid h-11 w-11 place-items-center rounded-full shadow-[0_8px_20px_-10px_rgb(22_24_43/0.5)] disabled:opacity-40 ${
                  a.primary ? 'bg-brand text-white' : 'bg-surface text-ink ring-1 ring-ink/[0.07] hover:text-accent'
                }`}
              >
                {a.icon}
                {!!a.badge && <Count value={a.badge} />}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={label}
          className={`m-fab-main m-press relative isolate grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_14px_30px_-12px_var(--color-brand-to)] ${badge ? 'm-ring' : ''}`}
        >
          <IconPlus size={26} strokeWidth={2.2} />
          {!!badge && !open && <Count value={badge} />}
        </button>
      </div>
    </div>
  )
}

function Count({ value }: { value: number }) {
  return (
    <span className="num absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[11px] leading-none text-night ring-2 ring-paper">
      {value > 99 ? '99+' : value}
    </span>
  )
}
