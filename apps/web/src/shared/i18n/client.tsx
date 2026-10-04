'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { makeT, type Messages, type T } from './format'
import { DEFAULT_LOCALE, type Locale } from './locales'

const Context = createContext<{ locale: Locale; messages: Messages }>({ locale: DEFAULT_LOCALE, messages: {} })

/** Hands the request's language and its catalog to client components; the root layout renders it. */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

/** `t` for client components. */
export function useT(): T {
  const { messages } = useContext(Context)
  return useMemo(() => makeT(messages), [messages])
}

export function useLocale(): Locale {
  return useContext(Context).locale
}
