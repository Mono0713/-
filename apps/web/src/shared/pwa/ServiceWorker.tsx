'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker that makes the site installable. Only the production build uses
 * it; under `pnpm dev` any worker left over from `pnpm preview` is removed so edits show at once.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    } else {
      navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => r.unregister()))
    }
  }, [])
  return null
}
