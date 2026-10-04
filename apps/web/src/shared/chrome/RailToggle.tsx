'use client'

import { useT } from '@/shared/i18n/client'
import { IconCollapse, IconExpand } from '@/shared/icons'
import { toggleRail } from './rail'

/** Folds the sidebar into a rail of icons and back; the choice is kept in this browser. */
export function RailToggle() {
  const t = useT()
  return (
    <button
      type="button"
      onClick={toggleRail}
      className="m-press grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/45 hover:bg-white/[0.06] hover:text-white"
      title={t('收合側欄')}
      aria-label={t('收合側欄')}
    >
      <IconCollapse size={17} className="rail:hidden" />
      <IconExpand size={17} className="hidden rail:block" />
    </button>
  )
}
