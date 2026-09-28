import { TYPE_LABELS } from '@/shared/labels'
import { Button, inputBase } from '@/shared/ui'

/** Plain GET form so filters live in the URL and work without JavaScript. */
export function BankFilters({ subjects, values }: { subjects: string[]; values: { q?: string; type?: string; subject?: string; import?: string } }) {
  return (
    <form className="mb-6 flex flex-wrap gap-2" action="/bank">
      <input name="q" defaultValue={values.q} placeholder="搜尋題目、選項或答案" className={`${inputBase} min-w-56 flex-1`} />
      <select name="type" defaultValue={values.type ?? ''} className={inputBase} aria-label="題型">
        <option value="">所有題型</option>
        {Object.entries(TYPE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <select name="subject" defaultValue={values.subject ?? ''} className={inputBase} aria-label="科目">
        <option value="">所有科目</option>
        {subjects.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {values.import && <input type="hidden" name="import" value={values.import} />}
      <Button type="submit">篩選</Button>
    </form>
  )
}
