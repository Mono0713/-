'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/shared/i18n/client'
import { applyCalm, readCalm } from './preference'

/** The "做題時減少動畫" switch: applies at once and is remembered in this browser. */
export function CalmSwitch() {
  const t = useT()
  const [calm, setCalm] = useState(false)
  useEffect(() => setCalm(readCalm()), [])
  return (
    <button
      type="button"
      role="switch"
      aria-checked={calm}
      aria-label={t('做題時減少動畫')}
      onClick={() => {
        setCalm(!calm)
        applyCalm(!calm)
      }}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${calm ? 'bg-accent' : 'bg-ink/15'}`}
    >
      <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 [transition-timing-function:var(--m-spring)] ${calm ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
    </button>
  )
}
