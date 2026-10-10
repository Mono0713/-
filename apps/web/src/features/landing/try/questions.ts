import { msg, type T } from '@/shared/i18n/format'
import type { TryItem } from './TryQuestion'

/** The questions a visitor can answer on the product page (試一題 card), worded like the sample sheets. */
export const TRY_QUESTIONS: { text: string; options: string[]; answer: number; why: string }[] = [
  {
    text: msg('工業革命最早發生在哪一個國家？'),
    options: [msg('法國'), msg('英國'), msg('德國'), msg('美國')],
    answer: 1,
    why: msg('十八世紀的英國先用蒸汽機帶動紡織工廠，工業革命從這裡開始。'),
  },
  {
    text: msg('下列何者是向量？'),
    options: [msg('質量'), msg('時間'), msg('位移'), msg('溫度')],
    answer: 2,
    why: msg('位移有大小也有方向；質量、時間和溫度只有大小。'),
  },
  {
    text: msg('原核生物具有下列哪一種構造？'),
    options: [msg('核膜'), msg('70S 核糖體'), msg('粒線體'), msg('線狀染色體')],
    answer: 1,
    why: msg('原核生物沒有核膜和粒線體，但有 70S 核糖體。'),
  },
]

/** A question as the card shows it: printed in `printed`'s language, read in the visitor's (`t`). */
export const tryItem = (q: (typeof TRY_QUESTIONS)[number], t: T, printed: T): TryItem => ({
  text: printed(q.text),
  options: q.options.map((o) => printed(o)),
  answer: q.answer,
  read: { text: t(q.text), options: q.options.map((o) => t(o)) },
  why: t(q.why),
})
