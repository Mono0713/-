'use client'

import { useEffect, useRef, useState } from 'react'

/** How the wide-screen workspace is laid out, remembered on this device. */
export interface Layout {
  outline: boolean
  /** Share of the width (outline aside) that the exam pages take. */
  split: number
}
const LAYOUT_KEY = 'review-layout'
export const DEFAULT_LAYOUT: Layout = { outline: false, split: 0.55 }
export const clampSplit = (n: number) => Math.min(0.72, Math.max(0.3, n))

/** Width the open outline takes (232px column and its gap), and the divider's. */
export const OUTLINE_SPACE = 252
export const SPLITTER = 20

/**
 * The review workspace's layout: whether the outline is open and how wide the pages are, plus the
 * toolbar's height (it wraps on narrow screens; the page viewer and outline stick just below it).
 * `row` goes on the columns' row and `viewer` on the page column, so the divider can be dragged.
 */
export function useWorkspaceLayout() {
  const [layout, setLayoutState] = useState(DEFAULT_LAYOUT)
  const row = useRef<HTMLDivElement>(null)
  const viewer = useRef<HTMLDivElement>(null)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? 'null') as Partial<Layout> | null
      if (saved) setLayoutState({ outline: saved.outline === true, split: clampSplit(Number(saved.split) || DEFAULT_LAYOUT.split) })
    } catch {}
  }, [])
  const setLayout = (patch: Partial<Layout>) =>
    setLayoutState((l) => {
      const next = { ...l, ...patch }
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(next))
      } catch {}
      return next
    })

  const bar = useRef<HTMLDivElement>(null)
  const [barHeight, setBarHeight] = useState(120)
  useEffect(() => {
    const el = bar.current
    if (!el) return
    const observer = new ResizeObserver(() => setBarHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Dragging the divider between the pages and the questions sets how much room the pages get.
  const startResize = (e: React.PointerEvent) => {
    const r = row.current
    const v = viewer.current
    if (!r || !v || e.button !== 0) return
    e.preventDefault()
    const left = v.getBoundingClientRect().left
    const room = r.clientWidth - (layout.outline ? OUTLINE_SPACE : 0) - SPLITTER
    const move = (ev: PointerEvent) => setLayoutState((l) => ({ ...l, split: clampSplit((ev.clientX - left) / room) }))
    const up = () => {
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
      setLayout({})
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
  }

  return { layout, setLayout, row, viewer, bar, barHeight, startResize }
}
