/** Interface languages a user can pick. The first is the default. */
export const LOCALES = [
  { id: 'zh-Hant', label: '繁體中文' },
  { id: 'zh-Hans', label: '简体中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
] as const

export type Locale = (typeof LOCALES)[number]['id']

export const DEFAULT_LOCALE: Locale = LOCALES[0].id
