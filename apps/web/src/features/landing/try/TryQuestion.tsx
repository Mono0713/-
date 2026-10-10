'use client'

import { useEffect, useState } from 'react'
import { IconChevronRight, IconLanguages } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { TYPE_LABELS } from '@/shared/labels'
import { PenTick } from '@/shared/motion/PenMarks'

/** One question as printed (`text`, `options`: another language than the reader's) and in the reader's language. */
export interface TryItem {
  text: string
  options: string[]
  answer: number
  read: { text: string; options: string[] }
  why: string
}

const LETTERS = 'ABCD'

/**
 * A question to answer right on the product page, looking and behaving like one in single-question
 * practice: pick an option and it is marked at once with its explanation, 翻譯 adds the reader's
 * language under the printed text, 下一題 brings the next one.
 * Every question is laid out in the same grid cell with room for its explanation (the ones not
 * shown are invisible), so the card keeps one height whatever is asked or answered.
 */
export function TryQuestion({ items }: { items: TryItem[] }) {
  const t = useT()
  const [at, setAt] = useState({ q: 0, leaving: -1, turn: 0 })
  const [picked, setPicked] = useState<number | null>(null)
  const [results, setResults] = useState<(boolean | undefined)[]>([])
  const [translated, setTranslated] = useState(false)

  useEffect(() => {
    if (at.leaving < 0) return
    const done = setTimeout(() => setAt((a) => ({ ...a, leaving: -1 })), 420)
    return () => clearTimeout(done)
  }, [at.turn, at.leaving])

  const pick = (k: number) => {
    setPicked(k)
    setResults((r) => Object.assign([...r], { [at.q]: k === items[at.q]!.answer }))
  }
  const next = () => {
    const q = (at.q + 1) % items.length
    setPicked(null)
    if (q === 0) setResults([])
    setAt((a) => ({ q, leaving: a.q, turn: a.turn + 1 }))
  }

  return (
    <div className="@container rounded-xl bg-paper p-4 ring-1 ring-line/70 sm:p-5">
      {/* one row even on a phone: the type label gives way first */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 font-semibold tabular-nums">{t('第 {n} 題', { n: at.q + 1 })}</span>
        <span className="min-w-0 truncate rounded-md border border-line bg-paper px-1.5 py-0.5 text-xs font-medium text-muted">{t(TYPE_LABELS.single_choice)}</span>
        <button
          type="button"
          onClick={() => setTranslated(!translated)}
          aria-pressed={translated}
          className={`m-press ml-auto flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ${translated ? 'bg-ink text-paper' : 'text-muted hover:bg-ink/[0.06] hover:text-ink'}`}
        >
          <IconLanguages size={16} aria-hidden />
          {t('翻譯')}
        </button>
      </div>

      <div className="mt-3 grid">
        {items.map((item, i) => {
          const shown = i === at.q
          const look = shown ? (at.turn ? 'm-leaf-in' : '') : i === at.leaving ? 'm-leaf-out' : 'invisible'
          return (
            <div key={shown ? `${i}.${at.turn}` : i} className={`flex flex-col [grid-area:1/1] ${look}`} aria-hidden={!shown} inert={!shown}>
              <Asked item={item} picked={shown ? picked : null} translated={translated} onPick={pick} />
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="flex gap-1" aria-hidden>
          {items.map((_, i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full transition-colors ${results[i] === true ? 'bg-good' : results[i] === false ? 'bg-bad' : i === at.q ? 'bg-ink/40' : 'bg-line'}`} />
          ))}
        </span>
        <button type="button" onClick={next} className="m-press m-push-quiet ml-auto inline-flex items-center gap-1 rounded-lg bg-surface py-1.5 pl-3 pr-2 text-sm font-medium hover:bg-accent-soft/50">
          {t('下一題')}
          <IconChevronRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}

function Asked({ item, picked, translated, onPick }: { item: TryItem; picked: number | null; translated: boolean; onPick: (k: number) => void }) {
  const t = useT()
  const done = picked !== null
  const right = picked === item.answer
  return (
    <>
      <p className="text-[15px] font-medium leading-relaxed">{item.text}</p>
      {translated && <p className="m-expand text-sm leading-relaxed text-muted">{item.read.text}</p>}
      <ul className="mt-3 grid grid-cols-1 gap-2 @[22rem]:grid-cols-2">
        {item.options.map((option, k) => {
          const correct = done && k === item.answer
          const mine = picked === k
          const tone = correct && mine ? 'border-good bg-good-soft m-pop' : correct ? 'border-dashed border-good bg-surface' : mine ? 'border-bad bg-bad-soft m-nudge' : done ? 'border-line bg-surface text-muted' : 'border-line bg-surface hover:border-accent/50'
          return (
            <li key={k} className="flex">
              <button type="button" disabled={done} onClick={() => onPick(k)} className={`m-press relative flex w-full items-start gap-2 rounded-lg border py-2 pl-3 pr-7 text-left text-sm ${tone}`}>
                <span className={`num shrink-0 font-semibold leading-relaxed ${mine ? (correct ? 'text-good' : 'text-bad') : 'text-muted'}`}>({LETTERS[k]})</span>
                <span className="min-w-0 flex-1 leading-relaxed hyphens-auto break-words">
                  {option}
                  {translated && <span className="m-expand block text-xs leading-relaxed text-muted">{item.read.options[k]}</span>}
                </span>
                {/* the tick sits in room every option keeps free, so marking never re-wraps the text */}
                {correct && mine && (
                  <span className="absolute right-2 top-2 flex h-[1.625em] items-center">
                    <PenTick size={18} />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {/* room for the explanation is kept from the start, so answering never moves the page */}
      <div className="mt-3 grid flex-1 text-sm leading-relaxed [&>*]:[grid-area:1/1]" aria-live="polite">
        <p className={`text-muted ${done ? 'invisible' : ''}`}>{t('選一個答案試試看')}</p>
        <p className={done ? 'm-expand' : 'invisible'}>
          <span className={`mr-2 inline-block rounded-md px-1.5 text-xs font-semibold leading-5 ${right ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>{right ? t('答對') : t('答錯')}</span>
          <span className="font-medium">{t('詳解：')}</span>
          <span className="ms-1">{item.why}</span>
        </p>
      </div>
    </>
  )
}
