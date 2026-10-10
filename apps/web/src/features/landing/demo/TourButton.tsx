'use client'

import dynamic from 'next/dynamic'
import { useState, type ReactNode } from 'react'
import { IconPlay } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import type { PracticeItem } from './practice'

const load = () => import('./Tour').then((m) => m.Tour)
// the tour's code is fetched only when someone is about to open it
const Tour = dynamic(load, { ssr: false })

/** The hero's 看介紹影片: opens the product tour full screen, on the sample exam the pile is showing. */
export function TourButton({ practice, cta }: { practice: Record<string, PracticeItem>; cta: ReactNode }) {
  const t = useT()
  const [open, setOpen] = useState<string | null>(null)
  const start = () => setOpen(document.querySelector<HTMLElement>('[data-sample]')?.dataset.sample ?? '')
  return (
    <>
      <button type="button" onClick={start} onPointerEnter={load} onFocus={load} className="m-press group inline-flex items-center gap-2.5 text-sm font-medium">
        <span className="grid size-10 place-items-center rounded-full bg-surface text-accent shadow-sheet transition-transform group-hover:scale-105">
          <IconPlay size={15} aria-hidden fill="currentColor" className="translate-x-px" />
        </span>
        {t('看介紹影片')}
      </button>
      {open !== null && <Tour sampleId={open} practice={practice} cta={cta} onClose={() => setOpen(null)} />}
    </>
  )
}
