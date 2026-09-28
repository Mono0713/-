import type { QuestionType } from '@exam/core'

export const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: '單選',
  multiple_choice: '多選',
  true_false: '是非',
  fill_in_blank: '填充',
  short_answer: '簡答',
  essay: '問答',
  calculation: '計算',
  matching: '配合',
  other: '其他',
}

export const CHOICE_TYPES = new Set<QuestionType>(['single_choice', 'multiple_choice', 'matching'])

export const STATUS_LABELS = {
  processing: '辨識中',
  waiting: '等待貼上回覆',
  review: '待校對',
  saved: '已存入題庫',
  failed: '失敗',
} as const

export const CONFIDENCE_LABELS = { high: '可信', medium: '請確認', low: '需檢查' } as const

export const INK_LABELS = {
  colour: '彩色筆（只擦筆跡）',
  dark: '鉛筆或黑筆（整格清空重打字）',
  none: '空白',
} as const
