'use client'

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { IconCompare } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'

const clamp = (n: number) => Math.min(100, Math.max(0, n))

/** Where the handle sits: on the line, but never past the sheet's edges. */
const AT = 'clamp(16px, var(--m-cut), calc(100% - 16px))'

/**
 * The line across a sheet that was just read: drag it (or press the arrow keys on its handle) and the
 * student's pencil comes back on its left, the clean copy stays on its right. The pencil copy's clip,
 * the line and the handle all follow --m-cut on the sheet (motion.css, "product page"); `cut` is null
 * until the visitor first moves it, while the handle still peeks once on its own.
 * On a touch screen only a sideways drag moves the line, so the page still scrolls over the sheet.
 */
export function Compare({ cut, onCut }: { cut: number | null; onCut: (cut: number) => void }) {
  const t = useT()
  const [ready, setReady] = useState(false)
  const drag = useRef<{ id: number; x: number; y: number; on: boolean } | null>(null)

  const follow = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    onCut(Math.round(clamp(((e.clientX - box.left) / box.width) * 100) * 10) / 10)
  }
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const mouse = e.pointerType === 'mouse'
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, on: mouse }
    if (mouse) {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      follow(e)
    }
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    if (!d.on) {
      const dx = Math.abs(e.clientX - d.x)
      if (dx < 6 || dx < Math.abs(e.clientY - d.y)) return
      d.on = true
    }
    follow(e)
  }
  const up = () => {
    drag.current = null
  }
  const key = (e: KeyboardEvent) => {
    const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key]
    const to = step === undefined ? { Home: 0, End: 100 }[e.key] : clamp((cut ?? 0) + step)
    if (to === undefined) return
    e.preventDefault()
    onCut(to)
  }

  return (
    <div
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className={`absolute inset-0 z-[5] touch-pan-y select-none ${ready ? 'cursor-ew-resize' : 'pointer-events-none'}`}
    >
      {/* min(): no line at all while it sits on the sheet's edge */}
      <span className="absolute inset-y-0 left-[var(--m-cut)] w-[min(2px,var(--m-cut))] -translate-x-1/2 bg-accent" aria-hidden />
      {cut !== null && (
        <span className="absolute bottom-[18px] left-0 flex h-8 items-center justify-end overflow-hidden pr-6" style={{ width: AT }} aria-hidden>
          <Tag text={t('原卷')} />
        </span>
      )}
      <span className="absolute bottom-[18px] right-0 flex h-8 items-center overflow-hidden pl-6" style={{ left: AT }} aria-hidden>
        {cut === null ? (
          <span className="m-grip-in max-w-[11rem] text-[11.5px] font-medium leading-tight text-accent">{t('拖曳對照原卷')}</span>
        ) : (
          <Tag text={t('辨識後')} accent />
        )}
      </span>
      <div
        role="slider"
        tabIndex={ready ? 0 : -1}
        aria-label={t('對照原卷')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(cut ?? 0)}
        aria-valuetext={`${Math.round(cut ?? 0)}%`}
        onKeyDown={key}
        onAnimationEnd={(e) => e.target === e.currentTarget && setReady(true)}
        style={{ left: AT }}
        className="m-grip-in m-press absolute bottom-[18px] grid size-8 -translate-x-1/2 place-items-center rounded-full bg-surface text-accent shadow-sheet ring-2 ring-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <IconCompare size={16} strokeWidth={2.4} aria-hidden />
      </div>
    </div>
  )
}

function Tag({ text, accent = false }: { text: string; accent?: boolean }) {
  return (
    <span className={`whitespace-nowrap rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium ring-1 ${accent ? 'text-accent ring-accent/40' : 'text-muted ring-line'}`}>
      {text}
    </span>
  )
}
