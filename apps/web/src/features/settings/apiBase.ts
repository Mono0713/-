import { listModels } from '@exam/extraction'

/**
 * The models an OpenAI-compatible service lists, and the address that listed them. People often paste the
 * service's web page (…/keys, …/console) instead of its API address, so when that lists nothing, the usual
 * …/v1 addresses on the same site are tried too. Throws the first error when every address fails.
 */
export async function modelsAt(baseUrl: string, key: string): Promise<{ known: string[]; baseUrl: string }> {
  const url = new URL(baseUrl)
  const candidates = [baseUrl]
  if (!/\/v\d+$/.test(url.pathname.replace(/\/+$/, ''))) {
    for (const path of ['/v1', `${url.pathname.replace(/\/+$/, '')}/v1`]) {
      const next = `${url.origin}${path}`
      if (!candidates.includes(next)) candidates.push(next)
    }
  }
  let firstError: unknown = null
  for (const candidate of candidates) {
    try {
      const known = await listModels('custom', key, candidate)
      if (known.length) return { known, baseUrl: candidate }
    } catch (err) {
      firstError ??= err
    }
  }
  if (firstError) throw firstError
  return { known: [], baseUrl }
}

/** True when an address doesn't end in a version like /v1, which nearly every API address does. */
export const looksLikeWebPage = (baseUrl: string) => !/\/v\d+\/?$/.test(new URL(baseUrl).pathname)
