'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { clamp, dragged, type Box, type Grip } from './boxGeometry'

/**
 * Moving and resizing the selected question's box on the page viewer. `live` is the box while it is
 * being dragged; `carried` names boxes moved to another page (they skip the reveal animation);
 * `startEdit` goes on the box body (grip 'move') and on each edge and corner grip.
 * `scrolls` says whether the viewer itself scrolls (wide screens) or the window does (phones).
 */
export function useBoxEditing({
  scroller,
  scrolls,
  onBoxChange,
}: {
  scroller: RefObject<HTMLDivElement | null>
  scrolls: () => boolean
  onBoxChange?: (index: number, location: number, bbox: Box, pageNumber?: number) => void
}) {
  // The selected box: dragged by its body to move (onto another page too), by its edges and corners to resize.
  // Moves follow the pointer over whichever page it is on, and the viewer scrolls when the pointer
  // nears its top or bottom edge, so a box can be carried to a page that is out of view.
  const [live, setLive] = useState<{ index: number; location: number; bbox: Box; pageNumber: number } | null>(null)
  // Boxes carried to another page remount there; they skip the reveal animation from then on.
  const carried = useRef(new Set<string>())
  const edit = useRef<{
    index: number
    location: number
    grip: Grip
    start: Box
    pageNumber: number
    // the page the pointer was last over, kept while it crosses the gap between two pages
    over: number
    // where on the box it was grabbed, as fractions of the page
    grabX: number
    grabY: number
    // where it was grabbed, as fractions of the page
    fx: number
    fy: number
    x: number
    y: number
    w: number
    h: number
    last: { x: number; y: number }
    end: () => void
  } | null>(null)
  const edgeSpeed = useRef(0)
  const edgeFrame = useRef(0)

  const figureAt = (x: number, y: number) =>
    document.elementsFromPoint(x, y).map((el) => el.closest<HTMLElement>('figure[data-page]')).find((f) => f !== null) ?? null
  const placed = (x: number, y: number) => {
    const d = edit.current!
    if (d.grip !== 'move') {
      // measured against where the page is now, so a page that scrolls meanwhile does not pull the edge along
      const r = scroller.current?.querySelector<HTMLElement>(`figure[data-page="${d.pageNumber}"]`)?.getBoundingClientRect()
      const dx = r ? (x - r.left) / r.width - d.fx : (x - d.x) / d.w
      const dy = r ? (y - r.top) / r.height - d.fy : (y - d.y) / d.h
      return { bbox: dragged(d.start, d.grip, dx, dy), pageNumber: d.pageNumber }
    }
    const figure = figureAt(x, y) ?? scroller.current?.querySelector<HTMLElement>(`figure[data-page="${d.over}"]`)
    if (!figure) return { bbox: d.start, pageNumber: d.pageNumber }
    d.over = Number(figure.dataset.page)
    const r = figure.getBoundingClientRect()
    const b = d.start
    return {
      bbox: { ...b, x: clamp((x - r.left) / r.width - d.grabX, 0, 1 - b.width), y: clamp((y - r.top) / r.height - d.grabY, 0, 1 - b.height) },
      pageNumber: Number(figure.dataset.page),
    }
  }
  const follow = (x: number, y: number) => {
    const d = edit.current
    if (!d) return
    d.last = { x, y }
    setLive({ index: d.index, location: d.location, ...placed(x, y) })
  }
  // near the top or bottom of the view the pages scroll, faster the closer the pointer gets
  const edgeScroll = (y: number) => {
    const el = scroller.current
    const view = el && scrolls() ? el.getBoundingClientRect() : { top: 0, bottom: innerHeight }
    const zone = 56
    edgeSpeed.current = y < view.top + zone ? -Math.min(1, (view.top + zone - y) / zone) * 16 : y > view.bottom - zone ? Math.min(1, (y - view.bottom + zone) / zone) * 16 : 0
    if (!edgeSpeed.current || edgeFrame.current) return
    const step = () => {
      const d = edit.current
      if (!d || !edgeSpeed.current) return void (edgeFrame.current = 0)
      if (el && scrolls()) el.scrollBy({ top: edgeSpeed.current, behavior: 'instant' })
      else window.scrollBy({ top: edgeSpeed.current, behavior: 'instant' })
      follow(d.last.x, d.last.y)
      edgeFrame.current = requestAnimationFrame(step)
    }
    edgeFrame.current = requestAnimationFrame(step)
  }
  const startEdit = (e: ReactPointerEvent, index: number, location: number, bbox: Box, grip: Grip) => {
    if (!onBoxChange || e.button !== 0) return
    const figure = (e.currentTarget as HTMLElement).closest<HTMLElement>('figure[data-page]')
    if (!figure) return
    const page = figure.getBoundingClientRect()
    e.stopPropagation() // not a pan
    e.preventDefault()
    // Listened to on the window: a box carried onto another page is a new element there.
    const move = (ev: PointerEvent) => {
      follow(ev.clientX, ev.clientY)
      if (edit.current?.grip === 'move') edgeScroll(ev.clientY)
    }
    const up = (ev: PointerEvent) => endEdit(ev)
    const end = () => {
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
      removeEventListener('pointercancel', up)
    }
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
    addEventListener('pointercancel', up)
    edit.current = {
      index,
      location,
      grip,
      start: bbox,
      pageNumber: Number(figure.dataset.page),
      over: Number(figure.dataset.page),
      grabX: (e.clientX - page.left) / page.width - bbox.x,
      grabY: (e.clientY - page.top) / page.height - bbox.y,
      fx: (e.clientX - page.left) / page.width,
      fy: (e.clientY - page.top) / page.height,
      x: e.clientX,
      y: e.clientY,
      w: page.width,
      h: page.height,
      last: { x: e.clientX, y: e.clientY },
      end,
    }
  }
  const endEdit = (e: PointerEvent) => {
    const d = edit.current
    if (!d) return
    d.end()
    edgeSpeed.current = 0
    cancelAnimationFrame(edgeFrame.current)
    edgeFrame.current = 0
    const { bbox, pageNumber } = placed(e.clientX, e.clientY)
    edit.current = null
    setLive(null)
    if (pageNumber !== d.pageNumber) {
      carried.current.add(`${d.index}-${d.location}`)
      onBoxChange?.(d.index, d.location, bbox, pageNumber)
    } else if (Math.abs(bbox.x - d.start.x) + Math.abs(bbox.y - d.start.y) + Math.abs(bbox.width - d.start.width) + Math.abs(bbox.height - d.start.height) > 0.001) {
      onBoxChange?.(d.index, d.location, bbox)
    }
  }
  useEffect(() => () => {
    edit.current?.end()
    cancelAnimationFrame(edgeFrame.current)
  }, [])

  return { live, carried, startEdit }
}
