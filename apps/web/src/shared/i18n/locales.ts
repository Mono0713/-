import { DEFAULT_LOCALE, LOCALES, type Locale } from '@exam/settings'

export { DEFAULT_LOCALE, LOCALES, type Locale }

const IDS = LOCALES.map((l) => l.id) as readonly string[]
export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && IDS.includes(v)

/** The cookie that remembers the interface language, so it applies before sign-in too. */
export const LOCALE_COOKIE = 'locale'

/** The best interface language for an Accept-Language header, e.g. "zh-CN,zh;q=0.9,en;q=0.8". */
export function fromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null
  const wanted = header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';')
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.trim().slice(2) ?? 1)
      return { tag: tag.toLowerCase(), q: Number.isFinite(q) ? q : 0 }
    })
    .filter((w) => w.tag && w.q > 0)
    .sort((a, b) => b.q - a.q)
  for (const { tag } of wanted) {
    if (tag.startsWith('zh')) return /hans|cn|sg|my/.test(tag) ? 'zh-Hans' : 'zh-Hant'
    const base = tag.split('-')[0]
    if (base && isLocale(base)) return base
  }
  return null
}

/** BCP 47 tag for Intl formatting (dates, numbers) in a locale. */
export const intlTag = (locale: Locale): string => (locale === 'zh-Hant' ? 'zh-TW' : locale === 'zh-Hans' ? 'zh-CN' : locale)
