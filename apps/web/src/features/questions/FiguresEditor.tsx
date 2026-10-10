'use client'

import type { DraftFigure, DraftQuestion } from '@exam/core'
import { useT } from '@/shared/i18n/client'
import { IconImageAdd, IconLoader } from '@/shared/icons'
import { Listbox } from '@/shared/Listbox'
import { MathTextInput } from '@/shared/math/MathTextInput'
import { AddChip, chip } from './editorParts'
import { FigureBlanksEditor } from './FigureBlanksEditor'
import { FigureTile } from './FigureTile'
import type { FigureTools } from './useFigureTools'

/** A picture that belongs to the question itself, not to one of its options. */
export const isQuestionFigure = (q: DraftQuestion, f: DraftFigure) => !f.option || !q.options.some((o) => o.label === f.option)

/**
 * The question's own pictures, each with its tools on it, which option it is (a picture moved to
 * an option shows under that option instead), its description and the blanks drawn on it.
 * New pictures are framed on the original page or uploaded.
 */
export function FiguresEditor({ q, onChange, importId, tools }: { q: DraftQuestion; onChange: (q: DraftQuestion) => void; importId: string | null; tools: FigureTools }) {
  const t = useT()
  const setFigure = (figure: DraftFigure, next: DraftFigure) => onChange({ ...q, figures: q.figures.map((f) => (f === figure ? next : f)) })
  const own = q.figures.filter((f) => isQuestionFigure(q, f))

  return (
    <>
      {own.map((f, i) => (
        <div key={i} className="rounded-xl border border-line p-2">
          <FigureTile figure={f} tools={tools} />
          {q.options.length > 0 && (
            // A picture can be one of the options instead of part of the question.
            <div className="mt-2 flex items-center gap-2 px-1 text-xs text-muted">
              <span>{t('這張圖是')}</span>
              <Listbox
                label={t('這張圖是')}
                className={`${chip} min-w-32 px-3 text-ink`}
                value=""
                groups={[{ options: [{ value: '', label: t('題目的圖') }, ...q.options.map((o) => ({ value: o.label, label: t('選項 ({label})', { label: o.label }) }))] }]}
                onChange={(v) => setFigure(f, { ...f, option: v || null, description: v ? '' : f.description })}
              />
            </div>
          )}
          <MathTextInput
            multiline={false}
            prefix={<span className="pl-1.5 text-[11px] font-medium text-muted">{t('說明')}</span>}
            placeholder={t('圖片說明')}
            value={f.description}
            onChange={(v) => setFigure(f, { ...f, description: v })}
            className="mt-2"
          />
          {f.blanks.length ? (
            <div className="px-1">
              <FigureBlanksEditor figure={f} importId={importId} onChange={(g) => setFigure(f, g)} />
            </div>
          ) : null}
        </div>
      ))}

      {tools.error && <p className="px-1 text-xs text-bad">{tools.error}</p>}
      {(tools.canFrame || tools.canUpload) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tools.canFrame && (
            <AddChip onClick={() => tools.reframe('')}>{tools.framing === '' ? t('正在原卷上框選…') : t('從原卷框一張圖')}</AddChip>
          )}
          {tools.canUpload && (
            <button
              type="button"
              onClick={() => tools.pick('')}
              disabled={tools.working === ''}
              className="m-press flex h-7 items-center gap-1 rounded-full border border-dashed border-ink/15 px-2.5 text-xs text-muted hover:border-accent/50 hover:bg-accent-soft hover:text-accent"
            >
              {tools.working === '' ? <IconLoader size={13} className="m-spin" /> : <IconImageAdd size={13} />}
              {t('上傳圖片')}
            </button>
          )}
        </div>
      )}
    </>
  )
}
