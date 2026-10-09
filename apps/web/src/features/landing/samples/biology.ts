import { msg } from '@/shared/i18n/format'
import { raw, type Sample } from './types'

export const biology: Sample = {
  id: 'biology',
  subject: msg('普通生物'),
  exam: msg('期中考'),
  questions: [
    {
      section: msg('一、選擇題'),
      type: 'single_choice',
      kind: 'choice',
      text: msg('原核生物具有下列哪一種構造？'),
      options: [msg('核膜'), msg('70S 核糖體'), msg('粒線體'), msg('線狀染色體')],
      answer: 1,
      why: msg('原核生物沒有核膜和粒線體，但有 70S 核糖體。'),
    },
    {
      section: msg('二、是非題'),
      type: 'true_false',
      kind: 'judge',
      text: msg('依下表，酵母菌是真核生物。'),
      table: {
        head: [msg('生物'), msg('細胞壁'), msg('核膜')],
        rows: [
          [msg('大腸桿菌'), raw('○'), raw('✕')],
          [msg('酵母菌'), raw('○'), raw('○')],
        ],
      },
      answer: true,
    },
    {
      section: msg('三、計算題'),
      type: 'calculation',
      kind: 'work',
      text: msg('一個細菌每 20 分鐘分裂一次，2 小時後會有幾個？'),
      pencil: [raw('120 ÷ 20 = 6, 2⁶ = 64')],
    },
  ],
}
