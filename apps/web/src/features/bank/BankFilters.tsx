import { Button, inputBase } from '@/shared/ui'

/** Plain GET form so filters live in the URL and work without JavaScript. */
export function BankFilters({ subjects, values }: { subjects: string[]; values: { q?: string; subject?: string } }) {
  return (
    <form className="mb-6 flex flex-wrap gap-2" action="/bank">
      <input autoComplete="off" name="q" defaultValue={values.q} placeholder="搜尋考卷名稱或題目內容" className={`${inputBase} min-w-56 flex-1`} />
      <select name="subject" defaultValue={values.subject ?? ''} className={inputBase} aria-label="科目">
        <option value="">所有科目</option>
        {subjects.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <Button type="submit">搜尋</Button>
    </form>
  )
}
