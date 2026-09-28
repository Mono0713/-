'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** A row of mutually exclusive tabs with a sliding highlight. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, ReactNode])[]; onChange: (value: T) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const index = options.findIndex(([v]) => v === value)
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)
  useLayoutEffect(() => {
    const el = refs.current[index]
    setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null)
  }, [index, options])

  return (
    <div className="relative inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-surface p-0.5 text-sm shadow-[0_0_0_1px_var(--color-line)]">
      {pill && (
        <span aria-hidden className="absolute top-0.5 bottom-0.5 rounded-md bg-ink" style={{ left: pill.left, width: pill.width, transition: 'left 380ms var(--m-spring), width 380ms var(--m-spring)' }} />
      )}
      {options.map(([v, label], i) => (
        <button
          key={v}
          type="button"
          ref={(el) => {
            refs.current[i] = el
          }}
          onClick={() => onChange(v)}
          aria-pressed={v === value}
          // until the pill is measured (server render), the selected tab paints its own background
          className={`m-press relative shrink-0 rounded-md px-3 py-1.5 whitespace-nowrap ${v === value ? `text-paper ${pill ? '' : 'bg-ink'}` : 'text-muted hover:text-ink'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
