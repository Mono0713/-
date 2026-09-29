'use client'

import { compactStroke, emptyInk, hitsStroke, strokePath, type InkDoc, type InkPoint, type Stroke } from '@exam/ink'
import { useMemo, useRef, useState } from 'react'
import { IconEraser, IconPen, IconRedo, IconTrash, IconUndo } from '@/shared/icons'

/** Drawing units: paths are computed for a page this many pixels wide and scaled by the SVG. */
const W = 1000
const COLORS = [
  ['#1b1d33', '黑'],
  ['#2f55d4', '藍'],
  ['#d23c3c', '紅'],
] as const
const SIZES = [
  [0.0035, '細'],
  [0.006, '粗'],
] as const

// Once a pen has touched any pad, fingers scroll instead of drawing (palm rejection).
let penSeen = false

/**
 * A page to write on with a finger, a mouse or a stylus (Apple Pencil pressure included),
 * like a notes app: pen and eraser, colours, undo and redo, and the page grows as you write
 * near the bottom. The ink is data (@exam/ink), so it can be saved, shown again or read by AI.
 */
export function InkPad({
  value,
  onChange,
  readOnly = false,
  minHeight = 0.45,
  label,
}: {
  value: InkDoc | null | undefined
  onChange?: (doc: InkDoc) => void
  readOnly?: boolean
  /** Starting height in page widths. */
  minHeight?: number
  label: string
}) {
  const doc = value ?? emptyInk(minHeight)
  // The latest page, also between renders (an eraser drag changes it many times per event).
  const latest = useRef(doc)
  latest.current = doc
  const svg = useRef<SVGSVGElement>(null)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [color, setColor] = useState<string>(COLORS[0][0])
  const [size, setSize] = useState<number>(SIZES[0][0])
  const [live, setLive] = useState<Stroke | null>(null)
  const history = useRef<{ undo: InkDoc[]; redo: InkDoc[] }>({ undo: [], redo: [] })
  const gesture = useRef<{ id: number; mode: 'draw' | 'erase' | 'scroll'; lastY: number; erased: boolean; last: InkPoint | null } | null>(null)

  const change = (next: InkDoc) => {
    latest.current = next
    onChange?.(next)
  }
  const commit = (next: InkDoc, before: InkDoc = latest.current) => {
    history.current.undo.push(before)
    history.current.redo = []
    change(next)
  }
  const undo = () => {
    const prev = history.current.undo.pop()
    if (!prev) return
    history.current.redo.push(latest.current)
    change(prev)
  }
  const redo = () => {
    const next = history.current.redo.pop()
    if (!next) return
    history.current.undo.push(latest.current)
    change(next)
  }

  const at = (e: { clientX: number; clientY: number; pressure: number; pointerType: string }): InkPoint => {
    const r = svg.current!.getBoundingClientRect()
    // Mice report 0.5 while pressed; a pen reports real pressure.
    const p = e.pointerType === 'pen' ? Math.max(0.05, e.pressure) : 0.5
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.width, p]
  }

  const erase = (x: number, y: number) => {
    const page = latest.current
    const kept = page.strokes.filter((s) => !hitsStroke(s, x, y, 0.012))
    if (kept.length === page.strokes.length) return
    // One eraser drag is one undo step.
    if (gesture.current?.erased) change({ ...page, strokes: kept })
    else commit({ ...page, strokes: kept })
    if (gesture.current) gesture.current.erased = true
  }

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly || gesture.current) return
    if (e.pointerType === 'pen') penSeen = true
    const scroll = e.pointerType === 'touch' && penSeen
    const erasing = tool === 'eraser' || e.button === 5 || (e.buttons & 32) !== 0
    gesture.current = { id: e.pointerId, mode: scroll ? 'scroll' : erasing ? 'erase' : 'draw', lastY: e.clientY, erased: false, last: null }
    e.currentTarget.setPointerCapture(e.pointerId)
    const point = at(e)
    if (gesture.current.mode === 'draw') setLive({ points: [point], color, size })
    if (gesture.current.mode === 'erase') {
      gesture.current.last = point
      erase(point[0], point[1])
    }
  }

  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    if (g.mode === 'scroll') {
      scrollBy(0, g.lastY - e.clientY)
      g.lastY = e.clientY
      return
    }
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    const points = (events.length ? events : [e.nativeEvent]).map((ev) => at(ev))
    if (g.mode === 'erase') {
      // Check along the way between events too, so a fast swipe erases what it crosses.
      for (const p of points) {
        const [ax, ay] = g.last ?? p
        const steps = Math.max(1, Math.ceil(Math.hypot(p[0] - ax, p[1] - ay) / 0.006))
        for (let k = 1; k <= steps; k++) erase(ax + ((p[0] - ax) * k) / steps, ay + ((p[1] - ay) * k) / steps)
        g.last = p
      }
      return
    }
    setLive((s) => (s ? { ...s, points: [...s.points, ...points] } : s))
  }

  const up = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    gesture.current = null
    if (g.mode !== 'draw' || !live) return setLive(null)
    const stroke = compactStroke(live)
    setLive(null)
    // Writing near the bottom makes room for more.
    const page = latest.current
    const lowest = Math.max(...stroke.points.map(([, y]) => y))
    const height = lowest > page.height - 0.08 ? page.height + 0.25 : page.height
    commit({ strokes: [...page.strokes, stroke], height })
  }

  const paths = useMemo(() => doc.strokes.map((s) => ({ d: strokePath(s, W), color: s.color })), [doc.strokes])
  const height = doc.height * W
  const button = (on: boolean) => `m-press grid h-8 w-8 place-items-center rounded-lg ${on ? 'bg-ink text-paper' : 'text-muted hover:bg-ink/[0.06] hover:text-ink'}`

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 border-b border-line/70 px-2 py-1.5" role="toolbar" aria-label={`${label}工具`}>
          <button type="button" className={button(tool === 'pen')} onClick={() => setTool('pen')} aria-label="筆" aria-pressed={tool === 'pen'} title="筆">
            <IconPen size={16} />
          </button>
          <button type="button" className={button(tool === 'eraser')} onClick={() => setTool('eraser')} aria-label="橡皮擦" aria-pressed={tool === 'eraser'} title="橡皮擦（擦掉整筆）">
            <IconEraser size={16} />
          </button>
          <span className="mx-1 h-5 w-px bg-line" />
          {COLORS.map(([c, name]) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColor(c)
                setTool('pen')
              }}
              className={`m-press grid h-8 w-8 place-items-center rounded-lg ${color === c && tool === 'pen' ? 'bg-ink/[0.08]' : ''}`}
              aria-label={`${name}色`}
              aria-pressed={color === c}
            >
              <span className="h-4 w-4 rounded-full ring-2 ring-white" style={{ background: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }} />
            </button>
          ))}
          {SIZES.map(([s, name]) => (
            <button key={s} type="button" onClick={() => setSize(s)} className={`${button(size === s)} w-9 text-xs`} aria-pressed={size === s}>
              {name}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1">
            <button type="button" className={button(false)} onClick={undo} disabled={!history.current.undo.length} aria-label="復原" title="復原">
              <IconUndo size={16} />
            </button>
            <button type="button" className={button(false)} onClick={redo} disabled={!history.current.redo.length} aria-label="重做" title="重做">
              <IconRedo size={16} />
            </button>
            <button type="button" className={`${button(false)} hover:text-bad`} onClick={() => doc.strokes.length && confirm('清除整頁？') && commit({ ...doc, strokes: [] })} aria-label="清除" title="清除整頁">
              <IconTrash size={15} />
            </button>
          </span>
        </div>
      )}
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={label}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className={`block w-full select-none bg-[radial-gradient(rgb(22_24_43/0.09)_1px,transparent_1.2px)] bg-[length:22px_22px] ${readOnly ? '' : 'cursor-crosshair touch-none'}`}
        style={{ aspectRatio: `${W} / ${height}` }}
      >
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} />
        ))}
        {live && <path d={strokePath(live, W)} fill={live.color} />}
      </svg>
      {!readOnly && (
        <button type="button" onClick={() => change({ ...doc, height: doc.height + 0.3 })} className="w-full border-t border-line/70 py-1.5 text-xs text-muted hover:bg-paper hover:text-ink">
          ＋ 加長頁面
        </button>
      )}
    </div>
  )
}
