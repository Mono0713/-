'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { IconPause, IconPlay, IconReplay, IconX } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { SAMPLES } from '../samples'
import { biology } from '../samples/biology'
import type { PracticeItem } from './practice'
import { IntroScene, OutroScene } from './Bookends'
import { ClassScene } from './ClassScene'
import { GradeScene } from './GradeScene'
import { PracticeScene } from './PracticeScene'
import { ReviewScene } from './ReviewScene'
import { PhotoScene, ReadScene } from './ScanScenes'
import { ramp } from './tween'

/** The stage is drawn at one of these sizes and scaled to the screen: wide, or upright on a phone. */
const WIDE = { w: 960, h: 600 }
const TALL = { w: 400, h: 760 }
/** Seconds one chapter takes to fade into the next. */
const FADE = 0.35

interface Scene {
  dur: number
  chapter?: string
  draw: (t: number, tall: boolean) => ReactNode
}

/**
 * The product tour, played full screen from the hero: the logo, then one chapter per step (upload,
 * recognise, check, practise, AI marking, classes) and the call to action. Every frame is worked out
 * from one clock, so it can pause (click the picture, the button or Space) and jump to any chapter
 * (the bar, ← →). With reduced motion each chapter shows its finished picture.
 * It plays the sample exam the hero's pile shows (`sampleId`); one without a choice question
 * practises biology's.
 */
