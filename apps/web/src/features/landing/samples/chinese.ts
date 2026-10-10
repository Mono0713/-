import { msg } from '@/shared/i18n/format'
import { raw, type Sample } from './types'

// The exam's own Chinese (characters to practise, the 注音 and the student's sentence) is printed as is.
export const chinese: Sample = {
  id: 'chinese',
  subject: msg('國小國語'),
  exam: msg('第三課習作'),
  questions: [
    {
      section: msg('一、寫字練習'),
      type: 'writing',
      kind: 'write',
      chars: ['春', '天'], // i18n-ignore
    },
    {
      section: msg('二、看注音寫國字'),
      type: 'fill_in_blank',
      kind: 'blank',
      text: raw('春天的公<blank></blank>（ㄩㄢˊ）裡開滿了花。'), // i18n-ignore
      pencil: raw('園'), // i18n-ignore
    },
    {
      section: msg('三、造句'),
      type: 'short_answer',
      kind: 'work',
      text: msg('用「因為……所以……」造一個句子。'),
      pencil: [raw('因為下雨了，所以我帶了雨傘。')], // i18n-ignore
    },
  ],
}
