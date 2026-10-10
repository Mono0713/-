'use client'

import type { DraftQuestion } from '@exam/core'
import { useEffect, useRef } from 'react'
import { useT } from '@/shared/i18n/client'
import { splitNumber } from './parts'

/** The toolbar's question numbers: sub-questions sit together under their number. */
export function NumberBar({
  questions,
  keys,
  selected,
  flaggedOnly,
  isFlagged,
  onSelect,
  onSelectGroup,
}: {
  questions: DraftQuestion[]
  keys: string[]
  selected: number | null
  flaggedOnly: boolean
  isFlagged: (q: DraftQuestion) => boolean
  onSelect: (index: number) => void
  /** A split number's own button shows its group card. */
  onSelectGroup: (groupId: string, first: number) => void
}) {
  const t = useT()
  // The number bar has no scrollbar: the wheel scrolls it sideways, and the chosen number stays in view.
  const numberBar = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = numberBar.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el.scrollBy({ left: e.deltaY, behavior: 'instant' })
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])
  useEffect(() => {
    const el = numberBar.current
    const chip = el?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!el || !chip) return
    const box = el.getBoundingClientRect()
    const c = chip.getBoundingClientRect()
    el.scrollTo({ left: el.scrollLeft + c.left - box.left - el.clientWidth / 2 + c.width / 2, behavior: 'smooth' })
  }, [selected])

  return (
    <nav ref={numberBar} className="scroll-strip flex min-w-0 flex-1 overflow-x-auto" aria-label={t('題號')}>
      {/* centred while the numbers fit; once they overflow, the strip scrolls from the start */}
      <div className="mx-auto flex w-max items-center gap-1 py-0.5">
        {numberClusters(questions).map((cluster) => {
          const shown = cluster.items.filter((i) => !flaggedOnly || isFlagged(questions[i]!))
          if (!shown.length) return null
          const tone = (i: number) =>
            selected === i ? 'bg-accent text-on-accent' : isFlagged(questions[i]!) ? 'bg-warn-soft text-warn hover:bg-hl/40' : 'text-muted hover:bg-ink/[0.05] hover:text-ink'
          if (cluster.part === null)
            return (
              <button
                key={keys[shown[0]!]}
                type="button"
                onClick={() => onSelect(shown[0]!)}
                aria-current={selected === shown[0] || undefined}
                title={isFlagged(questions[shown[0]!]!) ? t('待確認') : undefined}
                className={`num h-7 min-w-7 shrink-0 rounded-md px-1.5 text-xs transition-colors ${
                  selected === shown[0]
                    ? 'bg-accent text-on-accent'
                    : isFlagged(questions[shown[0]!]!)
                      ? 'bg-warn-soft text-warn hover:bg-hl/40'
                      : 'bg-surface text-muted shadow-sheet hover:text-ink'
                }`}
              >
                {cluster.main}
              </button>
            )
          return (
            <span key={keys[shown[0]!]} className="flex h-7 shrink-0 items-center gap-px rounded-md bg-surface pr-0.5 shadow-sheet" title={t('第 {n} 題的小題', { n: cluster.main })}>
              {/* the number itself opens the question's shared card; a hairline sets the parts apart */}
              <button
                type="button"
                onClick={() => {
                  const groupId = questions[shown[0]!]!.groupId
                  if (groupId) onSelectGroup(groupId, shown[0]!)
                  else onSelect(shown[0]!)
                }}
                className="num h-full rounded-l-md pl-2 pr-1.5 text-xs text-ink/70 transition-colors hover:bg-ink/[0.05] hover:text-ink"
              >
                {cluster.main}
              </button>
              <span aria-hidden className="mr-1 h-3.5 w-px bg-line" />
              {shown.map((i) => (
                <button key={keys[i]} type="button" onClick={() => onSelect(i)} aria-current={selected === i || undefined} className={`num h-6 min-w-6 rounded px-1 text-[11px] transition-colors ${tone(i)}`}>
                  {splitNumber(questions[i]!.number).part}
                </button>
              ))}
            </span>
          )
        })}
      </div>
    </nav>
  )
}

/** Consecutive sub-questions of one number (11(a), 11(b)) form one cluster in the number bar. */
function numberClusters(questions: DraftQuestion[]): { main: string; part: string | null; items: number[] }[] {
  const out: { main: string; part: string | null; items: number[] }[] = []
  questions.forEach((q, i) => {
    const { main, part } = splitNumber(q.number)
    const last = out.at(-1)
    if (part !== null && last?.part !== null && last?.main === main) last.items.push(i)
    else out.push({ main: part === null ? q.number : main, part, items: [i] })
  })
  return out
}
