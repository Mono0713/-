import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { currentUser, localPerson, authEnabled } from '@/server/auth'
import { services } from '@/server/context'
import { CATALOGS } from './catalogs'
import { makeT, type T } from './format'
import { DEFAULT_LOCALE, fromAcceptLanguage, isLocale, LOCALE_COOKIE, type Locale } from './locales'

/**
 * The interface language of this request: the signed-in person's setting, else the language
 * remembered in the browser, else the browser's own language, else Traditional Chinese.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const owner = authEnabled() ? (await currentUser())?.id : (await localPerson()).id
  if (owner) {
    const chosen = (await services().settings.get(owner)).locale
    if (isLocale(chosen)) return chosen
  }
  const remembered = (await cookies()).get(LOCALE_COOKIE)?.value
  if (isLocale(remembered)) return remembered
  return fromAcceptLanguage((await headers()).get('accept-language')) ?? DEFAULT_LOCALE
})

/** `t` for server components and server actions. */
export const getT = cache(async (): Promise<T> => makeT(CATALOGS[await getLocale()]))
