/**
 * Which sample exams this browser has already been shown, so each visit opens on a new one and
 * all of them come round before any repeats. Read by the server (first sheet), written by the page.
 */
export const SEEN_COOKIE = 'lp_seen'

/** Index of a sample this browser has not seen yet, at random (any sample once all were seen). */
export function pickUnseen(ids: string[], seen: string[], current?: number): number {
  const all = ids.map((_, i) => i).filter((i) => i !== current)
  const fresh = all.filter((i) => !seen.includes(ids[i]!))
  const pool = fresh.length ? fresh : all
  return pool[Math.floor(Math.random() * pool.length)]!
}

/** The cookie's new value once `id` was shown: the list starts over when every sample has been seen. */
export function withSeen(value: string | undefined, id: string, total: number): string {
  const seen = [...new Set([...(value?.split('.').filter(Boolean) ?? []), id])]
  return (seen.length >= total ? [id] : seen).join('.')
}
