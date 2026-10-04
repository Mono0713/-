import type { Locale } from './locales'
import type { Messages } from './format'
import en from './messages/en.json'
import ja from './messages/ja.json'
import ko from './messages/ko.json'
import zhHans from './messages/zh-Hans.json'

/** Each language's translations of the Traditional Chinese interface text. */
export const CATALOGS: Record<Locale, Messages> = { 'zh-Hant': {}, 'zh-Hans': zhHans, en, ja, ko }
