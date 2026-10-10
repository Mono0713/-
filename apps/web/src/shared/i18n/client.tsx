'use client'

import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from 'react'
import { makeT, type Messages, type T } from './format'
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales'

interface I18n {
  locale: Locale
  messages: Messages
  /** The language being switched to while the server re-renders the page, else the current one. */
  target: Locale
  /** Switches the interface language; the whole page changes together once the server has re-rendered it. */
  switchTo: (locale: string) => void
  switching: boolean
}

const Context = createContext<I18n>({
  locale: DEFAULT_LOCALE,
  messages: {},
  target: DEFAULT_LOCALE,
  switchTo: () => {},
  switching: false,
})

/** Hands the request's language and its catalog to client components; the root layout renders it. */
export function I18nProvider({
  locale,
  messages,
  save,
  children,
}: {
  locale: Locale
  messages: Messages
  /** Remembers the choice and re-renders the server's part of the page in it. */
  save: (locale: string) => Promise<void>
  children: ReactNode
}) {
  const [switching, start] = useTransition()
  const [target, setTarget] = useState<Locale>(locale)

  const value = useMemo<I18n>(
    () => ({
      locale,
      messages,
      // client text keeps the server's language, so nothing on the page is half switched
      target: switching ? target : locale,
      switching,
      switchTo: (next) => {
        if (!isLocale(next) || next === locale) return
        setTarget(next)
        start(() => save(next))
      },
    }),
    [locale, messages, target, switching, save],
  )
  return (
    <Context.Provider value={value}>
      {children}
      {switching && <div aria-hidden className="m-loading-bar fixed inset-x-0 top-0 z-[100] h-0.5" />}
    </Context.Provider>
  )
}

/** `t` for client components. */
export function useT(): T {
  const { messages } = useContext(Context)
  return useMemo(() => makeT(messages), [messages])
}

export function useLocale(): Locale {
  return useContext(Context).locale
}

/** Changing the interface language, for the language picker. */
export function useLocaleSwitch(): { target: Locale; switchTo: (locale: string) => void } {
  const { target, switchTo } = useContext(Context)
  return { target, switchTo }
}
