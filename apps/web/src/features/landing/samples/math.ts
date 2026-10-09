import { msg } from '@/shared/i18n/format'
import type { Sample } from './types'

export const math: Sample = {
  id: 'math',
  subject: msg('國中數學'),
  exam: msg('第一次段考'),
  questions: [
    {
      section: msg('一、選擇題'),
      type: 'single_choice',
      kind: 'choice',
      text: { key: msg('方程式 {eq} 的解為何？'), values: { eq: '$x^2-5x+6=0$' } },
      options: [
        { key: msg('{a} 或 {b}'), values: { a: '$x=1$', b: '$x=6$' } },
        { key: msg('{a} 或 {b}'), values: { a: '$x=2$', b: '$x=3$' } },
        { key: msg('{a} 或 {b}'), values: { a: '$x=-2$', b: '$x=-3$' } },
        { key: msg('{a} 或 {b}'), values: { a: '$x=-1$', b: '$x=-6$' } },
      ],
      answer: 1,
      why: { key: msg('{eq}，所以 x = 2 或 x = 3。'), values: { eq: '$(x-2)(x-3)=0$' } },
    },
    {
      section: msg('二、填充題'),
      type: 'fill_in_blank',
      kind: 'blank',
      text: msg('正方形的面積是 49 cm²，周長是 <blank></blank> cm。'),
      pencil: { raw: '28' },
    },
    {
      section: msg('三、作圖題'),
      type: 'drawing',
      kind: 'draw',
      text: { key: msg('在數線上標出 {n} 的位置。'), values: { n: '$-1.5$' } },
      figure: 'number-line',
    },
  ],
}
