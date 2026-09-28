'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Re-renders the page from the server every few seconds while a background run is going. */
export function AutoRefresh({ everyMs = 1500 }: { everyMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), everyMs)
    return () => clearInterval(timer)
  }, [router, everyMs])
  return null
}
