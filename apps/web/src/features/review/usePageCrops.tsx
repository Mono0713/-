'use client'

import { FULL_QUAD, isUsableQuad, type Quad } from '@exam/core'
import { useRef, useState } from 'react'
import { useT } from '@/shared/i18n/client'
import { UNDO_MS } from '@/shared/removal'
import { Toast } from '@/shared/Toast'
import { cropPage, findPageCorners } from './cropActions'

/** A page of the original: the image shown, and, once it has been cut, the photo as taken and where the paper is on it. */
export interface SourcePage {
  pageNumber: number
  image: string
  /** The photo as taken; missing until the page is first cut (the page image is then the photo). */
  raw?: string | null
  quad?: Quad | null
  /** Changes when the page image is saved again, so the browser shows the new one. */
  version?: number
}

/** The page being cut on the page viewer. */
export interface Cropping {
  pageNumber: number
  image: string
  quad: Quad
  busy: boolean
  /** Shown in the bar when something did not work (no sheet found, saving failed). */
  note: string | null
  onChange: (quad: Quad) => void
  onAuto: () => void
  onFull: () => void
  onApply: () => void
  onCancel: () => void
}

/**
 * Cutting the original's pages again (裁切): the page shows its photo with the paper's outline, which
 * is dragged corner by corner or edge by edge, or found again automatically; 套用 flattens the page
 * on the server and moves the draft's boxes with the paper. A note offers 復原 for a few seconds.
 */
export function usePageCrops(importId: string, initial: SourcePage[], remapPage: (pageNumber: number, from: Quad | null, to: Quad | null) => void) {
  const t = useT()
  const [pages, setPages] = useState(initial)
  const [cut, setCut] = useState<{ pageNumber: number; quad: Quad; busy: boolean; note: string | null } | null>(null)
  const [done, setDone] = useState<{ pageNumber: number; undo: () => void } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // the note keeps its words while it fades out
  const [shown, setShown] = useState(0)

  const page = (n: number) => pages.find((p) => p.pageNumber === n)
  const saved = (n: number, quad: Quad | null) =>
    setPages((ps) => ps.map((p) => (p.pageNumber === n ? { ...p, raw: p.raw ?? p.image, quad, version: Date.now() } : p)))

  const save = async (n: number, quad: Quad | null) => {
    const { before } = await cropPage(importId, n, quad)
    remapPage(n, before, quad)
    saved(n, quad)
    return before
  }

  const apply = async () => {
    if (!cut || cut.busy) return
    const n = cut.pageNumber
    setCut({ ...cut, busy: true, note: null })
    try {
      const before = await save(n, cut.quad)
      setCut(null)
      clearTimeout(timer.current)
      setDone({ pageNumber: n, undo: () => void save(n, before).catch(() => {}) })
      setShown(n)
      timer.current = setTimeout(() => setDone(null), UNDO_MS)
    } catch {
      setCut((c) => c && { ...c, busy: false, note: t('沒有存好，再試一次。') })
    }
  }

  const auto = async () => {
    if (!cut || cut.busy) return
    setCut({ ...cut, busy: true, note: null })
    const quad = await findPageCorners(importId, cut.pageNumber).catch(() => null)
    setCut((c) => c && (quad ? { ...c, quad, busy: false } : { ...c, busy: false, note: t('找不到考卷的邊，請手動拉四個角。') }))
  }

  const p = cut && page(cut.pageNumber)
  const cropping: Cropping | null =
    cut && p
      ? {
          ...cut,
          image: p.raw ?? p.image,
          onChange: (quad) => setCut((c) => c && { ...c, quad, note: isUsableQuad(quad) ? null : t('四個角交叉了，拉開一點。') }),
          onAuto: auto,
          onFull: () => setCut((c) => c && { ...c, quad: FULL_QUAD, note: null }),
          onApply: () => void (isUsableQuad(cut.quad) && apply()),
          onCancel: () => setCut(null),
        }
      : null

  return {
    pages,
    cropping,
    /** Starts cutting a page, from where the paper was last found (the whole photo when never cut). */
    start: (n: number) => setCut({ pageNumber: n, quad: page(n)?.quad ?? FULL_QUAD, busy: false, note: null }),
    toast: (
      <Toast
        show={done !== null}
        action={t('復原')}
        onAction={() => {
          done?.undo()
          setDone(null)
        }}
      >
        {t('第 {n} 頁已裁切並拉正', { n: shown })}
      </Toast>
    ),
  }
}
