import { Fragment } from 'react'
import { IconCheck, IconEraser } from '@/shared/icons'
import type { T } from '@/shared/i18n/format'
import { TYPE_LABELS } from '@/shared/labels'
import type { Sample } from '../samples/types'
import { Boxed, sayWith } from './parts'
import { Question } from './Question'

/**
 * A sample exam as it comes off the scanner: the copy with the student's pencil sits on top and a
 * scan line wipes it away from the top down (.m-wipe and .m-scan-once share one timing), leaving the
 * clean copy, whose questions are then boxed and the answer highlighted (motion.css, "product page").
 */
export function SampleSheet({ sample, t }: { sample: Sample; t: T }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-md bg-surface text-[13.5px] leading-relaxed shadow-sheet [&_.katex]:text-[1.04em]">
      <div className="grid flex-1 [&>*]:[grid-area:1/1]">
        <Copy sample={sample} t={t} pencil={false} />
        <Copy sample={sample} t={t} pencil className="m-wipe" />
      </div>
      <div className="m-scan-once" />
    </div>
  )
}

/** One copy of the sheet: with the student's pencil, or clean with the questions boxed. */
export function Copy({ sample, t, pencil, className = '' }: { sample: Sample; t: T; pencil: boolean; className?: string }) {
  const say = sayWith(t)
  return (
    // pb leaves the bottom of the page clear for the note that pops up over it (SampleDeck)
    <div className={`flex flex-col bg-surface px-4 pb-14 pt-4 sm:px-6 ${className}`}>
      <header className="border-b border-ink/15 pb-2.5 text-center">
        <p className="flex flex-wrap justify-center gap-x-3 text-[15px] font-bold tracking-[0.04em]">
          <span>{t(sample.subject)}</span>
          <span>{t(sample.exam)}</span>
        </p>
        <p className="mt-1 flex flex-wrap justify-center gap-x-4 text-[11px] text-muted">
          {[t('班級：'), t('座號：'), t('姓名：')].map((label, i) => (
            <span key={i} className="flex items-baseline gap-1">
              {label}
              <span className={`inline-block border-b border-line ${['w-8', 'w-6', 'w-14'][i]}`} />
            </span>
          ))}
        </p>
      </header>
      {sample.questions.map((q, i) => (
        <Fragment key={i}>
          {/* every paper is as tall as the longest one; a shorter one spreads out a little instead of ending in a blank half page */}
          {i > 0 && <span className="max-h-8 flex-1" />}
          {q.section && <p className="mt-3 text-[12.5px] font-semibold">{say(q.section)}</p>}
          <Boxed i={i} label={`${i + 1} · ${t(TYPE_LABELS[q.type])}`} clean={!pencil}>
            <Question q={q} n={i + 1} say={say} pencil={pencil} />
          </Boxed>
        </Fragment>
      ))}
    </div>
  )
}

/** The note that pops up once the sheet is read. */
export function FoundCard({ sample, t }: { sample: Sample; t: T }) {
  return (
    <div className="rounded-xl bg-night px-3.5 py-2.5 text-white shadow-[0_18px_40px_-18px_rgb(10_15_31/0.6)] ring-1 ring-white/10">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <IconCheck size={15} className="text-night-accent" aria-hidden />
        {t('已辨識 {n} 題', { n: sample.questions.length })}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-white/60">
        <IconEraser size={13} aria-hidden />
        {t('筆跡已清除')}
      </p>
    </div>
  )
}
