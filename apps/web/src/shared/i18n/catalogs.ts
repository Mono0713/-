import type { Locale } from './locales'
import type { Messages } from './format'
import de from './messages/de.json'
import en from './messages/en.json'
import es from './messages/es.json'
import fr from './messages/fr.json'
import id from './messages/id.json'
import ja from './messages/ja.json'
import ko from './messages/ko.json'
import pt from './messages/pt.json'
import th from './messages/th.json'
import vi from './messages/vi.json'
import zhHans from './messages/zh-Hans.json'

/** Each language's translations of the Traditional Chinese interface text. */
export const CATALOGS: Record<Locale, Messages> = { 'zh-Hant': {}, 'zh-Hans': zhHans, en, ja, ko, es, fr, de, pt, vi, th, id }
