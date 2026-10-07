'use client'

import type { Strength, Task } from '@exam/models'
import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { saveStrength } from '@/features/settings/actions'
import type { StrengthModels } from '@/server/ai'
import { STRENGTH_HINTS, STRENGTH_LABELS } from '@/features/settings/strengths'
import { useT } from '@/shared/i18n/client'
import { msg } from '@/shared/i18n/format'
import { IconX } from '@/shared/icons'
import { Segmented } from '@/shared/Segmented'

/**
 * The AI strength, set from the editor's floating button without leaving the page. It is the same
 * setting as on the settings page and applies to every AI task from the next one on (re-reading
 * pages, reading handwriting, grading). Below the switch, the model each editor task runs on at the
 * chosen strength. Opens above the floating button; Escape or a click outside closes it.
 */
/** The editor's AI tasks listed under the switch, with their names (translated where shown). */
const SHOWN: [Task, string][] = [
  ['recognition', msg('辨識考卷')],
  ['solving', msg('AI 作答')],
  ['explaining', msg('AI 詳解')],
]

export function StrengthPanel({ open, initial, models, onChange, onClose }: { open: boolean; initial: Strength; models?: StrengthModels; onChange: (strength: Strength) => void; onClose: () => void }) {
  const t = useT()
  const options = useMemo(() => STRENGTH_LABELS.map(([v, label]) => [v, t(label)] as const), [t])
  const [strength, setStrength] = useState(initial)
  const [saving, start] = useTransition()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={t('AI 強度')}
        className="m-scale-in fixed bottom-24 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] origin-bottom-right rounded-2xl bg-surface p-4 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.45),0_0_0_1px_var(--color-line)] sm:right-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium">{t('AI 強度')}</p>
          <button type="button" onClick={onClose} className="m-press grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-ink/[0.06]" aria-label={t('關閉')}>
            <IconX size={15} />
          </button>
        </div>
        <Segmented
          value={strength}
          options={options}
          onChange={(next) => {
            setStrength(next)
            onChange(next)
            start(() => saveStrength(next))
          }}
        />
        <p className="mt-2 text-sm text-muted">{t(STRENGTH_HINTS[strength])}</p>
        {models && (
          <dl className="mt-3 space-y-1 rounded-xl bg-ink/[0.035] px-3 py-2 text-xs">
            {SHOWN.map(([task, label]) => (
              <div key={task} className="flex items-center justify-between gap-3">
                <dt className="text-muted">{t(label)}</dt>
                <dd className={`num truncate font-medium ${models[strength][task] ? 'text-ink' : 'text-muted'}`}>{models[strength][task] ?? t('還沒有 API 金鑰')}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
          <span>{saving ? t('儲存中…') : t('自動選模型時，辨識、讀手寫和批改都照這個強度。')}</span>
          <Link href="/settings#ai" className="shrink-0 text-accent hover:underline">
            {t('進階設定')}
          </Link>
        </p>
      </div>
    </>
  )
}
