'use client'

import { useLayoutEffect, useState } from 'react'
import { Segmented } from '@/shared/Segmented'
import { applyTheme, readTheme, type ThemeChoice } from './theme'

const OPTIONS = [
  ['system', '跟隨裝置'],
  ['light', '淺色'],
  ['dark', '深色'],
] as const

/** Light / dark / follow-the-device switch; applies at once and is remembered in this browser. */
export function ThemePicker() {
  // nothing is marked until the saved choice is read (before the first paint), so no tab is
  // highlighted first and then left behind
  const [choice, setChoice] = useState<ThemeChoice | null>(null)
  useLayoutEffect(() => setChoice(readTheme()), [])
  return (
    <Segmented<ThemeChoice | ''>
      value={choice ?? ''}
      options={OPTIONS}
      onChange={(next) => {
        if (!next) return
        setChoice(next)
        applyTheme(next)
      }}
    />
  )
}
