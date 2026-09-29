'use client'

import { useTransition } from 'react'
import { IconTrash } from '@/shared/icons'
import { menuItem } from '@/shared/chrome/Menu'
import { Button } from '@/shared/ui'
import { deleteImport } from './actions'

/** `compact` shows only the trash icon, for toolbars; `menu` is a row for a Menu. */
export function DeleteImportButton({ importId, compact = false, menu = false }: { importId: string; compact?: boolean; menu?: boolean }) {
  const [pending, start] = useTransition()
  const ask = () => confirm('刪除這次匯入的檔案和草稿？已存入題庫的題目會保留。') && start(() => deleteImport(importId))
  if (menu)
    return (
      <button type="button" role="menuitem" disabled={pending} onClick={ask} className={`${menuItem} text-bad hover:bg-bad-soft`}>
        <IconTrash size={15} />
        刪除這次匯入
      </button>
    )
  return (
    <Button
      variant="danger"
      disabled={pending}
      className={compact ? 'px-2' : ''}
      aria-label="刪除匯入"
      title="刪除匯入"
      icon={<IconTrash size={16} />}
      onClick={ask}
    >
      {!compact && '刪除匯入'}
    </Button>
  )
}
