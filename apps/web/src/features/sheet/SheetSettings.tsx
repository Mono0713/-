'use client'

import type { ExamSheet } from '@exam/core'
import { useT } from '@/shared/i18n/client'
import { inputClass } from '@/shared/ui'

/** The printed paper's own settings, beside the exam details: the 班級／座號／姓名 lines and 作答說明. */
export function SheetSettings({ sheet, onChange, compact }: { sheet: ExamSheet; onChange: (patch: Partial<ExamSheet>, typing?: string) => void; compact: boolean }) {
  const t = useT()
  return (
    <div className={`space-y-3 ${compact ? '' : 'sm:col-span-2'}`}>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="m-check" checked={sheet.studentFields} onChange={(e) => onChange({ studentFields: e.target.checked })} />
        {t('印出班級、座號、姓名和得分欄')}
      </label>
      <label className="block text-sm">
        <span className={`block font-medium text-muted ${compact ? 'mb-0.5 text-[11px]' : 'mb-1 text-xs'}`}>{t('作答說明')}</span>
        <textarea
          autoComplete="off"
          rows={compact ? 2 : 3}
          value={sheet.instructions ?? ''}
          placeholder={t('例如：本卷共兩頁，選擇題請將答案填入括號內。')}
          onChange={(e) => onChange({ instructions: e.target.value.trim() ? e.target.value : null }, 'instructions')}
          className={`${inputClass} resize-y ${compact ? 'py-1.5 text-[13px]' : ''}`}
        />
      </label>
    </div>
  )
}
