'use client'

import { useEffect, useState } from 'react'

/**
 * Prints the full-size pages: `printing` mounts them (outside the app, see `.a4-print` in globals.css),
 * their pictures finish loading, then the browser's print dialog opens, where 另存為 PDF saves the file.
 * The page title is the exam's while printing, so the PDF is named after it.
 */
export function usePrint(title: string) {
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    if (!printing) return
    let cancelled = false
    const before = document.title
    const done = () => {
      document.title = before
      setPrinting(false)
    }
    window.addEventListener('afterprint', done, { once: true })
    const images = [...document.querySelectorAll<HTMLImageElement>('.a4-print img')]
    Promise.all(images.map((img) => img.decode().catch(() => undefined))).then(() => {
      if (cancelled) return
      document.title = title
      window.print()
    })
    return () => {
      cancelled = true
      window.removeEventListener('afterprint', done)
      document.title = before
    }
  }, [printing, title])
  return { printing, print: () => setPrinting(true) }
}
