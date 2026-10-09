/**
 * Counts attempts per key (a person and what they try) in a sliding window, in this server's memory.
 * Enough for one server: it stops guessing (e.g. class join codes) without a store of its own.
 */
const hits = new Map<string, number[]>()

/** Most keys kept; past that the oldest are dropped so the map cannot grow without end. */
const MAX_KEYS = 10_000

/** Records one attempt; true when `key` already had `max` attempts in the last `windowMs`, so this one is refused. */
export function overLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs)
  const over = recent.length >= max
  if (!over) recent.push(now)
  hits.delete(key)
  hits.set(key, recent)
  if (hits.size > MAX_KEYS) hits.delete(hits.keys().next().value!)
  return over
}
