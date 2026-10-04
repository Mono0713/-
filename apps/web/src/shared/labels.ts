import type { QuestionType } from '@exam/core'
import { msg } from '@/shared/i18n/format'

// Labels in Traditional Chinese, marked for translation: show them with t(TYPE_LABELS[type]).

export const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: msg('單選'),
  multiple_choice: msg('多選'),
  true_false: msg('是非'),
  fill_in_blank: msg('填充'),
  short_answer: msg('簡答'),
  essay: msg('問答'),
  calculation: msg('計算'),
  matching: msg('配合'),
  writing: msg('寫字練習'),
  other: msg('其他'),
}

export const CHOICE_TYPES = new Set<QuestionType>(['single_choice', 'multiple_choice', 'matching'])

export const STATUS_LABELS = {
  processing: msg('辨識中'),
  waiting: msg('等待貼上回覆'),
  review: msg('待校對'),
  saved: msg('已存入題庫'),
  failed: msg('失敗'),
} as const

export const CONFIDENCE_LABELS = { high: msg('可信'), medium: msg('請確認'), low: msg('需檢查') } as const

export const INK_LABELS = {
  colour: msg('彩色筆（只擦筆跡）'),
  dark: msg('鉛筆或黑筆（整格清空重打字）'),
  none: msg('空白'),
} as const
