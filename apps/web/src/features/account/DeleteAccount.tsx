'use client'

import { useState } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconTrash } from '@/shared/icons'
import { useRemoval } from '@/shared/removal'
import { deleteMyAccount } from './actions'

/** Deleting the account follows the rest of the app: no question first, 5 seconds of 復原, then it is gone. */
export function DeleteAccount() {
  const t = useT()
  const { remove, isRemoved } = useRemoval()
  const [busy, setBusy] = useState(false)
  if (busy || isRemoved('account')) return <span className="px-3 py-2 text-sm text-bad">{busy ? t('刪除中…') : t('即將刪除')}</span>
  return (
    <button
      type="button"
      onClick={() =>
        remove({
          id: 'account',
          note: t('帳號即將刪除'),
          commit: async () => {
            setBusy(true)
            await deleteMyAccount()
          },
        })
      }
      aria-label={t('刪除帳號')}
      title={t('刪除帳號')}
      className="m-press grid size-9 place-items-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad"
    >
      <IconTrash size={16} />
    </button>
  )
}
