import { msg } from '@/shared/i18n/format'
import { raw, type Sample } from './types'

export const physics: Sample = {
  id: 'physics',
  subject: msg('高中物理'),
  exam: msg('隨堂小考'),
  questions: [
    {
      section: msg('一、計算題'),
      type: 'calculation',
      kind: 'work',
      text: { key: msg('物體從靜止以 {a} 加速，5 秒後的速率是多少？'), values: { a: '$2\\ \\mathrm{m/s^2}$' } },
      pencil: [raw('v = at = 2 × 5 = 10 m/s')],
    },
    {
      section: msg('二、作圖題'),
      type: 'drawing',
      kind: 'draw',
      text: msg('畫出靜止在斜面上的木塊所受的力。'),
      figure: 'incline',
    },
    {
      section: msg('三、選擇題'),
      type: 'single_choice',
      kind: 'choice',
      text: msg('下列何者是向量？'),
      options: [msg('質量'), msg('時間'), msg('位移'), msg('溫度')],
      answer: 2,
    },
  ],
}
