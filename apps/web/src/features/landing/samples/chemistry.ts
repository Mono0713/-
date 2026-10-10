import { msg } from '@/shared/i18n/format'
import { raw, type Sample } from './types'

export const chemistry: Sample = {
  id: 'chemistry',
  subject: msg('普通化學'),
  exam: msg('期中考'),
  questions: [
    {
      section: msg('一、選擇題'),
      type: 'single_choice',
      kind: 'choice',
      text: msg('下列何者為強酸？'),
      options: [raw('$\\ce{CH3COOH}$'), raw('$\\ce{HCl}$'), raw('$\\ce{H2CO3}$'), raw('$\\ce{NH3}$')],
      answer: 1,
      why: msg('HCl 在水中幾乎完全解離，是強酸；醋酸和碳酸是弱酸，氨是弱鹼。'),
    },
    {
      section: msg('二、是非題'),
      type: 'true_false',
      kind: 'judge',
      text: msg('加入催化劑會改變反應的平衡常數。'),
      answer: false,
    },
    {
      section: msg('三、計算題'),
      type: 'calculation',
      kind: 'work',
      text: { key: msg('依 {eq}，4 g 氫氣完全反應可生成多少克水？'), values: { eq: '$\\ce{2H2 + O2 -> 2H2O}$' } },
      pencil: [raw('4 ÷ 2 = 2 mol'), raw('2 × 18 = 36 g')],
    },
  ],
}
