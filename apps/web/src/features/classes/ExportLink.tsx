'use client'

import { useT } from '@/shared/i18n/client'
import { IconDownload } from '@/shared/icons'

/** Downloads the grades as CSV, with hand-in times in this browser's time zone. */
export function ExportLink({ classId, assignmentId, label }: { classId: string; assignmentId?: string; label: string }) {
  const t = useT()
  const href = () => `/api/classes/${classId}/export?${new URLSearchParams({ ...(assignmentId && { a: assignmentId }), tz: Intl.DateTimeFormat().resolvedOptions().timeZone })}`
  return (
    <a
      href={`/api/classes/${classId}/export${assignmentId ? `?a=${assignmentId}` : ''}`}
      onClick={(e) => {
        e.currentTarget.href = href()
      }}
      download
      className="m-press inline-flex items-center gap-2 text-sm text-accent hover:underline"
      title={t('Excel、Google 試算表都打得開')}
    >
      <IconDownload size={16} />
      {label}
    </a>
  )
}
