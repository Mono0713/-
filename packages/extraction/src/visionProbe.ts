import OpenAI from 'openai'

// A plain orange square, 64 × 64. Orange is an unlikely guess for a model that cannot see it.
const ORANGE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAATUlEQVR42u3PQQkAAAgEsOuPnb0IvoXBCiw7eS0CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApcCCQexaQtDixEAAAAASUVORK5CYII='

// Refusals that mean the model takes no pictures (rather than a bad key or a busy service).
const NO_PICTURES = /image|vision|multimodal|multi-modal|modalit|image_url|content.*(type|part)|unsupported.*(input|content)/i

export interface ProbeTarget {
  baseUrl: string
  apiKey?: string
  model: string
  client?: OpenAI
}

/**
 * Shows the model a small orange picture and asks its color: true when it answers orange, false
 * when it refuses pictures or names something else, null when the call failed for another reason
 * (key, quota, network) and nothing can be told. Costs a few hundred tokens at most.
 */
export async function probeVision(target: ProbeTarget, timeoutMs = 45_000): Promise<boolean | null> {
  const client = target.client ?? new OpenAI({ apiKey: target.apiKey || 'none', baseURL: target.baseUrl, timeout: timeoutMs, maxRetries: 0 })
  try {
    const response = await client.chat.completions.create({
      model: target.model,
      // Room for models that think before answering.
      max_tokens: 2_000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/png;base64,${ORANGE_PNG}` } },
            { type: 'text', text: 'What single color fills this picture? Answer with one English word. If you cannot see a picture, answer "none".' },
          ],
        },
      ],
    })
    const answer = response?.choices?.[0]?.message?.content
    if (typeof answer !== 'string' || !answer.trim()) return null
    return /orange|橙|橘/i.test(answer)
  } catch (err) {
    const status = (err as { status?: number })?.status
    const text = err instanceof Error ? err.message : String(err)
    if ((status === 400 || status === 422) && NO_PICTURES.test(text)) return false
    return null
  }
}
