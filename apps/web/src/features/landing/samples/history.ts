import { msg } from '@/shared/i18n/format'
import type { Sample } from './types'

export const history: Sample = {
  id: 'history',
  subject: msg('國中歷史'),
  exam: msg('第二次段考'),
  questions: [
    {
      section: msg('一、選擇題'),
      type: 'single_choice',
      kind: 'choice',
      text: msg('工業革命最早發生在哪一個國家？'),
      options: [msg('法國'), msg('英國'), msg('德國'), msg('美國')],
      answer: 1,
      why: msg('十八世紀的英國先用蒸汽機帶動紡織工廠，工業革命從這裡開始。'),
    },
    {
      section: msg('二、配合題'),
      type: 'matching',
      kind: 'match',
      items: [msg('改良蒸汽機'), msg('發明電話'), msg('改良電燈')],
      options: [msg('愛迪生'), msg('瓦特'), msg('貝爾')],
      answers: [1, 2, 0],
    },
    {
      section: msg('三、填充題'),
      type: 'fill_in_blank',
      kind: 'blank',
      text: msg('楔形文字出現在 <blank></blank> 文明。'),
      pencil: msg('兩河流域'),
    },
  ],
}
