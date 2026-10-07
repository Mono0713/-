'use client'

import { useState } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconChevronDown, IconTrash } from '@/shared/icons'
import { useRemoval } from '@/shared/removal'
import { deleteImport, deleteOriginals } from '@/features/imports/actions'
import { mb } from './bytes'

export interface StorageRow {
  id: string
  title: string
  bytes: number
  originals: number
}

/** Rows shown before 顯示全部, so a long history never makes the card long. */
const FIRST = 5

/**
 * What takes the room, one line per import, the biggest first: its size, 刪原檔 when its uploaded
 * originals are still kept (pages stay), and a trash for the whole import (questions already saved to
 * the bank stay). Only the first few show until 顯示全部, and then the list scrolls inside the card.
 * Both deletes leave at once with a 復原 note, like every delete.
 */
export function StorageList({ rows }: { rows: StorageRow[] }) {
  const t = useT()
  const { remove, isRemoved } = useRemoval()
  const [all, setAll] = useState(false)
  const shown = rows.filter((r) => !isRemoved(r.id))
  if (!shown.length) return null
  const visible = all ? shown : shown.slice(0, FIRST)
  return (
    <div className="border-t border-line/70 pt-3">
      <p className="mb-1 text-xs font-medium text-muted">{t('清理空間：從佔最多的開始')}</p>
      <ul className={all ? 'max-h-80 overflow-y-auto pr-1' : undefined}>
        {visible.map((r) => {
          const originals = isRemoved(`original-${r.id}`) ? 0 : r.originals
          return (
            <li key={r.id} className="flex items-center gap-2 py-0.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{r.title}</span>
              {originals > 0 && (
                <button
                  type="button"
                  onClick={() => remove({ id: `original-${r.id}`, note: t('已刪除原檔，頁面圖仍保留'), commit: () => deleteOriginals(r.id) })}
                  aria-label={t('刪除「{title}」的原檔', { title: r.title })}
                  className="m-press shrink-0 rounded-md px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-bad-soft hover:text-bad"
                >
                  {t('刪原檔 {size}', { size: mb(originals) })}
                </button>
              )}
              <span className="num w-16 shrink-0 text-right text-xs text-muted">{mb(r.bytes + originals)}</span>
              <button
                type="button"
                onClick={() => remove({ id: r.id, note: t('已刪除匯入，存進題庫的題目都還在'), commit: () => deleteImport(r.id) })}
                aria-label={t('刪除「{title}」', { title: r.title })}
                className="m-press grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-bad-soft hover:text-bad"
              >
                <IconTrash size={15} />
              </button>
            </li>
          )
        })}
      </ul>
      {shown.length > FIRST && (
        <button type="button" onClick={() => setAll((a) => !a)} className="m-press mt-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-xs text-muted hover:text-ink">
          {all ? t('收起') : t('顯示全部 {n} 筆', { n: shown.length })}
          <IconChevronDown size={13} className={all ? 'rotate-180' : undefined} />
        </button>
      )}
    </div>
  )
}
