'use client'

import type { DraftFigure, DraftQuestion } from '@exam/core'
import { useRef, useState } from 'react'
import { FigureView } from '@/shared/FigureView'
import { useT } from '@/shared/i18n/client'
import { IconCrop, IconImageAdd, IconImageReplace, IconLoader, IconTrash } from '@/shared/icons'
import { Listbox } from '@/shared/Listbox'
import { MathTextInput } from '@/shared/math/MathTextInput'
import { useRemoval } from '@/shared/removal'
import { recropFigure, uploadFigureImage } from './actions'
import { AddChip, chip } from './editorParts'
import { FigureBlanksEditor } from './FigureBlanksEditor'
import { FigureCropper, type CropPage } from './FigureCropper'

/** Where a new figure's box starts: the question's own area on its page, or the top of page 1. */
function startingFigure(q: DraftQuestion, pages: CropPage[]): DraftFigure {
  const at = q.locations[0]
  return {
    description: '',
    bbox: at ? at.bbox : { x: 0.1, y: 0.1, width: 0.5, height: 0.25 },
    blanks: [],
    option: null,
    pageNumber: at?.pageNumber ?? pages[0]?.pageNumber ?? 1,
    image: null,
  }
}

/**
 * The question's pictures, each with its tools on the picture: frame it again on the original page,
 * replace it with an uploaded picture, or delete it (復原 brings it back). New pictures come from the
 * page or from a file. `pages` are the original pages (review only); without them, uploads still work.
 */
