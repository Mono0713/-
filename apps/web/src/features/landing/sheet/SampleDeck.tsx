'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { IconShuffle } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { pickUnseen, SEEN_COOKIE, withSeen } from '../samples/seen'

const cookie = () => document.cookie.match(new RegExp(`(?:^|; )${SEEN_COOKIE}=([^;]*)`))?.[1]

/**
 * The hero's pile of sample exams. Every sheet stays in the same grid cell (the ones not shown are
 * invisible), so the pile is as tall as the tallest sheet and nothing moves when another one comes up.
 * 換一張 slides the sheet off and the next one in, which plays its scan again (a fresh key).
 */
export function SampleDeck({ ids, sheets, notes, captions, start }: { ids: string[]; sheets: ReactNode[]; notes: ReactNode[]; captions: string[]; start: number }) {
  const t = useT()
  const [deck, setDeck] = useState({ shown: start, leaving: -1, turn: 0 })

  useEffect(() => {
    document.cookie = `${SEEN_COOKIE}=${withSeen(cookie(), ids[deck.shown]!, ids.length)}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`
  }, [deck.shown, ids])

  useEffect(() => {
    if (deck.leaving < 0) return
    const done = setTimeout(() => setDeck((d) => ({ ...d, leaving: -1 })), 420)
    return () => clearTimeout(done)
  }, [deck.turn, deck.leaving])

  const another = () => setDeck((d) => ({ shown: pickUnseen(ids, cookie()?.split('.') ?? [], d.shown), leaving: d.shown, turn: d.turn + 1 }))

  return (
    <div className="relative mx-auto w-full max-w-[460px] lg:mr-0">
      <div className="relative" aria-hidden>
        {/* the rest of the pile */}
        <div className="absolute inset-0 translate-x-2 translate-y-2.5 rotate-[1.6deg] rounded-md sm:translate-x-3 sm:rotate-[2.4deg] bg-surface shadow-sheet" />
        <div className="absolute inset-0 -translate-x-2 translate-y-1 -rotate-[1.6deg] rounded-md bg-surface shadow-sheet" />
        <div className="relative grid -rotate-[0.6deg]">
          {sheets.map((sheet, i) => {
            const shown = i === deck.shown
            const look = shown ? (deck.turn ? 'm-leaf-in' : '') : i === deck.leaving ? 'm-leaf-out' : 'invisible'
            return (
              <div key={shown ? `${i}.${deck.turn}` : i} className={`[grid-area:1/1] ${look}`}>
                {sheet}
              </div>
            )
          })}
        </div>
        <div key={`${deck.shown}.${deck.turn}`} className="m-note-in absolute -bottom-4 right-3 z-10 rotate-[2deg] sm:-right-8">
          {notes[deck.shown]}
        </div>
      </div>
      <div className="mt-9 flex items-center justify-between gap-3 pl-1">
        <p className="min-w-0 truncate text-sm">
          <span className="text-muted">{t('示範考卷')}</span>
          <span className="mx-1.5 text-line">/</span>
          {captions[deck.shown]}
        </p>
        <button type="button" onClick={another} className="m-press m-push-quiet inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-sm font-medium hover:bg-accent-soft/50">
          <IconShuffle size={15} aria-hidden />
          {t('換一張')}
        </button>
      </div>
    </div>
  )
}
