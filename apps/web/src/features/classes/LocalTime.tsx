'use client'

/**
 * A moment in the reader's own time zone (the server may run in another one).
 * The first paint can differ from the server's text, which React lets through here.
 */
export function LocalTime({ at, withYear = false }: { at: string; withYear?: boolean }) {
  const d = new Date(at)
  const text = d.toLocaleString('zh-TW', { ...(withYear && { year: 'numeric' }), month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <time dateTime={at} suppressHydrationWarning>
      {text}
    </time>
  )
}
