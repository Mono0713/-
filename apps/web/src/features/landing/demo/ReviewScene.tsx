import type { ReactNode } from 'react'
import { IconCheck, IconSave } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { TYPE_LABELS } from '@/shared/labels'
import { biology } from '../samples/biology'
import type { SampleQuestion } from '../samples/types'
import { LETTERS, sayWith } from '../sheet/parts'
import { Cursor } from './Cursor'
import { SceneLayout } from './SceneLayout'
import { pop, ramp, rise } from './tween'

type Kind<K> = Extract<SampleQuestion, { kind: K }>
const choice = biology.questions[0] as Kind<'choice'>
const judge = biology.questions[1] as Kind<'judge'>
const work = biology.questions[2] as Kind<'work'>

/** The editor's question cards: the answer to question 3 gets its unit typed in, then everything is saved. */
export function ReviewScene({ s, tall }: { s: number; tall: boolean }) {
  const t = useT()
  const say = sayWith(t)
  const unit = t('{n} 個細菌', { n: 64 })
  // the answer is typed one character at a time after the click
  const typed = unit.slice(0, Math.max(2, Math.round(2 + ramp(s, 2.2, 0.5, (v) => v) * (unit.length - 2))))
  const editing = s >= 2 && s < 3.2
  const saved = s >= 3.55
  return (
    <SceneLayout s={s} tall={tall} step={3} title={t('校對後存進題庫')} text={t('每一題都能直接改，框歪了拖一下就好。存好的題目隨時拿來練習。')}>
      <div className="absolute inset-0 rounded-2xl bg-paper p-4 ring-1 ring-line/70">
        <p className="flex items-baseline gap-2 px-1 text-[15px] font-bold" style={rise(ramp(s, 0.1, 0.5))}>
          {t(biology.subject)} {t(biology.exam)}
          <span className="text-xs font-medium text-muted">{t('共 {n} 題', { n: biology.questions.length })}</span>
        </p>
        <Card n={1} type={t(TYPE_LABELS[choice.type])} text={say(choice.text)} top={44} p={ramp(s, 0.25, 0.5)}>
          <ul className="mt-2 grid grid-cols-2 gap-1.5 text-[13px]">
            {choice.options.map((o, k) => (
              <li key={k} className={`flex gap-1.5 rounded-md border px-2 py-1 ${k === choice.answer ? 'border-good bg-good-soft text-good' : 'border-line'}`}>
                <span className="num font-semibold">({LETTERS[k]})</span>
                {say(o)}
              </li>
            ))}
          </ul>
        </Card>
        <Card n={2} type={t(TYPE_LABELS[judge.type])} text={say(judge.text)} top={206} p={ramp(s, 0.45, 0.5)}>
          <span className="mt-2 inline-flex rounded-md border border-good bg-good-soft px-2.5 text-[15px] text-good">○</span>
        </Card>
        <Card n={3} type={t(TYPE_LABELS[work.type])} text={say(work.text)} top={316} p={ramp(s, 0.65, 0.5)}>
          <p className="mt-2 flex items-center gap-2 text-[13px]">
            <span className="text-muted">{t('答案')}</span>
            <span className={`min-w-24 rounded-md border px-2 py-0.5 ${editing ? 'border-accent ring-2 ring-accent/20' : 'border-line'}`}>
              {typed}
              {editing && <span className="ml-px inline-block h-3.5 w-px translate-y-0.5 bg-ink" style={{ opacity: Math.floor(s * 2.5) % 2 ? 0 : 1 }} />}
            </span>
          </p>
        </Card>
        <div className="absolute inset-x-4 top-[448px]" style={rise(ramp(s, 0.85, 0.5))}>
          <span
            className={`flex h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-colors ${saved ? 'bg-good-soft text-good' : 'bg-brand text-on-accent'}`}
            style={{ transform: s >= 3.3 && s < 3.45 ? 'scale(0.98)' : undefined }}
          >
            {saved ? <IconCheck size={17} aria-hidden style={pop(ramp(s, 3.55, 0.3), 0.6)} /> : <IconSave size={17} aria-hidden />}
            {saved ? t('已存入題庫') : t('存入題庫')}
          </span>
        </div>
      </div>
      <Cursor
        s={s}
        show={[1.2, 4.6]}
        path={[
          [1.2, 400, 540],
          [1.95, 180, 418],
          [3.25, 250, 474],
        ]}
        clicks={[2, 3.3]}
      />
    </SceneLayout>
  )
}

function Card({ n, type, text, top, p, children }: { n: number; type: string; text: string; top: number; p: number; children: ReactNode }) {
  return (
    <div className="absolute inset-x-4 rounded-xl bg-surface p-3 shadow-sheet" style={{ top, ...rise(p) }}>
      <p className="flex items-center gap-2 text-sm">
        <span className="num font-bold">{n}</span>
        <span className="rounded-md border border-line px-1.5 text-[11px] font-medium leading-5 text-muted">{type}</span>
      </p>
      <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-snug">{text}</p>
      {children}
    </div>
  )
}
