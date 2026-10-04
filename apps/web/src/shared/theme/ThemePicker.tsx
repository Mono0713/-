'use client'

import { useLayoutEffect, useState } from 'react'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { Segmented } from '@/shared/Segmented'
import { applyTheme, readTheme, type ThemeChoice } from './theme'

const OPTIONS = [
  ['system', msg('跟隨裝置')],
  ['light', msg('淺色')],
  ['dark', msg('深色')],
] as const

/** Light / dark / follow-the-device switch; applies at once and is remembered in this browser. */
export function ThemePicker() {
  const t = useT()
  // nothing is marked until the saved choice is read (before the first paint), so no tab is
  // highlighted first and then left behind
  const [choice, setChoice] = useState<ThemeChoice | null>(null)
  useLayoutEffect(() => setChoice(readTheme()), [])
  return (
    <Segmented<ThemeChoice | ''>
      value={choice ?? ''}
      options={OPTIONS.map(([value, label]) => [value, t(label)] as const)}
      onChange={(next) => {
        if (!next) return
        setChoice(next)
        applyTheme(next)
      }}
    />
  )
}
