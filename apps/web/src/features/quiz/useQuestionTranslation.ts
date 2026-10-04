'use client'

import type { QuizItem } from '@exam/quiz'
import { inOtherLanguage } from '@exam/quiz/logic'
import { useState } from 'react'
import { useT } from '@/shared/i18n/client'

/**
 * The 翻譯 toggle on a quiz question: fetched on first use with `onTranslate`, then shown and hidden.
 * Only offered when the question is in another language than the reader's (`locale`).
 */
export function useQuestionTranslation(
  q: QuizItem['question'],
  locale: string | undefined,
  onTranslate: (() => Promise<{ stem: string; options: string[] } | { error: string }>) | undefined,
) {
  const t = useT()
  const translatable = !!onTranslate && !!locale && (!!q.translation || inOtherLanguage(q, locale))
  const [translation, setTranslation] = useState<{ stem: string; options: string[] } | null>(null)
  const [translationShown, setTranslationShown] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState<string | null>(null)
  const toggleTranslation = async () => {
    if (translationShown || translation) return setTranslationShown(!translationShown)
    if (!onTranslate || translating) return
    setTranslating(true)
    setTranslateError(null)
    const result = await onTranslate().catch(() => ({ error: t('翻譯暫時沒有回應，請再試一次。') }))
    setTranslating(false)
    if ('error' in result) return setTranslateError(result.error)
    setTranslation(result)
    setTranslationShown(true)
  }
  const shownTranslation = translationShown ? translation : null
  const optionTranslation = (label: string) => shownTranslation?.options[q.options.findIndex((o) => o.label === label)] || null

  return { translatable, translationShown, translating, translateError, toggleTranslation, shownTranslation, optionTranslation }
}
