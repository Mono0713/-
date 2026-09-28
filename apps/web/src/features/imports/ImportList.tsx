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
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {imports.map((imp) => (
        <li key={imp.id}>
          <Link href={`/imports/${imp.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-paper">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{imp.title ?? imp.fileName}</p>
              <p className="truncate text-xs text-muted">
                {[imp.subject, imp.title ? imp.fileName : null, `${imp.pageCount} 頁`, imp.questionCount ? `${imp.questionCount} 題在題庫` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <span className="text-xs text-muted">{new Date(imp.createdAt).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}</span>
            <StatusBadge status={imp.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
