'use client'

import { createContext, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { makeT, type Messages, type T } from './format'
import { LOADERS } from './loaders'
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales'

interface I18n {
  locale: Locale
  messages: Messages
  /** Switches the interface language: the screen changes at once, the server catches up behind a loading bar. */
  switchTo: (locale: string) => void
  switching: boolean
}

const Context = createContext<I18n>({ locale: DEFAULT_LOCALE, messages: {}, switchTo: () => {}, switching: false })

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
  const [shown, setShown] = useState({ locale, messages })
  // the server's page has caught up (or another tab changed it)
  useEffect(() => setShown({ locale, messages }), [locale, messages])
  const [switching, start] = useTransition()

  const value = useMemo<I18n>(
    () => ({
      ...shown,
      switching,
      switchTo: (next) => {
        if (!isLocale(next)) return
        // what the browser draws changes right away; text drawn by the server follows when the save returns
        void LOADERS[next]().then((catalog) => {
          setShown({ locale: next, messages: catalog })
          document.documentElement.lang = next
        })
        start(() => save(next))
      },
    }),
    [shown, switching, save],
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
export function useLocaleSwitch(): { switchTo: (locale: string) => void; switching: boolean } {
  const { switchTo, switching } = useContext(Context)
  return { switchTo, switching }
}
