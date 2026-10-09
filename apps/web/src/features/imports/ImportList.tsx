import type { ImportRecord } from '@exam/bank'
import { BLANK, WRITTEN } from '@exam/importer'
import Link from 'next/link'
import { intlTag } from '@/shared/i18n/locales'
import { getLocale, getT } from '@/shared/i18n/server'
import { STATUS_LABELS } from '@/shared/labels'
import { Removable } from '@/shared/removal'
import { Badge, EmptyState } from '@/shared/ui'

const TONES = { processing: 'accent', waiting: 'warn', review: 'warn', saved: 'good', failed: 'bad' } as const

/** `provider`: an exam the AI is writing reads 出題中 rather than 辨識中. */
export async function StatusBadge({ status, provider }: { status: ImportRecord['status']; provider?: string }) {
  const t = await getT()
  return <Badge tone={TONES[status]}>{status === 'processing' && provider === WRITTEN ? t('出題中') : t(STATUS_LABELS[status])}</Badge>
}

export async function ImportList({ imports }: { imports: ImportRecord[] }) {
  const [t, locale] = await Promise.all([getT(), getLocale()])
  if (!imports.length) return <EmptyState title={t('還沒有匯入任何考卷')}>{t('上傳第一份考卷後會出現在這裡。')}</EmptyState>
  return (
    <ul className="m-stagger divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-sheet">
      {imports.map((imp) => (
        <Removable key={imp.id} id={imp.id}>
          <li>
            <Link href={`/imports/${imp.id}`} className="flex items-center gap-x-4 px-4 py-3 transition-colors hover:bg-paper">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium sm:truncate">{imp.title ?? imp.fileName}</p>
                <p className="truncate text-xs text-muted">
                  {[imp.subject, imp.provider === BLANK ? t('從零建立') : imp.provider === WRITTEN ? t('AI 出題') : imp.title ? imp.fileName : null, imp.provider === BLANK || imp.provider === WRITTEN ? null : t('{n} 頁', { n: imp.pageCount }), imp.questionCount ? t('{n} 題在題庫', { n: imp.questionCount }) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="text-xs text-muted sm:hidden">{new Date(imp.createdAt).toLocaleString(intlTag(locale), { dateStyle: 'short', timeStyle: 'short' })}</p>
              </div>
              <span className="hidden text-xs text-muted sm:inline">{new Date(imp.createdAt).toLocaleString(intlTag(locale), { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span className="shrink-0">
                <StatusBadge status={imp.status} provider={imp.provider} />
              </span>
            </Link>
          </li>
        </Removable>
      ))}
    </ul>
  )
}
