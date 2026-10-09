import { IconChevronRight, IconLanguages } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { TYPE_LABELS } from '@/shared/labels'
import { PenTick } from '@/shared/motion/PenMarks'
import { useRef } from 'react'
import { Printed } from '../sheet/Printed'
import type { PracticeItem } from './practice'
import { Cursor } from './Cursor'
import { SceneLayout } from './SceneLayout'
import { ramp, rise } from './tween'
import { useSpots } from './useSpots'

const PICK_AT = 1.35
const TRANSLATE_AT = 3.5

const BLANK = <span className="mx-0.5 inline-block w-8 border-b border-current" />

/**
 * Single-question practice on a phone: an answer is tapped and marked, then 翻譯 adds the reader's
 * language (skipped for a question that reads the same in both, such as an English exam's).
 */
export function PracticeScene({ s, tall, item }: { s: number; tall: boolean; item: PracticeItem }) {
  const t = useT()
  const root = useRef<HTMLDivElement>(null)
  const answer = useRef<HTMLLIElement>(null)
  const translate = useRef<HTMLSpanElement>(null)
  const [pick, flip] = useSpots(root, [answer, translate], [{ x: 200, y: 205 }, { x: 312, y: 53 }], item)
  const picked = s >= PICK_AT + 0.1
  const translated = item.read !== null && s >= TRANSLATE_AT + 0.1
  const read = ramp(s, TRANSLATE_AT + 0.1, 0.4)
  return (
    <SceneLayout s={s} tall={tall} step={4} title={t('隨時練習')} text={t('點一下就知道對錯和詳解；看不懂的外文題目，一鍵翻譯。')}>
      <div ref={root} className="absolute inset-0">
      <div className="absolute left-[85px] top-1 h-[512px] w-[270px] rounded-[40px] bg-night p-[7px] shadow-[0_24px_50px_-24px_rgb(10_15_31/0.55)]">
        <div className="flex h-full flex-col overflow-hidden rounded-[33px] bg-paper px-4 pb-4 pt-9">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="shrink-0 font-semibold">{t('第 {n} 題', { n: 1 })}</span>
            <span className="min-w-0 truncate rounded-md border border-line px-1.5 text-[11px] font-medium leading-5 text-muted">{t(TYPE_LABELS.single_choice)}</span>
            <span ref={translate} className={`ml-auto flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs ${translated ? 'bg-ink text-paper' : 'text-muted'}`}>
              <IconLanguages size={14} aria-hidden />
              {t('翻譯')}
            </span>
          </div>
          <div className="mt-2 flex gap-1" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i === 0 ? (picked ? 'bg-good' : 'bg-ink/40') : 'bg-line'}`} />
            ))}
          </div>
          <p className="mt-4 text-[15px] font-medium leading-snug">
            <Printed text={item.text} blank={BLANK} />
          </p>
          {translated && (
            <p className="mt-1 text-[13px] leading-snug text-muted" style={rise(read, 4)}>
              <Printed text={item.read!.text} blank={BLANK} />
            </p>
          )}
          {item.code && <pre className="mt-2 rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] leading-[1.45]">{item.code}</pre>}
          <ul className="mt-3 grid gap-1.5">
            {item.options.map((option, k) => {
              const right = picked && k === item.answer
              return (
                <li key={k} ref={k === item.answer ? answer : undefined} className={`relative flex gap-2 rounded-lg border py-1.5 pl-3 pr-7 text-[13px] leading-snug ${right ? 'border-good bg-good-soft' : 'border-line bg-surface'}`}>
                  <span className={`num shrink-0 font-semibold ${right ? 'text-good' : 'text-muted'}`}>({'ABCD'[k]})</span>
                  <span className="min-w-0">
                    <span className={right ? 'hl' : ''} style={right ? { backgroundSize: `${ramp(s, PICK_AT + 0.15, 0.35) * 100}% 100%`, backgroundRepeat: 'no-repeat' } : undefined}>
                      <Printed text={option} />
                    </span>
                    {translated && item.read!.options[k] !== option && (
                      <span className="block text-[11.5px] text-muted" style={rise(read, 4)}>
                        <Printed text={item.read!.options[k]!} />
                      </span>
                    )}
                  </span>
                  {right && (
                    <span className="absolute right-2 top-1.5">
                      <PenTick size={16} />
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          {picked && (
            <p className="mt-3 line-clamp-3 text-[12.5px] leading-relaxed" style={rise(ramp(s, PICK_AT + 0.35, 0.45), 6)}>
              <span className="mr-1.5 inline-block rounded-md bg-good-soft px-1.5 text-[11px] font-semibold leading-5 text-good">{t('答對')}</span>
              <span className="font-medium">{t('詳解：')}</span>
              <span className="ms-1">{item.why}</span>
            </p>
          )}
          <span className="mt-auto flex items-center justify-center gap-1 rounded-xl bg-surface py-2 text-sm font-medium shadow-sheet">
            {t('下一題')}
            <IconChevronRight size={15} aria-hidden />
          </span>
        </div>
      </div>
      <Cursor
        s={s}
        show={[0.5, 4.9]}
        path={[
          [0.5, 330, 470],
          [PICK_AT - 0.05, pick!.x, pick!.y],
          ...(item.read ? [[TRANSLATE_AT - 0.05, flip!.x, flip!.y] as [number, number, number]] : []),
        ]}
        clicks={item.read ? [PICK_AT, TRANSLATE_AT] : [PICK_AT]}
      />
      </div>
    </SceneLayout>
  )
}
