'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { IconCheck, IconChevronDown, IconSearch } from '@/shared/icons'

export interface ListboxGroup {
  /** Heading above the group; none for a plain list. */
  label?: string
  /** `hint`: a second, quieter line (subject, date) that also counts when searching. */
  options: { value: string; label: string; hint?: string }[]
}

/** Lists longer than this get a search field at the top. */
const SEARCH_FROM = 8

/**
 * A drop-down list drawn by the app instead of the browser. The native `<select>` popup scrolls
 * by itself whenever the pointer rests near its top or bottom edge (Chrome on Windows), which is
 * jarring in long model lists; this one only scrolls when the wheel, the scrollbar or the
 * keyboard asks it to. A long list opens with a search field: typing narrows it, the arrow keys
 * move through what is left and Enter picks.
 */
export function Listbox({ value, groups, onChange, className = '', label }: { value: string; groups: ListboxGroup[]; onChange: (value: string) => void; className?: string; label: string }) {
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(value)
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null)
  const [query, setQuery] = useState('')
  const search = useRef<HTMLInputElement>(null)
  const all = groups.flatMap((g) => g.options)
  const current = all.find((o) => o.value === value)
  const searchable = all.length > SEARCH_FROM
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const shown = words.length
    ? groups.map((g) => ({ ...g, options: g.options.filter((o) => words.every((w) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(w))) })).filter((g) => g.options.length)
    : groups
  const flat = shown.flatMap((g) => g.options)

  // Below the button when it fits, otherwise above; fixed, so a card's overflow never clips it.
  const measure = useCallback(() => {
    const r = button.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom - 12
    const above = r.top - 12
    const width = Math.max(r.width, 224)
    const left = Math.min(r.left, window.innerWidth - width - 8)
    setPlace(below >= 240 || below >= above ? { left, width, top: r.bottom + 6, maxHeight: Math.min(320, below) } : { left, width, bottom: window.innerHeight - r.top + 6, maxHeight: Math.min(320, above) })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    measure()
  }, [open, measure])

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      const t = e.target as Node
      if (!popup.current?.contains(t) && !button.current?.contains(t)) setOpen(false)
    }
    // the page scrolling under the list moves the button: follow it (the list's own scroll is not the page's)
    const follow = (e: Event) => {
      if (e.target !== list.current) measure()
    }
    document.addEventListener('pointerdown', close)
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', measure)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', measure)
    }
  }, [open, measure])

  // Opening shows the chosen option in the middle of the list, without moving the page.
  useLayoutEffect(() => {
    if (!open || !place || !list.current) return
    const el = list.current.querySelector<HTMLElement>('[aria-selected="true"]')
    if (el) list.current.scrollTop = el.offsetTop - list.current.clientHeight / 2 + el.offsetHeight / 2
    // only on opening, not every time the position is refreshed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, place === null])

  const reveal = (v: string) => {
    const box = list.current
    const el = box?.querySelector<HTMLElement>(`[data-value="${CSS.escape(v)}"]`)
    if (!box || !el) return
    if (el.offsetTop < box.scrollTop) box.scrollTop = el.offsetTop - 4
    else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight + 4
  }

  // typing keeps the first match ready for Enter
  useEffect(() => {
    if (open && words.length && flat[0] && !flat.some((o) => o.value === active)) setActive(flat[0].value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const toggle = (next: boolean) => {
    setOpen(next)
    setQuery('')
    setActive(value)
  }

  const choose = (v: string) => {
    setOpen(false)
    setQuery('')
    button.current?.focus()
    if (v !== value) onChange(v)
  }

  const onKey = (e: KeyboardEvent) => {
    const i = flat.findIndex((o) => o.value === active)
    const step = (to: number) => {
      e.preventDefault()
      const next = flat[Math.max(0, Math.min(flat.length - 1, to))]
      if (!next) return
      if (!open) {
        setOpen(true)
        setActive(value)
        return
      }
      setActive(next.value)
      reveal(next.value)
    }
    if (e.key === 'ArrowDown') step(i < 0 ? 0 : i + 1)
    else if (e.key === 'ArrowUp') step(i - 1)
    else if (e.key === 'Home' && open) step(0)
    else if (e.key === 'End' && open) step(flat.length - 1)
    else if ((e.key === 'Enter' || (e.key === ' ' && e.currentTarget === button.current)) && open) {
      e.preventDefault()
      if (flat.some((o) => o.value === active)) choose(active)
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      toggle(false)
      button.current?.focus()
    } else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-label={label}
        onClick={() => toggle(!open)}
        onKeyDown={onKey}
        className={`${className} flex items-center justify-between gap-2 text-left`}
      >
        <span className="truncate">{current?.label ?? value}</span>
        <IconChevronDown size={16} className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open &&
        place &&
        createPortal(
          <div
            ref={popup}
            style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight, transformOrigin: place.top !== undefined ? 'top' : 'bottom' }}
            className="m-menu fixed z-50 flex flex-col overflow-hidden rounded-lg border border-line bg-surface text-sm shadow-lg"
            onPointerDown={(e) => e.target !== search.current && e.preventDefault()}
          >
            {searchable && (
              <label className="flex shrink-0 items-center gap-2 border-b border-line/70 px-3">
                <IconSearch size={15} className="shrink-0 text-muted" />
                <input
                  ref={search}
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="搜尋"
                  aria-label={`搜尋${label}`}
                  aria-controls={id}
                  aria-activedescendant={flat.some((o) => o.value === active) ? `${id}-${active}` : undefined}
                  className="min-w-0 flex-1 bg-transparent py-2.5 outline-none placeholder:text-muted"
                />
              </label>
            )}
            <ul ref={list} id={id} role="listbox" aria-label={label} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
              {shown.map((g, gi) => (
                <li key={g.label ?? gi} role="presentation" className={gi > 0 && !g.label ? 'mt-1 border-t border-line/70 pt-1' : ''}>
                  {g.label && <div className="px-2.5 pb-1 pt-2 text-xs font-semibold text-muted">{g.label}</div>}
                  <ul role="group" aria-label={g.label}>
                    {g.options.map((o) => (
                      <li
                        key={o.value}
                        id={`${id}-${o.value}`}
                        data-value={o.value}
                        role="option"
                        aria-selected={o.value === value}
                        data-active={o.value === active || undefined}
                        onPointerMove={() => o.value !== active && setActive(o.value)}
                        onClick={() => choose(o.value)}
                        className={`flex cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 data-active:bg-accent-soft ${o.value === value ? 'font-medium text-accent' : ''}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{o.label}</span>
                          {o.hint && <span className="block truncate text-xs font-normal text-muted">{o.hint}</span>}
                        </span>
                        {o.value === value && <IconCheck size={14} className="shrink-0" />}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
              {!flat.length && <li className="px-2.5 py-3 text-center text-muted">找不到「{query.trim()}」</li>}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
