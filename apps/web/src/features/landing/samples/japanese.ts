import { msg } from '@/shared/i18n/format'
import { raw, type Sample } from './types'

// The Japanese being tested is printed as is; only the instructions and meanings are translated.
export const japanese: Sample = {
  id: 'japanese',
  subject: msg('日語'),
  exam: msg('N5 模擬測驗'),
  questions: [
    {
      section: msg('一、選出畫線字的讀音'),
      type: 'single_choice',
      kind: 'choice',
      text: raw('<u>先生</u>は きょうしつに います。'), // i18n-ignore
      options: [raw('せんせい'), raw('せいせん'), raw('さきせい'), raw('せんせ')], // i18n-ignore
      answer: 0,
    },
    {
      section: msg('二、填入適當的助詞'),
      type: 'fill_in_blank',
      kind: 'blank',
      text: raw('としょかん<blank></blank>べんきょうします。'), // i18n-ignore
      pencil: raw('で'), // i18n-ignore
    },
    {
      section: msg('三、配合題'),
      type: 'matching',
      kind: 'match',
      items: [raw('みず'), raw('やま'), raw('ほん')], // i18n-ignore
      options: [msg('山'), msg('書'), msg('水')],
      answers: [2, 0, 1],
    },
  ],
}
