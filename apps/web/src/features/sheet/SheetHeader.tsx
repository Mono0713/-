'use client'

import type { DraftExam, ExamSheet } from '@exam/core'
import { useT } from '@/shared/i18n/client'
import { Markdown } from '@/shared/Markdown'

/**
 * The top of page one, kept short so the questions start high: school, term and subject on one line,
 * the title, then 班級／座號／姓名 on lines of the same length; the 得分 box in the top-right corner.
 * 作答說明 follows the rule under it.
 */
export function SheetHeader({ meta, sheet }: { meta: DraftExam['meta']; sheet: ExamSheet }) {
  const t = useT()
  const above = [meta.institution, meta.term, meta.subject].filter(Boolean).join('　')
  return (
    <header className="space-y-1.5">
      {/* the score box stands in the top-right corner; the titles keep clear of it and stay centred on the page */}
      <div className="relative space-y-1">
        {sheet.studentFields && (
          <span className="sheet-score absolute bottom-0 right-0 top-0">
            <span className="text-[0.75em] text-ink/70">{t('得分')}</span>
          </span>
        )}
        {above && <p className={`text-center text-[0.85em] leading-snug tracking-wide text-ink/75 ${sheet.studentFields ? 'px-[8.5em]' : ''}`}>{above}</p>}
        <h1 className={`text-center text-[1.45em] font-bold leading-tight tracking-wide ${sheet.studentFields ? 'px-[6em]' : ''}`}>{meta.title || t('未命名考卷')}</h1>
        {sheet.studentFields && (
          <div className="flex flex-wrap items-end gap-x-5 pt-1.5 text-[0.95em]">
            <Field label={t('班級')} />
            <Field label={t('座號')} />
            <Field label={t('姓名')} />
          </div>
        )}
      </div>
      <div className="sheet-rule" />
      {sheet.instructions?.trim() && <Markdown className="text-[0.9em]">{sheet.instructions}</Markdown>}
    </header>
  )
}

function Field({ label }: { label: string }) {
  return (
    <span className="flex items-end gap-1">
      <span className="shrink-0">{label}</span>
      <span className="sheet-blank !w-[7.5em]" />
    </span>
  )
}
