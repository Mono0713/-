'use client'

import type { BoundingBox, DraftFigure, DraftQuestion } from '@exam/core'
import { useRef, useState } from 'react'
import { useT } from '@/shared/i18n/client'
import { useRemoval } from '@/shared/removal'
import { recropFigure, uploadFigureImage } from './actions'

export type FrameArea = { pageNumber: number; bbox: BoundingBox }
/**
 * Frames a picture on the original pages (the review page does it on its page viewer): starts
 * from `start`, resolves with the area chosen, or null when it was cancelled.
 */
export type FrameFigure = (start: FrameArea) => Promise<FrameArea | null>

/** Where a new picture's box starts: the question's own area on its page, or the top of page 1. */
function startingFigure(q: DraftQuestion, option: string | null): DraftFigure {
  const at = q.locations[0]
  return {
    description: '',
    bbox: at ? at.bbox : { x: 0.1, y: 0.1, width: 0.5, height: 0.25 },
    blanks: [],
    option,
    pageNumber: at?.pageNumber ?? 1,
    image: null,
  }
}

/**
 * What can be done to a question's pictures, shared by the question's own pictures and its picture
 * options: frame one again on the original page, replace it with an uploaded picture, delete it
 * (復原 brings it back), or add one, framed or uploaded. A picture is named by its object, so
 * edits elsewhere in the question meanwhile never land on the wrong one. `input` must be rendered once.
 */
export function useFigureTools({ q, onChange, importId, frame }: { q: DraftQuestion; onChange: (q: DraftQuestion) => void; importId: string | null; frame?: FrameFigure }) {
  const t = useT()
  const { remove } = useRemoval()
  // the picture being framed, cropped or uploaded; a string is the option a new one is for ('' for the question)
  const [framing, setFraming] = useState<DraftFigure | string | null>(null)
  const [working, setWorking] = useState<DraftFigure | string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const uploadFor = useRef<DraftFigure | string>('')
  const latest = useRef(q)
  latest.current = q
  const setFigures = (figures: DraftFigure[]) => onChange({ ...latest.current, figures })
  /** Puts `next` where `old` is (a string: adds it), if that picture is still there. */
  const put = (old: DraftFigure | string, next: DraftFigure) => {
    const figures = latest.current.figures
    if (typeof old === 'string') return setFigures([...figures, next])
    if (figures.includes(old)) setFigures(figures.map((f) => (f === old ? next : f)))
  }

  const run = async (target: DraftFigure | string, job: () => Promise<DraftFigure | null>) => {
    setWorking(target)
    setError(null)
    try {
      const next = await job()
      if (next) put(target, next)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('裁切失敗，再試一次。'))
    } finally {
      setWorking(null)
    }
  }

  /** Frames a picture again on its page (or a new one, given the option it is for). */
  const reframe = async (target: DraftFigure | string) => {
    if (!frame || !importId) return
    const figure = typeof target === 'string' ? startingFigure(latest.current, target || null) : target
    setFraming(target)
    // a box too small to grab starts as the question's area instead
    const tiny = figure.bbox.width < 0.03 || figure.bbox.height < 0.03
    const start = tiny ? startingFigure(latest.current, null) : figure
    const area = await frame({ pageNumber: start.pageNumber, bbox: start.bbox })
    setFraming(null)
    if (!area) return
    // a picture framed again keeps its blanks only on the same page
    await run(target, () => recropFigure(importId, { ...figure, ...area, blanks: area.pageNumber === figure.pageNumber ? figure.blanks : [] }))
  }

  const pick = (target: DraftFigure | string) => {
    uploadFor.current = target
    file.current?.click()
  }
  const upload = (picked: File) => {
    if (!importId) return
    const target = uploadFor.current
    const form = new FormData()
    form.set('image', picked)
    void run(target, async () => {
      const reply = await uploadFigureImage(importId, form).catch(() => ({ error: t('上傳失敗，再試一次。') }))
      if ('error' in reply) throw new Error(reply.error)
      // an uploaded picture has no blanks drawn on it
      return typeof target === 'string' ? { ...startingFigure(latest.current, target || null), image: reply.image } : { ...target, blanks: [], image: reply.image }
    })
  }

  const removeFigure = (figure: DraftFigure) => {
    const at = latest.current.figures.indexOf(figure)
    if (at < 0) return
    setFigures(latest.current.figures.filter((f) => f !== figure))
    remove({
      id: `figure-${figure.image?.file ?? at}-${Date.now()}`,
      note: t('已刪除圖片'),
      commit: () => {},
      onUndo: () => {
        const figures = latest.current.figures
        if (!figures.includes(figure)) setFigures([...figures.slice(0, at), figure, ...figures.slice(at)])
      },
    })
  }

  return {
    canFrame: Boolean(frame && importId),
    canUpload: Boolean(importId),
    framing,
    working,
    error,
    reframe: (target: DraftFigure | string) => void reframe(target),
    pick,
    remove: removeFigure,
    input: (
      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0]
          e.target.value = ''
          if (picked) upload(picked)
        }}
      />
    ),
  }
}

export type FigureTools = ReturnType<typeof useFigureTools>
