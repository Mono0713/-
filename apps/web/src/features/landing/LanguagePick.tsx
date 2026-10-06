'use client'

import { IconLanguages } from '@/shared/icons'
import { LOCALES } from '@/shared/i18n/locales'
import { useLocaleSwitch, useT } from '@/shared/i18n/client'
import { Listbox } from '@/shared/Listbox'

/** Interface language, before signing in too (remembered in a cookie). Sized to the language's name. */
export function LanguagePick({ className = '' }: { className?: string }) {
  const t = useT()
  const { target, switchTo } = useLocaleSwitch()
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <IconLanguages size={15} className="shrink-0" aria-hidden />
      <Listbox label={t('介面語言')} value={target} onChange={switchTo} groups={[{ options: LOCALES.map((l) => ({ value: l.id, label: l.label })) }]} />
    </span>
  )
}
