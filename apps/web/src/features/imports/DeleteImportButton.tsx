'use client'

import { useTransition } from 'react'
import { IconTrash } from '@/shared/icons'
import { Button } from '@/shared/ui'
import { deleteImport } from './actions'

/** `compact` shows only the trash icon, for toolbars. */
export function DeleteImportButton({ importId, compact = false }: { importId: string; compact?: boolean }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="danger"
      disabled={pending}
      className={compact ? 'px-2' : ''}
      aria-label="刪除匯入"
      title="刪除匯入"
      icon={<IconTrash size={16} />}
      onClick={() => confirm('刪除這次匯入的檔案和草稿？已存入題庫的題目會保留。') && start(() => deleteImport(importId))}
    >
      {!compact && '刪除匯入'}
    </Button>
  )
}
