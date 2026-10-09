'use client'

import dynamic from 'next/dynamic'
import { useState, type ReactNode } from 'react'
import { IconPlay } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import type { TryItem } from '../try/TryQuestion'

const load = () => import('./Tour').then((m) => m.Tour)
// the tour's code is fetched only when someone is about to open it
const Tour = dynamic(load, { ssr: false })

/** The hero's 看介紹影片: opens the product tour full screen. */
export function TourButton({ item, cta }: { item: TryItem; cta: ReactNode }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} onPointerEnter={load} onFocus={load} className="m-press group inline-flex items-center gap-2.5 text-sm font-medium">
        <span className="grid size-10 place-items-center rounded-full bg-surface text-accent shadow-sheet transition-transform group-hover:scale-105">
          <IconPlay size={15} aria-hidden fill="currentColor" className="translate-x-px" />
        </span>
        {t('看介紹影片')}
      </button>
      {open && <Tour item={item} cta={cta} onClose={() => setOpen(false)} />}
    </>
  )
}
