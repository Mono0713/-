/**
 * Several API keys for one service, in the order the person put them: calls use the top key and move
 * down to the next when a key is out of quota, rate limited or refused. A key that was turned away
 * rests for a while (tried last) so each call does not spend a failed request on it first; after the
 * rest it is first again. Any other error is the request's own and is thrown at once, so a bad request
 * is not sent once per key.
 */

/** How long a key that was turned away is tried last. */
export const KEY_REST_MS = 10 * 60_000

// When each resting key (by `keyName`) may lead again, for as long as the server runs.
const resting = new Map<string, number>()

/** The service turned the key away: invalid, no permission, out of credit or quota, or rate limited. */
export function keyTrouble(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status
  if (status === 401 || status === 402 || status === 403 || status === 429) return true
  const message = err instanceof Error ? err.message : String(err)
  return /quota|insufficient|balance|credit|rate.?limit|exhausted|api.?key|額度|余额|餘額|欠费|欠費/i.test(message)
}

/** A name for one key that does not hold the key itself. */
export function keyName(provider: string, key: string): string {
  return `${provider}:${key.slice(-6)}`
}

/**
 * Runs `call` with `items` (one per key, top first, named by `names`): resting keys go last, and the
 * next key is tried while the key is the trouble. One item: just calls it.
 */
export async function withKeys<T, R>(names: string[], items: T[], call: (item: T) => Promise<R>, now = Date.now): Promise<R> {
  if (items.length < 2) return call(items[0]!)
  const rests = (i: number) => (resting.get(names[i]!) ?? 0) > now()
  const indexes = items.map((_, i) => i)
  const order = [...indexes.filter((i) => !rests(i)), ...indexes.filter(rests)]
  let error: unknown
  for (const i of order) {
    try {
      const result = await call(items[i]!)
      resting.delete(names[i]!)
      return result
    } catch (err) {
      if (!keyTrouble(err)) throw err
      resting.set(names[i]!, now() + KEY_REST_MS)
      error = err
    }
  }
  throw error
}
