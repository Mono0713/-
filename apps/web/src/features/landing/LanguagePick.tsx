'use client'

import { LOCALES } from '@/shared/i18n/locales'
import { useLocaleSwitch, useT } from '@/shared/i18n/client'
import { Listbox } from '@/shared/Listbox'

/** Interface language, before signing in too (remembered in a cookie). */
export function LanguagePick({ className = 'w-[7.5rem] sm:w-40' }: { className?: string }) {
  const t = useT()
  const { target, switchTo } = useLocaleSwitch()
  return (
    <Listbox
      label={t('介面語言')}
      value={target}
      onChange={switchTo}
      className={className}
      groups={[{ options: LOCALES.map((l) => ({ value: l.id, label: l.label })) }]}
    />
  )
}
