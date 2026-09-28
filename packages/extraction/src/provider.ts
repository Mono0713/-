import type { PageImage } from '@exam/core'

/** What every provider adapter receives for one page. */
export interface PageRequest {
  page: PageImage
  system: string
  prompt: string
  /** Strict JSON Schema the reply must follow. */
  jsonSchema: { [key: string]: unknown }
}

/** A provider adapter's raw reply: JSON text the caller validates. */
export interface ProviderReply {
  text: string
  model: string
  usage: { inputTokens: number | null; outputTokens: number | null }
}

/**
 * One vision model provider. Adapters only translate between this shape and the
 * provider's API; prompting and validation live in `extractPage`, so every
 * provider is judged on the same terms.
 */
export interface VisionProvider {
  readonly id: string
  readonly model: string
  complete(request: PageRequest): Promise<ProviderReply>
}

/** The provider answered but declined or cut off; retrying the same call will not help. */
export class ProviderStopError extends Error {
  constructor(
    readonly provider: string,
    readonly reason: string,
    message: string,
  ) {
    super(message)
    this.name = 'ProviderStopError'
  }
}

export function toBase64(page: PageImage): string {
  return page.data.toString('base64')
}
