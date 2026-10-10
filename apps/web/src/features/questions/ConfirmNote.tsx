'use client'

import { useState, type ReactNode } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconCheck } from '@/shared/icons'

/**
 * "Please check" note whose button clears it. On confirm the note's highlight is erased
 * right to left and the note folds away (motion.css .m-fold) before `onConfirm` removes it for good.
 * The card's flag bar fades out alongside it (it watches for [data-erasing] in the card).
 */
export function ConfirmNote({ children, onConfirm }: { children: ReactNode; onConfirm?: () => void }) {
  const t = useT()
  const [erasing, setErasing] = useState(false)
  const confirm = () => {
    if (!onConfirm || erasing) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return onConfirm()
    setErasing(true)
    setTimeout(onConfirm, 540)
  }
  return (
    <div data-erasing={erasing || undefined} className="m-fold">
      <div data-erasing={erasing || undefined} className="m-erase flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl px-3 py-2.5 text-sm">
        {children}
        {onConfirm && (
          <button
            type="button"
            onClick={confirm}
            className="m-press ml-auto flex h-8 shrink-0 items-center gap-1 rounded-lg bg-surface px-2.5 text-xs font-medium text-good shadow-sheet hover:bg-good-soft"
            title={t('內容沒問題：移除這個提示')}
          >
            {erasing ? (
              <svg aria-hidden width="14" height="14" viewBox="0 0 24 24">
                <path className="m-pen" pathLength={1} d="M4 13 L10 18.5 L20 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <IconCheck size={14} strokeWidth={2.6} />
            )}
            {t('沒問題')}
          </button>
        )}
      </div>
    </div>
  )
}
