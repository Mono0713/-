/**
 * Several API keys for one service: calls start with the key that worked last time and move on to the
 * next when a key is out of quota, rate limited or refused. Any other error is the request's own and
 * is thrown at once, so a bad request is not sent once per key.
 */

// Which key worked last, per set of keys, for as long as the server runs.
const lastGood = new Map<string, number>()

/** The service turned the key away: invalid, no permission, out of credit or quota, or rate limited. */
export function keyTrouble(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status
  if (status === 401 || status === 402 || status === 403 || status === 429) return true
  const message = err instanceof Error ? err.message : String(err)
  return /quota|insufficient|balance|credit|rate.?limit|exhausted|api.?key|額度|余额|餘額|欠费|欠費/i.test(message)
}

/**
 * Runs `call` with one of `items` (one per key), starting from the one that worked last for `id`
 * and trying the next while the key is the trouble. One item: just calls it.
 */
export async function withKeys<T, R>(id: string, items: T[], call: (item: T) => Promise<R>): Promise<R> {
  if (items.length < 2) return call(items[0]!)
  const start = (lastGood.get(id) ?? 0) % items.length
  let error: unknown
  for (let i = 0; i < items.length; i++) {
    const at = (start + i) % items.length
    try {
      const result = await call(items[at]!)
      lastGood.set(id, at)
      return result
    } catch (err) {
      if (!keyTrouble(err)) throw err
      error = err
    }
  }
  throw error
}

/** A name for a set of keys that does not hold the keys themselves. */
export function keySetId(provider: string, keys: string[]): string {
  return `${provider}:${keys.map((k) => k.slice(-6)).join(',')}`
}
