'use client'

import { useT } from '@/shared/i18n/client'
import { IconFold } from '@/shared/icons'
import { toggleRail } from './rail'

/**
 * Folds the sidebar into a rail of icons and back; the choice is kept in this browser.
 * Beside the account when open, above it in the rail; it glides between the two as the sidebar folds.
 */
export function RailToggle() {
  const t = useT()
  return (
    <div className="absolute left-[196px] top-4 transition-[left,top] duration-200 ease-out rail:left-5 rail:top-3">
      <button
        type="button"
        onClick={toggleRail}
        className="m-press grid h-8 w-8 place-items-center rounded-md text-white/45 hover:bg-white/[0.06] hover:text-white"
        title={t('收合側欄')}
        aria-label={t('收合側欄')}
      >
        {/* the arrows turn round to point the other way */}
        <IconFold size={17} className="transition-transform duration-200 rail:rotate-180" />
      </button>
    </div>
  )
}
