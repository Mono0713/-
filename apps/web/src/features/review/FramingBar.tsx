'use client'

import { useEffect } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconCheck } from '@/shared/icons'

/**
 * Floats over the top of the page viewer while a picture is framed: what to do, 取消 and 套用.
 * Enter applies and Escape cancels, unless typing somewhere.
 */
export function FramingBar({ onApply, onCancel }: { onApply: () => void; onCancel: () => void }) {
  const t = useT()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"], [contenteditable=""], math-field')) return
      if (e.key === 'Escape') onCancel()
      else if (e.key === 'Enter') onApply()
      else return
      e.preventDefault()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onApply, onCancel])
  return (
    // no height of its own, so the pages do not move when it shows
    <div className="pointer-events-none sticky top-3 z-20 h-0">
      <div className="m-enter flex justify-center px-3">
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-night/90 py-1 pl-4 pr-1 text-xs text-white shadow-[0_10px_30px_-12px_rgb(22_24_43/0.6)] backdrop-blur-md">
          <span className="min-w-0 truncate">{t('拖曳框線調整圖片範圍，或在頁面上重畫一個框。')}</span>
          <button type="button" onClick={onCancel} className="m-press h-8 shrink-0 rounded-full px-3 hover:bg-white/15">
            {t('取消')}
          </button>
          <button type="button" onClick={onApply} className="m-press flex h-8 shrink-0 items-center gap-1 rounded-full bg-accent pl-2.5 pr-3.5 font-medium text-on-accent">
            <IconCheck size={14} strokeWidth={2.6} />
            {t('套用')}
          </button>
        </div>
      </div>
    </div>
  )
}
