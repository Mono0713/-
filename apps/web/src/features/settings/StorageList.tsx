'use client'

import { useT } from '@/shared/i18n/client'
import { IconFile, IconTrash } from '@/shared/icons'
import { useRemoval } from '@/shared/removal'
import { deleteImport, deleteOriginals } from '@/features/imports/actions'
import { mb } from './bytes'

export interface StorageRow {
  id: string
  title: string
  bytes: number
  originals: number
}

/**
 * What takes the room, the biggest imports first, each with a trash: the uploaded originals can go
 * on their own (pages stay), or the whole import (questions already saved to the bank stay). Both
 * leave at once with a 復原 note, like every delete.
 */
export function StorageList({ rows }: { rows: StorageRow[] }) {
  const t = useT()
  const { remove, isRemoved } = useRemoval()
  const shown = rows.filter((r) => !isRemoved(r.id))
  if (!shown.length) return null
  return (
    <div className="space-y-1 border-t border-line/70 pt-3">
      <p className="mb-1 text-xs font-medium text-muted">{t('清理空間：從佔最多的開始')}</p>
      <ul>
        {shown.map((r) => (
          <li key={r.id}>
            <Row
              title={r.title}
              note={t('頁面圖與資料')}
              bytes={r.bytes}
              label={t('刪除「{title}」', { title: r.title })}
              onDelete={() => remove({ id: r.id, note: t('已刪除匯入，存進題庫的題目都還在'), commit: () => deleteImport(r.id) })}
            />
            {r.originals > 0 && !isRemoved(`original-${r.id}`) && (
              <Row
                title={r.title}
                note={t('上傳的原檔')}
                bytes={r.originals}
                label={t('刪除「{title}」的原檔', { title: r.title })}
                original
                onDelete={() => remove({ id: `original-${r.id}`, note: t('已刪除原檔，頁面圖仍保留'), commit: () => deleteOriginals(r.id) })}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Row({ title, note, bytes, label, original = false, onDelete }: { title: string; note: string; bytes: number; label: string; original?: boolean; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {original && <IconFile size={14} className="shrink-0 text-muted" />}
        <span className="min-w-0 truncate">{title}</span>
        <span className="shrink-0 text-xs text-muted">{note}</span>
      </span>
      <span className="num shrink-0 text-xs text-muted">{mb(bytes)}</span>
      <button
        type="button"
        onClick={onDelete}
        aria-label={label}
        className="m-press grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-bad-soft hover:text-bad"
      >
        <IconTrash size={15} />
      </button>
    </div>
  )
}
