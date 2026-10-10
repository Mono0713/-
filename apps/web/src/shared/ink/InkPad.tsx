'use client'

import { compactStroke, emptyInk, hitsStroke, paperGuides, paperLines, practiceHeight, strokePath, type InkDoc, type InkPoint, type Paper, type Stroke } from '@exam/ink'
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { IconEraser, IconPen, IconRedo, IconTrash, IconUndo } from '@/shared/icons'

/** Drawing units: paths are computed for a page this many pixels wide and scaled by the SVG. */
const W = 1000
const COLORS = [
  ['#1b1d33', msg('黑')],
  ['#2f55d4', msg('藍')],
  ['#d23c3c', msg('紅')],
] as const
/** Pen width range (in page widths) for the size slider, and where it starts. */
const SIZE_MIN = 0.002
const SIZE_MAX = 0.009
const SIZE_START = 0.0035
/** Black ink is stored as black (AI reads it on white) but drawn in the theme's ink color, so it shows in dark mode. */
const shown = (c: string) => (c === COLORS[0][0] ? 'var(--color-ink)' : c)

const DOTS: Paper = { kind: 'dots' }

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
  paper = DOTS,
  tools,
  view,
  backdrop,
}: {
  value: InkDoc | null | undefined
  onChange?: (doc: InkDoc) => void
  readOnly?: boolean
  /** Starting height in page widths. */
  minHeight?: number
  label: string
  /** What the page looks like underneath; a practice grid has a fixed size. */
  paper?: Paper
  /** Extra controls at the end of the toolbar (e.g. a paper picker). */
  tools?: React.ReactNode
  /** Shows only this part of the page, enlarged to the pad's width (in page widths), e.g. one practice cell group on a phone. */
  view?: { x: number; y: number; w: number; h: number }
  /** A picture to draw on (作圖題: a number line, axes, a diagram); the page takes its shape. `aspect` is height / width. */
  backdrop?: { src: string; aspect: number }
}) {
  const t = useT()
  const fixed = backdrop ? backdrop.aspect : paper.kind === 'practice' ? practiceHeight(paper) : null
  const doc = value ? (fixed ? { ...value, height: fixed } : value) : emptyInk(fixed ?? minHeight)
  // The latest page, also between renders (an eraser drag changes it many times per event).
  const latest = useRef(doc)
  latest.current = doc
  const svg = useRef<SVGSVGElement>(null)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [color, setColor] = useState<string>(COLORS[0][0])
  const [size, setSize] = useState<number>(SIZE_START)
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
    const scale = view?.w ?? 1
    return [(view?.x ?? 0) + ((e.clientX - r.left) / r.width) * scale, (view?.y ?? 0) + ((e.clientY - r.top) / r.width) * scale, p]
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
    const height = !fixed && lowest > page.height - 0.08 ? page.height + 0.25 : page.height
    commit({ strokes: [...page.strokes, stroke], height })
  }

  const paths = useMemo(() => doc.strokes.map((s) => ({ d: strokePath(s, W), color: s.color })), [doc.strokes])
  const height = doc.height * W
  const lines = useMemo(() => paperLines(paper, doc.height), [paper, doc.height])
  const guides = useMemo(() => paperGuides(paper), [paper])
  const button = (on: boolean) => `m-press grid h-8 w-8 place-items-center rounded-lg ${on ? 'bg-ink text-paper' : 'text-muted hover:bg-ink/[0.06] hover:text-ink'}`

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 border-b border-line/70 px-2 py-1.5" role="toolbar" aria-label={t('{label}工具', { label })}>
          <button type="button" className={button(tool === 'pen')} onClick={() => setTool('pen')} aria-label={t('筆')} aria-pressed={tool === 'pen'} title={t('筆')}>
            <IconPen size={16} />
          </button>
          <button type="button" className={button(tool === 'eraser')} onClick={() => setTool('eraser')} aria-label={t('橡皮擦')} aria-pressed={tool === 'eraser'} title={t('橡皮擦（擦掉整筆）')}>
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
              aria-label={t('{color}色', { color: t(name) })}
              aria-pressed={color === c}
            >
              <span className="h-4 w-4 rounded-full ring-2 ring-surface" style={{ background: shown(c), boxShadow: color === c ? `0 0 0 2px ${shown(c)}` : undefined }} />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          {/* pen width: a wedge that thickens to the right, with a dot showing the real width */}
          <label className="flex items-center gap-2 pl-1 pr-2" title={t('筆的粗細')}>
            <span className="m-wedge" style={{ '--v': `${((size - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)) * 100}%` } as CSSProperties}>
            <input
              type="range"
              min={SIZE_MIN}
              max={SIZE_MAX}
              step={0.0001}
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value))
                setTool('pen')
              }}
              aria-label={t('筆的粗細')}
              className="w-24"
            />
            </span>
            <span className="grid h-6 w-6 place-items-center">
              <span className="rounded-full" style={{ width: Math.max(2, size * 2400), height: Math.max(2, size * 2400), background: shown(color) }} />
            </span>
          </label>
          {tools}
          <span className="ml-auto flex items-center gap-1">
            <button type="button" className={button(false)} onClick={undo} disabled={!history.current.undo.length} aria-label={t('復原')} title={t('復原')}>
              <IconUndo size={16} />
            </button>
            <button type="button" className={button(false)} onClick={redo} disabled={!history.current.redo.length} aria-label={t('重做')} title={t('重做')}>
              <IconRedo size={16} />
            </button>
            <button type="button" className={`${button(false)} hover:text-bad`} onClick={() => doc.strokes.length && commit({ ...doc, strokes: [] })} aria-label={t('清除')} title={t('清除整頁（可以復原）')}>
              <IconTrash size={15} />
            </button>
          </span>
        </div>
      )}
      <svg
        ref={svg}
        viewBox={view ? `${view.x * W} ${view.y * W} ${view.w * W} ${view.h * W}` : `0 0 ${W} ${height}`}
        role="img"
        aria-label={label}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className={`block w-full select-none ${paper.kind === 'dots' ? 'bg-[radial-gradient(color-mix(in_srgb,var(--color-ink)_11%,transparent)_1px,transparent_1.2px)] bg-[length:22px_22px]' : ''} ${readOnly ? '' : 'cursor-crosshair touch-none'}`}
        style={{ aspectRatio: view ? `${view.w} / ${view.h}` : `${W} / ${height}` }}
      >
        {backdrop && <image href={backdrop.src} x={0} y={0} width={W} height={W * backdrop.aspect} preserveAspectRatio="none" style={{ pointerEvents: 'none' }} />}
        {lines.map((l, i) => (
          <line
            key={i}
            x1={l.x1 * W}
            y1={l.y1 * W}
            x2={l.x2 * W}
            y2={l.y2 * W}
            style={{ stroke: `color-mix(in srgb, var(--color-bad) ${l.style === 'guide' ? 30 : paper.kind === 'practice' ? 55 : 32}%, transparent)` }}
            strokeWidth={l.style === 'guide' ? 1.2 : 1.6}
            strokeDasharray={l.style === 'guide' ? '6 6' : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* the model character to copy, then fainter ones to trace over (楷書, like a practice book) */}
        {guides.map((g, i) => (
          <text
            key={i}
            x={g.x * W}
            y={g.y * W}
            fontSize={g.size * W * 0.78}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontFamily: 'var(--font-hand)', fill: g.kind === 'model' ? 'var(--color-ink)' : 'color-mix(in srgb, var(--color-ink) 16%, transparent)' }}
            aria-hidden
          >
            {g.char}
          </text>
        ))}
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={shown(p.color)} />
        ))}
        {live && <path d={strokePath(live, W)} fill={shown(live.color)} />}
      </svg>
      {!readOnly && !fixed && (
        <button type="button" onClick={() => change({ ...doc, height: doc.height + 0.3 })} className="w-full border-t border-line/70 py-1.5 text-xs text-muted hover:bg-paper hover:text-ink">
          {t('＋ 加長頁面')}
        </button>
      )}
    </div>
  )
}
