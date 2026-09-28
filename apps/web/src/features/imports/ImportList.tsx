import type { ImportRecord } from '@exam/bank'
import Link from 'next/link'
import { STATUS_LABELS } from '@/shared/labels'
import { Badge, EmptyState } from '@/shared/ui'

const TONES = { processing: 'accent', waiting: 'warn', review: 'warn', saved: 'good', failed: 'bad' } as const

export function StatusBadge({ status }: { status: ImportRecord['status'] }) {
  return <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>
}

export function ImportList({ imports }: { imports: ImportRecord[] }) {
  if (!imports.length) return <EmptyState title="還沒有匯入任何考卷">上傳第一份考卷後會出現在這裡。</EmptyState>
  return (
    <ul className="m-stagger divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-sheet">
      {imports.map((imp) => (
        <li key={imp.id}>
          <Link href={`/imports/${imp.id}`} className="flex items-center gap-x-4 px-4 py-3 transition-colors hover:bg-paper">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-medium sm:truncate">{imp.title ?? imp.fileName}</p>
              <p className="truncate text-xs text-muted">
                {[imp.subject, imp.title ? imp.fileName : null, `${imp.pageCount} 頁`, imp.questionCount ? `${imp.questionCount} 題在題庫` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="text-xs text-muted sm:hidden">{new Date(imp.createdAt).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}</p>
            </div>
            <span className="hidden text-xs text-muted sm:inline">{new Date(imp.createdAt).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}</span>
            <span className="shrink-0">
              <StatusBadge status={imp.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
