'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'

/**
 * Re-renders the page from the server every few seconds while a background run is going.
 * The next refresh waits for the last one to arrive: a page that takes longer to render than the
 * interval (the editor that replaces the progress screen) would otherwise be cut off by every
 * new refresh and never show.
 */
export function AutoRefresh({ everyMs = 1500 }: { everyMs?: number }) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  useEffect(() => {
    if (refreshing) return
    const timer = setTimeout(() => startRefresh(() => router.refresh()), everyMs)
    return () => clearTimeout(timer)
  }, [router, everyMs, refreshing])
  return null
}
