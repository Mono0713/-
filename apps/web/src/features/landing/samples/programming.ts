import { msg } from '@/shared/i18n/format'
import { raw, type Sample } from './types'

export const programming: Sample = {
  id: 'programming',
  subject: msg('程式設計'),
  exam: msg('期末考'),
  questions: [
    {
      section: msg('一、選擇題'),
      type: 'single_choice',
      kind: 'choice',
      text: msg('執行下面的程式，會印出什麼？'),
      code: 'total = 0\nfor i in range(1, 4):\n    total += i\nprint(total)',
      options: [raw('3'), raw('4'), raw('6'), raw('10')],
      answer: 2,
      why: msg('range(1, 4) 是 1、2、3，加起來是 6。'),
    },
    {
      section: msg('二、填充題'),
      type: 'fill_in_blank',
      kind: 'blank',
      text: msg('在 Python 中，取得串列長度的函式是 <blank></blank>。'),
      pencil: raw('len()'),
    },
    {
      section: msg('三、是非題'),
      type: 'true_false',
      kind: 'judge',
      text: msg('二分搜尋法只能用在排序好的資料上。'),
      answer: true,
    },
  ],
}
