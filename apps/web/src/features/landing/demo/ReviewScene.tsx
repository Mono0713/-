import { useRef, type RefObject } from 'react'
import { IconCheck, IconSave } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { TYPE_LABELS } from '@/shared/labels'
import type { Sample, SampleQuestion, Text } from '../samples/types'
import { LETTERS, sayWith } from '../sheet/parts'
import { Printed } from '../sheet/Printed'
import { Cursor } from './Cursor'
import { SceneLayout } from './SceneLayout'
import { pop, ramp, rise } from './tween'
import { useSpots } from './useSpots'

const CLICK_AT = 2
const SAVE_AT = 3.3

/**
 * The editor's question cards for the sample being played. One answer is set by hand (a choice or
 * ○ ✕ is clicked, else a written answer is typed in), then everything is saved. The pointer goes
 * where those two things really are on the card.
 */
export function ReviewScene({ s, tall, sample }: { s: number; tall: boolean; sample: Sample }) {
  const t = useT()
  const say = sayWith(t)
  const edited = editedQuestion(sample.questions)
  const root = useRef<HTMLDivElement>(null)
  const target = useRef<HTMLElement>(null)
  const button = useRef<HTMLSpanElement>(null)
  const [aim, save] = useSpots(root, [target, button], [{ x: 200, y: 400 }, { x: 220, y: 474 }], sample)

  const saved = s >= SAVE_AT + 0.25
  return (
    <SceneLayout s={s} tall={tall} step={3} title={t('校對後存進題庫')} text={t('每一題都能直接改，框歪了拖一下就好。存好的題目隨時拿來練習。')}>
      <div ref={root} className="absolute inset-0 flex flex-col gap-2.5 rounded-2xl bg-paper p-4 ring-1 ring-line/70">
        <p className="flex items-baseline gap-2 px-1 text-[15px] font-bold" style={rise(ramp(s, 0.1, 0.5))}>
          {t(sample.subject)} {t(sample.exam)}
          <span className="text-xs font-medium text-muted">{t('共 {n} 題', { n: sample.questions.length })}</span>
        </p>
        {sample.questions.map((q, i) => (
          <div key={i} className="rounded-xl bg-surface p-3 shadow-sheet" style={rise(ramp(s, 0.25 + i * 0.2, 0.5))}>
            <p className="flex items-center gap-2 text-sm">
              <span className="num font-bold">{i + 1}</span>
              <span className="rounded-md border border-line px-1.5 text-[11px] font-medium leading-5 text-muted">{t(TYPE_LABELS[q.type])}</span>
            </p>
            <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-snug">
              <Printed text={headline(q, say)} blank={<span className="mx-0.5 inline-block w-8 border-b border-current" />} />
            </p>
            <Answer q={q} say={say} s={s} edited={q === edited} target={q === edited ? target : undefined} />
          </div>
        ))}
        <span
          ref={button}
          className={`mt-auto flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold ${saved ? 'bg-good-soft text-good' : 'bg-brand text-on-accent'}`}
          style={{ ...rise(ramp(s, 0.85, 0.5)), transform: s >= SAVE_AT && s < SAVE_AT + 0.15 ? 'scale(0.98)' : undefined }}
        >
          {saved ? <IconCheck size={17} aria-hidden style={pop(ramp(s, SAVE_AT + 0.25, 0.3), 0.6)} /> : <IconSave size={17} aria-hidden />}
          {saved ? t('已存入題庫') : t('存入題庫')}
        </span>
      </div>
      <Cursor
        s={s}
        show={[1.2, 4.6]}
        path={[
          [1.2, 400, 540],
          [CLICK_AT - 0.05, aim!.x, aim!.y],
          [SAVE_AT - 0.05, save!.x, save!.y],
        ]}
        clicks={[CLICK_AT, SAVE_AT]}
      />
    </SceneLayout>
  )
}

/** The question whose answer is set by hand: a choice or ○ ✕ to click, else an answer to type. */
function editedQuestion(questions: SampleQuestion[]) {
  return questions.find((q) => q.kind === 'choice' || q.kind === 'judge') ?? questions.find((q) => q.kind === 'blank' || q.kind === 'work')
}

function headline(q: SampleQuestion, say: (text: Text) => string): string {
  if (q.kind === 'match') return q.items.map(say).join(' / ')
  if (q.kind === 'write') return q.chars.join(' ')
  return say(q.text)
}

const CHIP = 'rounded-md border px-2 py-0.5'
const RIGHT = 'border-good bg-good-soft text-good'

/** The answer row of a card. On the edited card it is not set until the pointer sets it. */
function Answer({ q, say, s, edited, target }: { q: SampleQuestion; say: (text: Text) => string; s: number; edited: boolean; target?: RefObject<HTMLElement | null> }) {
  const t = useT()
  const set = !edited || s >= CLICK_AT + 0.1
  const ref = target as RefObject<never>
  switch (q.kind) {
    case 'choice':
      return (
        <ul className="mt-2 grid grid-cols-2 gap-1.5 text-[13px]">
          {q.options.map((o, k) => (
            <li key={k} ref={k === q.answer ? ref : undefined} className={`flex min-w-0 gap-1.5 ${CHIP} ${set && k === q.answer ? RIGHT : 'border-line'}`}>
              <span className="num shrink-0 font-semibold">({LETTERS[k]})</span>
              <span className="truncate">
                <Printed text={say(o)} />
              </span>
            </li>
          ))}
        </ul>
      )
    case 'judge':
      return (
        <p className="mt-2 flex gap-1.5 text-[15px] leading-6">
          {[true, false].map((mark) => (
            <span key={String(mark)} ref={mark === q.answer ? ref : undefined} className={`${CHIP} px-3 ${set && mark === q.answer ? RIGHT : 'border-line text-muted'}`}>
              {mark ? '○' : '✕'}
            </span>
          ))}
        </p>
      )
    case 'blank':
    case 'work': {
      const answer = say(q.kind === 'blank' ? q.pencil : q.pencil.at(-1)!)
      // typed one character at a time after the click
      const typed = edited ? answer.slice(0, Math.round(ramp(s, CLICK_AT + 0.2, 0.6, (v) => v) * answer.length)) : answer
      const typing = edited && s >= CLICK_AT && s < SAVE_AT - 0.1
      return (
        <p className="mt-2 flex items-center gap-2 text-[13px]">
          <span className="shrink-0 text-muted">{t('答案')}</span>
          <span ref={ref} className={`min-w-24 truncate rounded-md border px-2 py-0.5 ${typing ? 'border-accent ring-2 ring-accent/20' : 'border-line'}`}>
            {typed}
            {typing && <span className="ml-px inline-block h-3.5 w-px translate-y-0.5 bg-ink" style={{ opacity: Math.floor(s * 2.5) % 2 ? 0 : 1 }} />}
          </span>
        </p>
      )
    }
    case 'match':
      return (
        <p className="mt-2 flex flex-wrap gap-1.5 text-[13px]">
          {q.answers.map((a, i) => (
            <span key={i} className={`num ${CHIP} ${RIGHT}`}>
              {i + 1} → {LETTERS[a]}
            </span>
          ))}
        </p>
      )
    default:
      return null
  }
}

