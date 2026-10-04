import type { Messages } from './format'
import type { Locale } from './locales'

/**
 * Each catalog as its own download, so the browser can switch language at once without the
 * server and without shipping every language up front.
 */
export const LOADERS: Record<Locale, () => Promise<Messages>> = {
  'zh-Hant': async () => ({}),
  'zh-Hans': () => import('./messages/zh-Hans.json').then((m) => m.default),
  en: () => import('./messages/en.json').then((m) => m.default),
  ja: () => import('./messages/ja.json').then((m) => m.default),
  ko: () => import('./messages/ko.json').then((m) => m.default),
  es: () => import('./messages/es.json').then((m) => m.default),
  fr: () => import('./messages/fr.json').then((m) => m.default),
  de: () => import('./messages/de.json').then((m) => m.default),
  pt: () => import('./messages/pt.json').then((m) => m.default),
  vi: () => import('./messages/vi.json').then((m) => m.default),
  th: () => import('./messages/th.json').then((m) => m.default),
  id: () => import('./messages/id.json').then((m) => m.default),
}
