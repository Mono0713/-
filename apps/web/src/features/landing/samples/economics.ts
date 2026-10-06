import { msg } from '@/shared/i18n/format'
import { raw, type Sample } from './types'

export const economics: Sample = {
  id: 'economics',
  subject: msg('經濟學原理'),
  exam: msg('第二次小考'),
  questions: [
    {
      section: msg('一、作圖題'),
      type: 'drawing',
      kind: 'draw',
      text: msg('所得增加使需求增加，請在圖上畫出新的需求線。'),
      figure: 'market',
    },
    {
      section: msg('二、選擇題'),
      type: 'single_choice',
      kind: 'choice',
      text: msg('承上題，新的均衡價格會如何變化？'),
      options: [msg('上升'), msg('下降'), msg('不變'), msg('無法判斷')],
      answer: 0,
    },
    {
      section: msg('三、計算題'),
      type: 'calculation',
      kind: 'work',
      text: msg('價格上漲 20%，需求量減少 10%，需求的價格彈性是多少？'),
      pencil: [raw('10% ÷ 20% = 0.5')],
    },
  ],
}
