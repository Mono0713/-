'use client'

import { useEffect } from 'react'

/**
 * While `active`, prints the full-size pages (mounted outside the app, see `.a4-print` in globals.css):
 * once they are laid out again for the copy asked for and their pictures have loaded, the browser's print
 * dialog opens, where 另存為 PDF saves the file. The page title is the exam's while printing, so the PDF is
 * named after it. `done` runs when the dialog closes.
 */
export function usePrint(title: string, active: boolean, done: () => void) {
  useEffect(() => {
    if (!active) return
    let cancelled = false
    const before = document.title
    const finish = () => {
      document.title = before
      done()
    }
    window.addEventListener('afterprint', finish, { once: true })
    // two frames: the pages of the chosen copy are measured and placed again first
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const images = [...document.querySelectorAll<HTMLImageElement>('.a4-print img')]
        Promise.all(images.map((img) => img.decode().catch(() => undefined))).then(() => {
          if (cancelled) return
          document.title = title
          window.print()
        })
      }),
    )
    return () => {
      cancelled = true
      window.removeEventListener('afterprint', finish)
      document.title = before
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
