'use client'

import { useEffect, useState } from 'react'
import { Segmented } from '@/shared/Segmented'
import { applyTheme, readTheme, type ThemeChoice } from './theme'

const OPTIONS = [
  ['system', '跟隨裝置'],
  ['light', '淺色'],
  ['dark', '深色'],
] as const

/** Light / dark / follow-the-device switch; applies at once and is remembered in this browser. */
export function ThemePicker() {
  const [choice, setChoice] = useState<ThemeChoice>('system')
  useEffect(() => setChoice(readTheme()), [])
  return (
    <Segmented
      value={choice}
      options={OPTIONS}
      onChange={(next) => {
        setChoice(next)
        applyTheme(next)
      }}
    />
  )
}
