import { IconSparkles } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { TYPE_LABELS } from '@/shared/labels'
import { biology } from '../samples/biology'
import type { Sample, SampleQuestion, Text } from '../samples/types'
import { sayWith } from '../sheet/parts'
import { Printed } from '../sheet/Printed'
import { SceneLayout } from './SceneLayout'
import { pop, ramp, sweep } from './tween'

const MARKED_AT = 3.1

type Written = Extract<SampleQuestion, { kind: 'work' | 'blank' }>

/** The sample's question answered in writing (worked, else a blank), or biology's worked one. */
function written(sample: Sample): Written {
  const pick = (q: SampleQuestion[]) => (q.find((x) => x.kind === 'work') ?? q.find((x) => x.kind === 'blank')) as Written | undefined
  return pick(sample.questions) ?? pick(biology.questions)!
}

/** The student's lines; a worked answer written as "a, b" on the sheet goes on two lines here. */
function linesOf(q: Written, say: (text: Text) => string): string[] {
  return q.kind === 'blank' ? [say(q.pencil)] : q.pencil.flatMap((line) => say(line).split(/, (?=\S)/))
}

/** A handwritten answer is written out, then the AI marks it in red pen with a comment and the score. */
export function GradeScene({ s, tall, sample }: { s: number; tall: boolean; sample: Sample }) {
  const t = useT()
  const say = sayWith(t)
  const work = written(sample)
  const lines = linesOf(work, say)
  const n = sample.questions.includes(work) ? sample.questions.indexOf(work) + 1 : 3
  const thinking = s >= 2.3 && s < MARKED_AT
  return (
    <SceneLayout s={s} tall={tall} step={5} title={t('AI 幫你批改')} text={t('手寫的計算和申論也看得懂，用紅筆寫下評語和分數。')}>
      <div className="absolute inset-x-2 top-10 rounded-2xl bg-surface p-5 shadow-sheet">
        <p className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{t('第 {n} 題', { n })}</span>
          <span className="rounded-md border border-line px-1.5 text-[11px] font-medium leading-5 text-muted">{t(TYPE_LABELS[work.type])}</span>
          {s >= 2.3 && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent" style={pop(ramp(s, 2.3, 0.3))}>
              <IconSparkles size={13} aria-hidden style={{ opacity: thinking ? 0.6 + 0.4 * Math.cos((s - 2.3) * 9) : 1 }} />
              {t('AI 批改')}
            </span>
          )}
        </p>
        <p className="mt-2 text-[15px] leading-snug">
          <Printed text={say(work.text)} blank={<span className="mx-0.5 inline-block w-10 border-b border-current" />} />
        </p>
        <div className="relative mt-4 h-[236px] rounded-lg border border-line bg-paper bg-[linear-gradient(var(--color-grid)_1px,transparent_1px),linear-gradient(90deg,var(--color-grid)_1px,transparent_1px)] bg-[size:18px_18px] px-4 py-3">
          {lines.map((line, i) => (
            <div key={i} className="flex min-h-12 items-center gap-3 py-1">
              <span className="inline-block font-hand text-[22px] leading-tight text-ink" style={sweep(ramp(s, 0.4 + i * 0.6, 0.55, (v) => v))}>
                {line}
              </span>
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="shrink-0">
                <path d="M4 13 L10 18.5 L20 6" pathLength={1} strokeDasharray="1 2" strokeDashoffset={1 - ramp(s, MARKED_AT + i * 0.15, 0.3)} fill="none" stroke="var(--color-pen)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ))}
          <p className="mt-2 inline-block font-hand text-[22px] leading-tight text-pen" style={sweep(ramp(s, MARKED_AT + 0.45, 0.7, (v) => v))}>
            {t('寫得很清楚，答對了！')}
          </p>
          <span
            className="absolute bottom-4 right-4 grid size-[72px] -rotate-[4deg] place-items-center rounded-full border-[3px] border-pen font-hand text-[24px] leading-none text-pen"
            style={pop(ramp(s, MARKED_AT + 1.2, 0.35), 1.25)}
          >
            3/3
          </span>
        </div>
      </div>
    </SceneLayout>
  )
}
