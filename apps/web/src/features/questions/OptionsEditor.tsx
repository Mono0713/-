'use client'

import { optionFigures, type DraftQuestion } from '@exam/core'
import { OptionPictures } from '@/shared/FigureView'
import { IconImageAdd, IconLoader, IconPlus } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { MathTextInput } from '@/shared/math/MathTextInput'
import { iconButton, RemoveButton, SectionHead } from './editorParts'
import { FigureTile } from './FigureTile'
import type { FigureTools } from './useFigureTools'

/**
 * The options, each with its text and, for picture options, its picture right under it with the
 * picture's tools (`tools`, where pictures can be edited). An option without one can get one.
 */
export function OptionsEditor({ q, onChange, tools }: { q: DraftQuestion; onChange: (q: DraftQuestion) => void; tools?: FigureTools }) {
  const t = useT()
  const setOptions = (options: DraftQuestion['options']) => onChange({ ...q, options })
  // A renamed option keeps its pictures.
  const setLabel = (i: number, label: string) => {
    const old = q.options[i]!.label
    onChange({
      ...q,
      options: q.options.map((p, j) => (j === i ? { ...p, label } : p)),
      figures: q.figures.map((f) => (f.option === old ? { ...f, option: label } : f)),
    })
  }
  const nextLabel = () => {
    const last = q.options.at(-1)?.label
    if (last && /^[A-Y]$/.test(last)) return String.fromCharCode(last.charCodeAt(0) + 1)
    if (last && /^\d+$/.test(last)) return String(Number(last) + 1)
    return 'A'
  }
  return (
    <div>
      <SectionHead title={t('選項')}>
        <button type="button" onClick={() => setOptions([...q.options, { label: nextLabel(), content: '' }])} className="m-press flex h-7 items-center gap-1 rounded-md px-2 text-xs text-accent hover:bg-accent-soft">
          <IconPlus size={13} strokeWidth={2.4} />
          {t('新增')}
        </button>
      </SectionHead>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
        {q.options.map((o, i) => (
          <div key={i}>
            <MathTextInput
              value={o.content}
              onChange={(v) => setOptions(q.options.map((p, j) => (j === i ? { ...p, content: v } : p)))}
              multiline={false}
              placeholder={t('選項內容')}
              prefix={
                <input
                  autoComplete="off"
                  value={o.label}
                  onChange={(e) => setLabel(i, e.target.value)}
                  className="num h-7 w-9 rounded-md bg-ink/[0.045] text-center text-[13px] font-semibold text-muted outline-none focus:bg-accent-soft focus:text-accent"
                  aria-label={t('選項代號')}
                  title={t('選項代號')}
                />
              }
              actions={
                <>
                  {tools && !optionFigures(q, o.label).length && (tools.canFrame || tools.canUpload) && (
                    <button
                      type="button"
                      onClick={() => (tools.canFrame ? tools.reframe(o.label) : tools.pick(o.label))}
                      className={`${iconButton} h-6 w-6 ${tools.framing === o.label ? '!text-accent' : ''}`}
                      aria-label={t('幫選項 {label} 加圖片', { label: o.label })}
                      title={t('幫選項 {label} 加圖片', { label: o.label })}
                    >
                      {tools.working === o.label ? <IconLoader size={14} className="m-spin" /> : <IconImageAdd size={14} />}
                    </button>
                  )}
                  <RemoveButton label={t('刪除選項 {label}', { label: o.label })} onClick={() => setOptions(q.options.filter((_, j) => j !== i))} />
                </>
              }
            />
            {/* a picture option shows its picture under the text, with its tools */}
            <div className="pl-11">
              {tools ? (
                optionFigures(q, o.label).map((f, j) => (
                  <div key={j} className="mt-1">
                    <FigureTile figure={f} tools={tools} option />
                  </div>
                ))
              ) : (
                <OptionPictures figures={optionFigures(q, o.label)} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
