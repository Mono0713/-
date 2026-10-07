'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconChevronLeft, IconChevronRight, IconPlus } from '@/shared/icons'

const TUCKED = 'fab-tucked'

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
 * It can be tucked away into the right edge of the screen (swipe it right, or 收到右邊 in its list),
 * leaving a slim tab there that brings it back; the choice is remembered on this device.
 */
export function Fab({ actions: given, label }: { actions: FabAction[]; label?: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [tucked, setTucked] = useState(false)
  useEffect(() => {
    try {
      setTucked(localStorage.getItem(TUCKED) === '1')
    } catch {}
  }, [])
  const tuck = (on: boolean) => {
    setOpen(false)
    setTucked(on)
    try {
      localStorage.setItem(TUCKED, on ? '1' : '0')
    } catch {}
  }
  // Swiping the button right tucks it; it follows the finger or mouse until let go.
  const swipe = useRef<{ x: number; moved: boolean } | null>(null)
  const [pull, setPull] = useState(0)
  const onDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    swipe.current = { x: e.clientX, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: ReactPointerEvent) => {
    const s = swipe.current
    if (!s) return
    const dx = Math.max(0, e.clientX - s.x)
    if (dx > 6) s.moved = true
    if (s.moved) setPull(dx)
  }
  const onUp = () => {
    if (swipe.current?.moved && pull > 36) tuck(true)
    setPull(0)
    // a swipe is not a press: the click that follows is let through only when it did not move
    setTimeout(() => (swipe.current = null), 0)
  }
  const actions: FabAction[] = [...given, { id: 'tuck', label: t('收到右邊'), icon: <IconChevronRight size={20} />, onClick: () => tuck(true) }]
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
      <button
        type="button"
        onClick={() => tuck(false)}
        aria-label={label ?? t('更多動作')}
        title={label ?? t('更多動作')}
        tabIndex={tucked ? 0 : -1}
        className={`m-press fixed bottom-[29px] right-0 z-50 grid h-12 w-6 place-items-center rounded-l-xl bg-brand text-on-accent shadow-[0_8px_20px_-10px_var(--color-accent)] transition-transform duration-200 sm:bottom-[37px] ${tucked ? '' : 'pointer-events-none translate-x-full'}`}
      >
        <IconChevronLeft size={16} strokeWidth={2.4} />
      </button>
      <div
        className={`pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7 ${pull ? '' : 'transition-transform duration-300'}`}
        style={{ transform: tucked ? 'translateX(calc(100% + 2rem))' : pull ? `translateX(${pull}px)` : undefined }}
        aria-hidden={tucked}
      >
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
          onClick={() => !swipe.current?.moved && setOpen(!open)}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-expanded={open}
          aria-label={label ?? t('更多動作')}
          tabIndex={tucked ? -1 : 0}
          className={`m-fab-main m-press pointer-events-auto relative isolate grid h-14 w-14 touch-pan-y place-items-center rounded-full bg-brand text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_14px_30px_-12px_var(--color-accent)]`}
        >
          <IconPlus size={26} strokeWidth={2.2} />
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
