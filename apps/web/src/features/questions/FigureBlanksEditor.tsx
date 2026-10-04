'use client'

import { defaultPrintedText, type BlankInk, type DraftFigure, type FigureBlank } from '@exam/core'
import { useState, useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { INK_LABELS } from '@/shared/labels'
import { Button, inputBase, inputClass } from '@/shared/ui'
import { recropFigure } from './actions'

const INKS: BlankInk[] = ['colour', 'dark', 'none']

/**
 * How each blank on a figure is cleaned. Coloured ink is erased stroke by stroke;
 * pencil and black pen look like print, so those blanks are cleared and their
 * printed text is typed back in. Re-crop applies the settings to the image.
 */
export function FigureBlanksEditor({
  figure,
  importId,
  onChange,
}: {
  figure: DraftFigure
  importId: string | null
  onChange: (figure: DraftFigure) => void
}) {
  const t = useT()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const setBlanks = (blanks: FigureBlank[]) => onChange({ ...figure, blanks })
  const setBlank = (index: number, patch: Partial<FigureBlank>) => setBlanks(figure.blanks.map((b, i) => (i === index ? { ...b, ...patch } : b)))

  const recrop = () =>
    start(async () => {
      setError(null)
      try {
        onChange(await recropFigure(importId!, figure))
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })

  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-muted hover:text-ink">{t('圖上空格的筆跡清理')}</summary>
      <div className="mt-2 space-y-2">
        <label className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {t('全部空格改為')}
          <select
            value=""
            onChange={(e) => e.target.value && setBlanks(figure.blanks.map((b) => ({ ...b, ink: e.target.value as BlankInk })))}
            className={`${inputBase} w-auto`}
          >
            <option value="">{t('選擇…')}</option>
            {INKS.map((ink) => (
              <option key={ink} value={ink}>
                {t(INK_LABELS[ink])}
              </option>
            ))}
          </select>
        </label>
        {figure.blanks.map((b, i) => (
          <div key={i} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[3.5rem_16rem_minmax(0,1fr)]">
            <span className="text-xs text-muted">{t('空格 {label}', { label: b.label })}</span>
            <select value={b.ink ?? 'colour'} onChange={(e) => setBlank(i, { ink: e.target.value as BlankInk })} className={inputClass} aria-label={t('空格 {label} 的筆跡', { label: b.label })}>
              {INKS.map((ink) => (
                <option key={ink} value={ink}>
                  {t(INK_LABELS[ink])}
                </option>
              ))}
            </select>
            {b.ink === 'dark' ? (
              <input
                autoComplete="off"
                value={(b.printedText ?? '').replace(/\n/g, '\\n')}
                onChange={(e) => setBlank(i, { printedText: e.target.value.replace(/\\n/g, '\n') || null })}
                placeholder={t('格內印刷字，留空則只印「{text}」', { text: defaultPrintedText(b.label) })}
                className={`${inputClass} col-span-2 sm:col-span-1`}
                aria-label={t('空格 {label} 的印刷字', { label: b.label })}
              />
            ) : null}
          </div>
        ))}
        <p className="text-xs text-muted">
          {t('鉛筆或黑筆的格子會整格清空，再把印刷字打回去：用 ___ 表示作答的空白，\\n 表示換行，例如 Organ\\n5. ___。')}
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={recrop} disabled={pending || !importId}>
            {pending ? t('處理中…') : t('重新清理圖片')}
          </Button>
          {!importId ? <span className="text-xs text-muted">{t('原始考卷已刪除，無法重新清理')}</span> : null}
          {error ? <span className="text-xs text-bad">{error}</span> : null}
        </div>
      </div>
    </details>
  )
}
