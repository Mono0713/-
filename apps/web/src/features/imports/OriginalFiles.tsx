'use client'

import { useState, useTransition } from 'react'
import { menuItem } from '@/shared/chrome/Menu'
import { IconFile } from '@/shared/icons'
import { keepOriginal } from './actions'

export interface OriginalState {
  /** Names of the uploaded files still kept; empty once deleted. */
  files: string[]
  keep: boolean
  /** When the files go, once the import is in the bank and not kept. */
  expiresAt: string | null
  deletedAt: string | null
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })

/**
 * Menu rows for the uploaded files: download them, and keep them past the 30 days after
 * saving to the bank. Page images stay either way.
 */
export function OriginalFiles({ importId, state }: { importId: string; state: OriginalState }) {
  const [keep, setKeep] = useState(state.keep)
  const [, start] = useTransition()
  if (!state.files.length)
    return <p className="px-2.5 py-2 text-xs text-muted">{state.deletedAt ? `原檔已在 ${day(state.deletedAt)} 刪除，頁面圖仍保留，可以照常校對和重讀。` : '原檔已不在。'}</p>
  const note = keep ? '原檔會一直保留。' : state.expiresAt ? `原檔會在 ${day(state.expiresAt)} 自動刪除，頁面圖會一直保留。` : '存入題庫 30 天後自動刪除原檔，頁面圖會一直保留。'
  return (
    <>
      {state.files.map((name, i) => (
        <a key={i} href={`/imports/${importId}/original/${i + 1}`} download role="menuitem" className={menuItem}>
          <IconFile size={15} className="shrink-0 text-muted" />
          <span className="min-w-0 flex-1 truncate">下載原檔 {name}</span>
        </a>
      ))}
      <label className={`${menuItem} cursor-pointer`}>
        <input
          type="checkbox"
          className="m-check"
          checked={keep}
          onChange={(e) => {
            const next = e.target.checked
            setKeep(next)
            start(() => keepOriginal(importId, next))
          }}
        />
        <span className="flex-1">永久保留原檔</span>
      </label>
      <p className="px-2.5 pb-1.5 text-xs text-muted">{note}</p>
    </>
  )
}
