'use client'

import type { StudentException } from '@exam/classes'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Menu } from '@/shared/chrome/Menu'
import { useT } from '@/shared/i18n/client'
import { Button, inputBase } from '@/shared/ui'
import { setException } from './teaching'

/** An ISO moment as a `datetime-local` value in the browser's time zone. */
function toLocal(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/** One student's own deadline, extra tries and extra minutes: for a make-up or an extension. */
export function ExceptionEditor({ assignmentId, userId, name, value, timed }: { assignmentId: string; userId: string; name: string; value: StudentException | null; timed: boolean }) {
  const t = useT()
  const router = useRouter()
  const [closesAt, setClosesAt] = useState(toLocal(value?.closesAt))
  const [attempts, setAttempts] = useState(value?.extraAttempts ? String(value.extraAttempts) : '')
  const [minutes, setMinutes] = useState(value?.extraMinutes ? String(value.extraMinutes) : '')
  const [pending, start] = useTransition()
  const save = (next: StudentException | null, close: () => void) =>
    start(async () => {
      await setException(assignmentId, userId, next)
      close()
      router.refresh()
    })
  const label = 'mb-1 block text-xs font-medium text-muted'

  return (
    <Menu
      label={t('{name} 的延長或補考', { name })}
      align="right"
      width="w-72"
      className={`rounded-md px-1.5 py-0.5 text-xs ${value ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-accent-soft hover:text-accent'}`}
      button={value ? t('已延長') : t('延長')}
    >
      {(close) => (
        <div className="space-y-3 p-3 text-sm">
          <p className="font-medium">{t('{name} 的延長或補考', { name })}</p>
          <label className="block">
            <span className={label}>{t('個人截止時間')}</span>
            <input autoComplete="off" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={`${inputBase} w-full`} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={label}>{t('多給次數')}</span>
              <input autoComplete="off" type="number" min={1} value={attempts} onChange={(e) => setAttempts(e.target.value)} placeholder="0" className={`${inputBase} w-full`} />
            </label>
            {timed && (
              <label className="block">
                <span className={label}>{t('多給分鐘')}</span>
                <input autoComplete="off" type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="0" className={`${inputBase} w-full`} />
              </label>
            )}
          </div>
          <p className="text-xs text-muted">{t('補考：給一個新的截止時間，再多給 1 次。')}</p>
          <div className="flex justify-between gap-2">
            {value ? (
              <Button variant="ghost" disabled={pending} onClick={() => save(null, close)}>
                {t('取消延長')}
              </Button>
            ) : (
              <span />
            )}
            <Button
              variant="primary"
              loading={pending}
              disabled={pending}
              onClick={() =>
                save({ ...(closesAt && { closesAt: new Date(closesAt).toISOString() }), ...(attempts && { extraAttempts: Number(attempts) }), ...(minutes && { extraMinutes: Number(minutes) }) }, close)
              }
            >
              {t('儲存')}
            </Button>
          </div>
        </div>
      )}
    </Menu>
  )
}
