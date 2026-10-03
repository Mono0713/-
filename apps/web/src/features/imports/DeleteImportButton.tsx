'use client'

import { useRouter } from 'next/navigation'
import { IconTrash } from '@/shared/icons'
import { menuItem } from '@/shared/chrome/Menu'
import { useRemoval } from '@/shared/removal'
import { Button } from '@/shared/ui'
import { deleteImport } from './actions'

/** `compact` shows only the trash icon, for toolbars; `menu` is a row for a Menu. */
export function DeleteImportButton({ importId, compact = false, menu = false }: { importId: string; compact?: boolean; menu?: boolean }) {
  const router = useRouter()
  const { remove } = useRemoval()
  // Back to the list, where the import is already gone and a note offers 復原. Questions already
  // saved to the bank stay there.
  const discard = () => {
    remove({ id: importId, note: '已刪除匯入，存進題庫的題目都還在', commit: () => deleteImport(importId) })
    router.push('/imports')
  }
  if (menu)
    return (
      <button type="button" role="menuitem" onClick={discard} className={`${menuItem} text-bad hover:bg-bad-soft`}>
        <IconTrash size={15} />
        刪除這次匯入
      </button>
    )
  return (
    <Button
      variant="danger"
      className={compact ? 'px-2' : ''}
      aria-label="刪除匯入"
      title="刪除匯入"
      icon={<IconTrash size={16} />}
      onClick={discard}
    >
      {!compact && '刪除匯入'}
    </Button>
  )
}