export function FiguresEditor({ q, onChange, importId, pages }: { q: DraftQuestion; onChange: (q: DraftQuestion) => void; importId: string | null; pages: CropPage[] }) {
  const t = useT()
  const { remove } = useRemoval()
  // which picture is being framed, cropped or uploaded; -1 is a new one not added yet
  const [framing, setFraming] = useState<{ index: number; figure: DraftFigure } | null>(null)
  const [working, setWorking] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const upload = useRef<HTMLInputElement>(null)
  const replacing = useRef<number>(-1)
  const latest = useRef(q)
  latest.current = q
  const setFigures = (figures: DraftFigure[]) => onChange({ ...latest.current, figures })
  const canFrame = Boolean(importId) && pages.length > 0
  const canUpload = Boolean(importId)

  const apply = async (pageNumber: number, bbox: DraftFigure['bbox']) => {
    if (!framing || !importId) return
    const { index, figure } = framing
    setWorking(index)
    setError(null)
    try {
      // a picture framed again keeps its blanks only on the same page
      const next = await recropFigure(importId, { ...figure, pageNumber, bbox, blanks: pageNumber === figure.pageNumber ? figure.blanks : [] })
      const figures = latest.current.figures
      setFigures(index < 0 ? [...figures, next] : figures.map((f, i) => (i === index ? next : f)))
      setFraming(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('裁切失敗，再試一次。'))
    } finally {
      setWorking(null)
    }
  }

  const uploadFile = async (file: File) => {
    if (!importId) return
    const index = replacing.current
    setWorking(index)
    setError(null)
    const form = new FormData()
    form.set('image', file)
    const reply = await uploadFigureImage(importId, form).catch(() => ({ error: t('上傳失敗，再試一次。') }))
    setWorking(null)
    if ('error' in reply) return setError(reply.error)
    const figures = latest.current.figures
    if (index < 0) setFigures([...figures, { ...startingFigure(latest.current, pages), image: reply.image }])
    // an uploaded picture has no blanks drawn on it
    else setFigures(figures.map((f, i) => (i === index ? { ...f, blanks: [], image: reply.image } : f)))
  }

  const removeAt = (index: number) => {
    const figure = q.figures[index]!
    setFigures(q.figures.filter((_, i) => i !== index))
    remove({
      id: `figure-${figure.image?.file ?? index}-${Date.now()}`,
      note: t('已刪除圖片'),
      commit: () => {},
      onUndo: () => {
        const figures = latest.current.figures
        setFigures([...figures.slice(0, index), figure, ...figures.slice(index)])
      },
    })
  }

  const pickFile = (index: number) => {
    replacing.current = index
    upload.current?.click()
  }
  const tool = 'm-press grid h-8 w-8 place-items-center rounded-lg bg-surface/95 text-muted shadow-sheet ring-1 ring-ink/[0.06] hover:text-ink'

  return (
    <>
      {q.figures.map((f, i) => (
        <div key={i} className="rounded-xl border border-line p-2">
          {framing?.index === i ? (
            <FigureCropper pages={pages} pageNumber={f.pageNumber} bbox={f.bbox} busy={working === i} onApply={apply} onCancel={() => setFraming(null)} />
          ) : (
            <div className="group/figure relative">
              <FigureView figure={f} />
              <div className="absolute right-1.5 top-1.5 flex gap-1 transition-opacity sm:opacity-0 sm:group-hover/figure:opacity-100 sm:group-focus-within/figure:opacity-100">
                {working === i && (
                  <span className={tool}>
                    <IconLoader size={15} className="m-spin" />
                  </span>
                )}
                {canFrame && (
                  <button type="button" className={tool} onClick={() => setFraming({ index: i, figure: f })} aria-label={t('在原卷上重新框選')} title={t('在原卷上重新框選')}>
                    <IconCrop size={15} />
                  </button>
                )}
                {canUpload && (
                  <button type="button" className={tool} onClick={() => pickFile(i)} aria-label={t('換一張圖片')} title={t('換一張圖片')}>
                    <IconImageReplace size={15} />
                  </button>
                )}
                <button type="button" className={`${tool} hover:!text-bad`} onClick={() => removeAt(i)} aria-label={t('刪除圖片')} title={t('刪除圖片')}>
                  <IconTrash size={15} />
                </button>
              </div>
            </div>
          )}
          {q.options.length > 0 && (
            // A picture can be one of the options instead of part of the question.
            <div className="mt-2 flex items-center gap-2 px-1 text-xs text-muted">
              <span>{t('這張圖是')}</span>
              <Listbox
                label={t('這張圖是')}
                className={`${chip} min-w-32 px-3 text-ink`}
                value={f.option && q.options.some((o) => o.label === f.option) ? f.option : ''}
                groups={[{ options: [{ value: '', label: t('題目的圖') }, ...q.options.map((o) => ({ value: o.label, label: t('選項 ({label})', { label: o.label }) }))] }]}
                onChange={(v) => setFigures(q.figures.map((g, j) => (j === i ? { ...g, option: v || null } : g)))}
              />
            </div>
          )}
          <MathTextInput
            multiline={false}
            prefix={<span className="pl-1.5 text-[11px] font-medium text-muted">{t('說明')}</span>}
            placeholder={t('圖片說明')}
            value={f.description}
            onChange={(v) => setFigures(q.figures.map((g, j) => (j === i ? { ...g, description: v } : g)))}
            className="mt-2"
          />
          {f.blanks.length ? (
            <div className="px-1">
              <FigureBlanksEditor figure={f} importId={importId} onChange={(g) => setFigures(q.figures.map((x, j) => (j === i ? g : x)))} />
            </div>
          ) : null}
        </div>
      ))}

      {framing?.index === -1 && (
        <div className="rounded-xl border border-accent/40 p-2">
          <FigureCropper pages={pages} pageNumber={framing.figure.pageNumber} bbox={framing.figure.bbox} busy={working === -1} onApply={apply} onCancel={() => setFraming(null)} />
        </div>
      )}

      {error && <p className="px-1 text-xs text-bad">{error}</p>}
      <input
        ref={upload}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void uploadFile(file)
        }}
      />
      {(canFrame || canUpload) && framing?.index !== -1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {canFrame && <AddChip onClick={() => setFraming({ index: -1, figure: startingFigure(q, pages) })}>{t('從原卷框一張圖')}</AddChip>}
          {canUpload && (
            <button
              type="button"
              onClick={() => pickFile(-1)}
              disabled={working === -1}
              className="m-press flex h-7 items-center gap-1 rounded-full border border-dashed border-ink/15 px-2.5 text-xs text-muted hover:border-accent/50 hover:bg-accent-soft hover:text-accent"
            >
              {working === -1 ? <IconLoader size={13} className="m-spin" /> : <IconImageAdd size={13} />}
              {t('上傳圖片')}
            </button>
          )}
        </div>
      )}
    </>
  )
}
