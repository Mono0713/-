'use client'

import { useRouter } from 'next/navigation'
import { IconTrash } from '@/shared/icons'
import { menuItem } from '@/shared/chrome/Menu'
import { useT } from '@/shared/i18n/client'
import { useRemoval } from '@/shared/removal'
import { Button } from '@/shared/ui'
import { deleteImport } from './actions'

/**
 * `compact` shows only the trash icon, for toolbars; `menu` is a row for a Menu. `saved`: the import is
 * an exam in the bank, so only its files go (uploads, page images) and the exam stays editable here.
 */
export function DeleteImportButton({ importId, compact = false, menu = false, saved = false }: { importId: string; compact?: boolean; menu?: boolean; saved?: boolean }) {
  const t = useT()
  const router = useRouter()
  const { remove } = useRemoval()
  // Back to the list, where the import is already gone and a note offers 復原. Questions already
  // saved to the bank stay there.
  const discard = () => {
    if (saved) {
      remove({
        id: `files-${importId}`,
        note: t('已刪除原卷檔案，題目還能繼續編輯'),
        commit: async () => {
          await deleteImport(importId)
          router.refresh()
        },
      })
      return
    }
    remove({ id: importId, note: t('已刪除匯入，存進題庫的題目都還在'), commit: () => deleteImport(importId) })
    router.push('/imports')
  }
  if (menu)
    return (
      <button type="button" role="menuitem" onClick={discard} className={`${menuItem} text-bad hover:bg-bad-soft`}>
        <IconTrash size={15} />
        {saved ? t('刪除原卷檔案') : t('刪除這次匯入')}
      </button>
    )
  return (
    <Button
      variant="danger"
      className={compact ? 'px-2' : ''}
      aria-label={t('刪除匯入')}
      title={t('刪除匯入')}
      icon={<IconTrash size={16} />}
      onClick={discard}
    >
      {!compact && t('刪除匯入')}
    </Button>
  )
}
