import { msg } from '@/shared/i18n/format'
import { raw, type Sample } from './types'

export const english: Sample = {
  id: 'english',
  subject: msg('高中英文'),
  exam: msg('模擬考'),
  questions: [
    {
      section: msg('一、詞彙題'),
      type: 'single_choice',
      kind: 'choice',
      text: raw('The museum is full of <blank></blank> treasures from thousands of years ago.'),
      options: [raw('modern'), raw('ancient'), raw('recent'), raw('future')],
      answer: 1,
    },
    {
      section: msg('二、文法填空'),
      type: 'fill_in_blank',
      kind: 'blank',
      text: raw('She <blank></blank> (go) to school by bus every day.'),
      pencil: raw('goes'),
    },
    {
      section: msg('三、配合題'),
      type: 'matching',
      kind: 'match',
      items: [raw('borrow'), raw('lend'), raw('return')],
      options: [msg('歸還'), msg('借入'), msg('借出')],
      answers: [1, 2, 0],
    },
  ],
}
