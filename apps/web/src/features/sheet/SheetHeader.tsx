'use client'

import type { DraftExam, ExamSheet } from '@exam/core'
import { useT } from '@/shared/i18n/client'
import { Markdown } from '@/shared/Markdown'

/** The top of page one: school and term, the title, subject, the 班級／座號／姓名 lines and a score box, then 作答說明. */
export function SheetHeader({ meta, sheet }: { meta: DraftExam['meta']; sheet: ExamSheet }) {
  const t = useT()
  const above = [meta.institution, meta.term].filter(Boolean).join('　')
  return (
    <header className="space-y-2.5">
      {above && <p className="text-center text-[0.9em] tracking-wide text-ink/75">{above}</p>}
      <h1 className="text-center text-[1.6em] font-bold leading-tight tracking-wide">{meta.title || t('未命名考卷')}</h1>
      {meta.subject && <p className="text-center text-[0.95em] text-ink/75">{meta.subject}</p>}
      {sheet.studentFields && (
        <div className="flex items-end gap-4 pt-2 text-[0.95em]">
          <Field label={t('班級')} />
          <Field label={t('座號')} narrow />
          <Field label={t('姓名')} wide />
          <span className="sheet-score">
            <span className="text-[0.75em] text-ink/70">{t('得分')}</span>
          </span>
        </div>
      )}
      <div className="sheet-rule" />
      {sheet.instructions?.trim() && <Markdown className="text-[0.9em]">{sheet.instructions}</Markdown>}
    </header>
  )
}

function Field({ label, narrow = false, wide = false }: { label: string; narrow?: boolean; wide?: boolean }) {
  return (
    <span className={`flex items-end gap-1 ${wide ? 'flex-[2]' : narrow ? 'flex-[0.7]' : 'flex-1'}`}>
      <span className="shrink-0">{label}</span>
      <span className="sheet-blank !w-auto flex-1" />
    </span>
  )
}
