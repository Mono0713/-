import { privacyEn } from './privacy.en'
import { privacyZhHant } from './privacy.zh-Hant'
import { termsEn } from './terms.en'
import { termsZhHant } from './terms.zh-Hant'
import type { LegalDoc } from './types'

/** Shown at the top of both pages; change it whenever either text changes. */
export const LEGAL_UPDATED = '2026-10-06'

const DOCS = {
  privacy: { 'zh-Hant': privacyZhHant, en: privacyEn },
  terms: { 'zh-Hant': termsZhHant, en: termsEn },
} satisfies Record<string, Record<'zh-Hant' | 'en', LegalDoc>>

export type LegalKind = keyof typeof DOCS

/**
 * The policies are written in Traditional Chinese (which prevails) and English. Simplified Chinese
 * readers get the Traditional text, everyone else the English one; `translated` is false then.
 */
export function legalDoc(kind: LegalKind, locale: string): { doc: LegalDoc; lang: 'zh-Hant' | 'en'; translated: boolean } {
  const lang = locale === 'zh-Hant' || locale === 'zh-Hans' ? 'zh-Hant' : 'en'
  return { doc: DOCS[kind][lang], lang, translated: lang === locale }
}