export function Tour({ sampleId, practice, cta, onClose }: { sampleId: string; practice: Record<string, PracticeItem>; cta: ReactNode; onClose: () => void }) {
  const t = useT()
  const sample = SAMPLES.find((x) => x.id === sampleId) ?? biology
  const item = practice[sample.id] ?? practice[biology.id]!
  const scenes: Scene[] = [
    { dur: 3, draw: (s) => <IntroScene s={s} /> },
    { dur: 5.2, chapter: t('上傳'), draw: (s, tall) => <PhotoScene s={s} tall={tall} sample={sample} /> },
    { dur: 5.4, chapter: t('辨識'), draw: (s, tall) => <ReadScene s={s} tall={tall} sample={sample} /> },
    { dur: 5, chapter: t('校對'), draw: (s, tall) => <ReviewScene s={s} tall={tall} sample={sample} /> },
    { dur: 5.6, chapter: t('練習'), draw: (s, tall) => <PracticeScene s={s} tall={tall} item={item} /> },
    { dur: 5.6, chapter: t('AI 批改'), draw: (s, tall) => <GradeScene s={s} tall={tall} sample={sample} /> },
    { dur: 5, chapter: t('班級'), draw: (s, tall) => <ClassScene s={s} tall={tall} sample={sample} /> },
    { dur: 3, draw: (s, tall) => <OutroScene s={s} tall={tall} cta={cta} /> },
  ]
  const starts = scenes.map((_, i) => scenes.slice(0, i).reduce((sum, s) => sum + s.dur, 0))
  const total = starts.at(-1)! + scenes.at(-1)!.dur

  const dialog = useRef<HTMLDialogElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [clock, setClock] = useState({ time: 0, playing: true, run: 0, from: 0 })
  const [calm, setCalm] = useState(false)

  useEffect(() => {
    const d = dialog.current!
    d.showModal()
    setCalm(matchMedia('(prefers-reduced-motion: reduce)').matches)
    // the page behind keeps still while the tour is open
    const root = document.documentElement
    const before = root.style.overflow
    root.style.overflow = 'hidden'
    const seen = new ResizeObserver(([entry]) => setBox({ w: entry!.contentRect.width, h: entry!.contentRect.height }))
    seen.observe(host.current!)
    return () => {
      root.style.overflow = before
      seen.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!clock.playing) return
    let last = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      // a hidden tab stops the frames; it picks up where it was, not seconds later
      const step = Math.min(0.1, (now - last) / 1000)
      last = now
      setClock((c) => (c.time + step >= total ? { ...c, time: total, playing: false } : { ...c, time: c.time + step }))
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [clock.playing, total])

  const jump = (i: number) => setClock((c) => ({ time: starts[i]!, playing: true, run: c.run + 1, from: starts[i]! }))
  const ended = clock.time >= total
  const toggle = () => (ended ? jump(0) : setClock((c) => ({ ...c, playing: !c.playing })))

  const at = Math.max(0, starts.findLastIndex((s) => s <= clock.time))
  const local = Math.min(clock.time - starts[at]!, scenes[at]!.dur)
  const tall = box.w > 0 && box.w < 640 && box.h > box.w
  const size = tall ? TALL : WIDE
  const scale = box.w ? Math.min(box.w / size.w, box.h / size.h) : 0
  const fading = !calm && at > 0 && local < FADE && clock.time - FADE >= clock.from
  const layers = [
    ...(fading ? [{ i: at - 1, t: scenes[at - 1]!.dur, opacity: 1 - ramp(local, 0, FADE, (v) => v) }] : []),
    { i: at, t: calm ? scenes[at]!.dur : local, opacity: calm ? 1 : ramp(local, 0, FADE, (v) => v) },
  ]

  const onKey = (e: KeyboardEvent) => {
    const onButton = e.target instanceof HTMLElement && e.target.closest('button, a, input')
    if (e.key === ' ' && !onButton) {
      e.preventDefault()
      toggle()
    } else if (e.key === 'ArrowRight' && at < scenes.length - 1) jump(at + 1)
    else if (e.key === 'ArrowLeft') jump(Math.max(0, local < 1 ? at - 1 : at))
  }

  return (
    <dialog
      ref={dialog}
      aria-label={t('介紹影片')}
      onClose={onClose}
      onKeyDown={onKey}
      className="m-fade-in fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-paper p-0 text-ink backdrop:bg-night/40"
    >
      <div className="flex h-full flex-col bg-[linear-gradient(var(--color-grid)_1px,transparent_1px),linear-gradient(90deg,var(--color-grid)_1px,transparent_1px)] bg-[size:18px_18px]">
        <div className="flex justify-end p-3">
          <button type="button" onClick={() => dialog.current?.close()} aria-label={t('關閉')} className="m-press grid size-10 place-items-center rounded-full text-muted hover:bg-ink/[0.06] hover:text-ink">
            <IconX size={20} aria-hidden />
          </button>
        </div>
        <div ref={host} className="relative min-h-0 flex-1 px-4">
          {scale > 0 && (
            // clicking the picture pauses or plays, like a video
            <div
              onClick={toggle}
              className={`absolute left-1/2 top-1/2 cursor-pointer select-none ${clock.playing ? '' : 'm-hold'}`}
              style={{ width: size.w, height: size.h, transform: `translate(-50%, -50%) scale(${scale})` }}
            >
              {layers.map((layer) => (
                <div key={`${layer.i}.${clock.run}`} className="absolute inset-0" style={{ opacity: layer.opacity }}>
                  {scenes[layer.i]!.draw(layer.t, tall)}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <button
            type="button"
            autoFocus
            onClick={toggle}
            aria-label={ended ? t('重播') : clock.playing ? t('暫停') : t('播放')}
            className="m-press grid size-11 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-sheet hover:bg-accent-soft/50"
          >
            {ended ? <IconReplay size={18} aria-hidden /> : clock.playing ? <IconPause size={18} aria-hidden /> : <IconPlay size={18} aria-hidden className="translate-x-px" />}
          </button>
          <ol className="flex min-w-0 flex-1 gap-1.5">
            {scenes.map((scene, i) => {
              const done = Math.min(1, Math.max(0, (clock.time - starts[i]!) / scene.dur))
              return (
                <li key={i} className="min-w-0" style={{ flexGrow: scene.dur, flexBasis: 0 }}>
                  <button type="button" onClick={() => jump(i)} aria-label={scene.chapter ?? (i ? t('結尾') : t('開頭'))} className="group block w-full py-2 text-left">
                    <span className={`mb-1.5 hidden h-4 truncate text-xs sm:block ${i === at ? 'font-semibold text-ink' : 'text-muted group-hover:text-ink'}`}>{scene.chapter}</span>
                    <span className="block h-1 overflow-hidden rounded-full bg-line">
                      <span className="block h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${done})` }} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </dialog>
  )
}
