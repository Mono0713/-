'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useT } from '@/shared/i18n/client'
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
 * labelled actions (on phones, a sheet slides up from the bottom instead, easier to reach
 * with one hand); pressing an action, the scrim or Escape folds them back.
 * `badge` on the button itself counts something waiting (it also makes the button pulse).
 */
export function Fab({ actions, badge, label }: { actions: FabAction[]; badge?: number; label?: string }) {
  const t = useT()
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
      {/* The column is click-through; only the button and, while open, the items take clicks. */}
      {/* phones: bottom sheet */}
      <div
        className="m-sheet fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl bg-surface px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-2 shadow-[0_-12px_30px_-18px_rgb(0_0_0/0.5)] sm:hidden"
        aria-hidden={!open}
      >
        <span aria-hidden className="mx-auto mb-2 block h-1 w-9 rounded-full bg-line" />
        <ul className="grid gap-1">
          {actions.map((a, i) => (
            <li key={a.id} className={a.className ?? ''} style={{ '--i': i } as React.CSSProperties}>
              <button
                type="button"
                tabIndex={open ? 0 : -1}
                disabled={a.disabled}
                onClick={() => {
                  setOpen(false)
                  a.onClick()
                }}
                className={`m-press flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-medium disabled:opacity-40 ${a.primary ? 'bg-accent-soft text-accent' : 'text-ink active:bg-ink/[0.05]'}`}
              >
                <span className="grid h-8 w-8 place-items-center">{a.icon}</span>
                <span className="flex-1">{a.label}</span>
                {!!a.badge && <span className="num rounded-full bg-hl px-2 text-[12px] text-night">{a.badge}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
        <ul className="flex flex-col-reverse items-end gap-2.5 pr-1.5 max-sm:hidden" aria-hidden={!open}>
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
                  a.primary ? 'bg-brand text-on-accent' : 'bg-surface text-ink ring-1 ring-ink/[0.07] hover:text-accent'
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
          aria-label={label ?? t('更多動作')}
          className={`m-fab-main m-press pointer-events-auto relative isolate grid h-14 w-14 place-items-center rounded-full bg-brand text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_14px_30px_-12px_var(--color-accent)] ${badge ? 'm-ring' : ''}`}
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
    <span className="num absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-hl px-1 text-[11px] leading-none text-night ring-2 ring-paper">
      {value > 99 ? '99+' : value}
    </span>
  )
}
