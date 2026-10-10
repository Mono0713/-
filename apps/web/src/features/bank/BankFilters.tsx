import { getT } from '@/shared/i18n/server'
import { Button, inputBase } from '@/shared/ui'

/** Plain GET form so filters live in the URL and work without JavaScript. */
export async function BankFilters({ subjects, values }: { subjects: string[]; values: { q?: string; subject?: string } }) {
  const t = await getT()
  return (
    <form className="mb-6 flex flex-wrap gap-2" action="/bank">
      <input autoComplete="off" name="q" defaultValue={values.q} placeholder={t('搜尋考卷名稱或題目內容')} className={`${inputBase} min-w-56 flex-1`} />
      <select name="subject" defaultValue={values.subject ?? ''} className={inputBase} aria-label={t('科目')}>
        <option value="">{t('所有科目')}</option>
        {subjects.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <Button type="submit">{t('搜尋')}</Button>
    </form>
  )
}
