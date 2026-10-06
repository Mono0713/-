'use client'

import type { IntegrityEvent } from '@exam/quiz'
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/shared/i18n/client'
import { Button } from '@/shared/ui'
import { logIntegrity } from './integrity'

/** Leaving for less than this (a notification sliding down, a stray click) is not recorded. */
const SHORTEST_MS = 800
const FLUSH_EVERY_MS = 4000

/**
 * Keys that take a screenshot and reach the page: Print Screen (seen when it is let go, often
 * its only event) and Win/⌘ + Shift + S/3/4/5 (seen when pressed). One press counts once.
 */
const isScreenshotKey = (e: KeyboardEvent) =>
  e.type === 'keyup' ? e.key === 'PrintScreen' : e.metaKey && e.shiftKey && ['s', 'S', '3', '4', '5'].includes(e.key)

/** Proctors on screen; full screen ends once the last one goes (not when React remounts one). */
let live = 0

const editable = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'MATH-FIELD'].includes(target.tagName))

/** Nothing on the exam page can be selected or printed; the student's own answer boxes still can be. */
const LOCKED_CSS = `body{-webkit-user-select:none;user-select:none}
input,textarea,math-field,[contenteditable="true"]{-webkit-user-select:text;user-select:text}
@media print{body{display:none!important}}`

/**
 * Watches a class exam while a student writes it, and tells them so. The page cannot stop a
 * phone screenshot or another device; it records what a browser can notice — the page leaving
 * the screen, the window losing focus (another window, a Lens or screenshot overlay), leaving
 * full screen, screenshot keys, copying and pasting — for the teacher to judge. Questions cannot
 * be selected, copied, dragged out or printed; only the student's own answers can be copied.
 */
export function Proctor({ attemptId, fullscreen }: { attemptId: string; fullscreen: boolean }) {
  const t = useT()
  const queue = useRef<IntegrityEvent[]>([])
  const [outside, setOutside] = useState(false)
  // iPhone Safari has no full screen for pages; there only the rest is recorded.
  const [canFull, setCanFull] = useState(false)

  useEffect(() => {
    const record = (kind: IntegrityEvent['kind'], since?: number) => {
      const now = Date.now()
      if (since !== undefined && now - since < SHORTEST_MS) return
      queue.current.push({ kind, at: new Date(since ?? now).toISOString(), ...(since !== undefined && { ms: now - since }) })
    }
    const flush = () => {
      if (!queue.current.length) return
      const batch = queue.current.splice(0)
      void logIntegrity(attemptId, batch).catch(() => queue.current.unshift(...batch))
    }
    let hiddenAt: number | undefined
    let blurAt: number | undefined
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        blurAt = undefined
        flush()
      } else if (hiddenAt !== undefined) {
        record('hidden', hiddenAt)
        hiddenAt = undefined
      }
    }
    const onBlur = () => {
      if (document.visibilityState === 'visible') blurAt = Date.now()
    }
    const onFocus = () => {
      if (blurAt !== undefined) record('blur', blurAt)
      blurAt = undefined
    }
    const onKey = (e: KeyboardEvent) => {
      if (isScreenshotKey(e)) record('screenshot')
      if (e.type === 'keydown' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') e.preventDefault()
    }
    // A copy is stopped (and still noted) unless it comes from the student's own answer.
    const onCopy = (e: ClipboardEvent) => {
      if (editable(e.target)) return
      e.preventDefault()
      record('copy')
    }
    const onSelect = (e: Event) => {
      if (!editable(e.target)) e.preventDefault()
    }
    const onPaste = () => record('paste')
    // Long-pressing a picture opens "Search with Google Lens" on Android; outside the answer boxes the menu stays shut.
    const onMenu = (e: MouseEvent) => {
      if (!editable(e.target)) e.preventDefault()
    }
    const onFull = () => {
      const full = document.fullscreenElement !== null
      setOutside(!full)
      if (!full) record('fullscreen')
    }

    const full = fullscreen && document.fullscreenEnabled
    setCanFull(full)
    if (full) setOutside(document.fullscreenElement === null)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    window.addEventListener('keyup', onKey)
    window.addEventListener('keydown', onKey)
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCopy)
    document.addEventListener('paste', onPaste)
    document.addEventListener('contextmenu', onMenu)
    document.addEventListener('selectstart', onSelect)
    document.addEventListener('dragstart', onSelect)
    if (full) document.addEventListener('fullscreenchange', onFull)
    const root = document.documentElement.style
    root.setProperty('-webkit-touch-callout', 'none')
    const timer = window.setInterval(flush, FLUSH_EVERY_MS)
    live++
    return () => {
      live--
      flush()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCopy)
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('contextmenu', onMenu)
      document.removeEventListener('selectstart', onSelect)
      document.removeEventListener('dragstart', onSelect)
      document.removeEventListener('fullscreenchange', onFull)
      root.removeProperty('-webkit-touch-callout')
      // The exam is over or left: full screen ends with it.
      if (full) window.setTimeout(() => live === 0 && document.fullscreenElement && void document.exitFullscreen().catch(() => {}), 0)
    }
  }, [attemptId, fullscreen])

  return (
    <>
      <style>{LOCKED_CSS}</style>
      <p className="mb-3 text-xs text-muted">{fullscreen && canFull ? t('這是全螢幕考試：題目不能複製，離開全螢幕、切換分頁或程式、按截圖鍵都會記錄給老師。') : t('這份考試的題目不能複製，離開畫面、切換分頁或程式、按截圖鍵的次數會記錄給老師。')}</p>
      {canFull && outside && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-paper/95 p-6 backdrop-blur-sm">
          <div className="m-enter max-w-sm space-y-4 text-center">
            <p className="text-lg font-semibold">{t('回到全螢幕繼續作答')}</p>
            <p className="text-sm text-muted">{t('這份考試要在全螢幕作答。題目會在進入全螢幕後出現，離開全螢幕的次數老師看得到。')}</p>
            <Button variant="primary" onClick={() => void document.documentElement.requestFullscreen().catch(() => {})}>
              {t('進入全螢幕')}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
