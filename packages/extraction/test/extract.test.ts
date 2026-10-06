import { describe, expect, it, vi } from 'vitest'
import type { PageImage } from '@exam/core'
import { extractDocument, extractPage, ProviderStopError, retryDelayMs, type PageRequest, type ProviderReply, type VisionProvider } from '../src/index.ts'
import { page, question } from '../../core/test/fixtures.ts'

const image: PageImage = {
  pageNumber: 1,
  mimeType: 'image/png',
  data: Buffer.from('png'),
  width: 10,
  height: 10,
  textLayer: 'Rosalind Franklin',
}

function fakeProvider(replies: (string | Error)[]): VisionProvider & { requests: PageRequest[] } {
  const requests: PageRequest[] = []
  return {
    id: 'fake',
    model: 'fake-1',
    requests,
    complete: vi.fn(async (req: PageRequest): Promise<ProviderReply> => {
      requests.push(req)
      const next = replies.shift()
      if (next instanceof Error) throw next
      return { text: next ?? '', model: 'fake-1', usage: { inputTokens: 10, outputTokens: 5 } }
    }),
  }
}

describe('extractPage', () => {
  it('returns the validated page', async () => {
    const provider = fakeProvider([JSON.stringify(page([question()]))])
    const result = await extractPage(provider, image, 'quiz.pdf')
    expect(result.error).toBeNull()
    expect(result.page?.questions[0]?.answer.values).toEqual(['B'])
    expect(result.attempts).toBe(1)
  })

  it('sends the text layer and the shared schema', async () => {
    const provider = fakeProvider([JSON.stringify(page([]))])
    await extractPage(provider, image, 'quiz.pdf')
    const req = provider.requests[0]!
    expect(req.prompt).toContain('<text_layer>')
    expect(req.prompt).toContain('Rosalind Franklin')
    expect(req.jsonSchema).toMatchObject({ type: 'object', additionalProperties: false })
  })

  it('asks for review notes in the reviewer\'s language', async () => {
    const provider = fakeProvider([JSON.stringify(page([])), JSON.stringify(page([]))])
    await extractPage(provider, image, 'quiz.pdf')
    await extractPage(provider, image, 'quiz.pdf', { reviewLanguage: 'en' })
    expect(provider.requests[0]!.system).toContain('"notes" in Traditional Chinese (繁體中文)')
    expect(provider.requests[1]!.system).toContain('"notes" in English whatever')
  })

  it('retries after a reply that fails validation', async () => {
    const provider = fakeProvider(['{"questions": "nope"}', JSON.stringify(page([question()]))])
    const result = await extractPage(provider, image, 'quiz.pdf')
    expect(result.page).not.toBeNull()
    expect(result.attempts).toBe(2)
  })

  it('reads JSON that has a sentence around it', async () => {
    const provider = fakeProvider([`Here is the page:\n${JSON.stringify(page([question()]))}\nDone.`])
    const result = await extractPage(provider, image, 'quiz.pdf')
    expect(result.page?.questions).toHaveLength(1)
  })

  it('reads a tool call a relay handed back as text', async () => {
    const p = page([question()])
    const fields = Object.entries(p).map(([k, v]) => `<parameter name="${k}">${typeof v === 'string' ? v : JSON.stringify(v)}</parameter>`).join('\n')
    const provider = fakeProvider([`<function_calls>\n<invoke name="extracted_page">\n${fields}\n</invoke>\n</function_calls>`])
    const result = await extractPage(provider, image, 'quiz.pdf')
    expect(result.error).toBeNull()
    expect(result.page?.questions).toHaveLength(1)
  })

  it('fills back fields a compact reply left out because they were empty', async () => {
    const compact = {
      meta: { title: 'Quiz' },
      questions: [{ number: '1', type: 'single_choice', stem: 'Pick one', options: [{ label: 'A', content: 'x' }], answer: { source: 'none' }, bbox: { x: 0.1, y: 0.2, width: 0.8, height: 0.1 }, confidence: 'high' }],
    }
    const result = await extractPage(fakeProvider([JSON.stringify(compact)]), image, 'quiz.pdf')
    expect(result.error).toBeNull()
    expect(result.page?.meta).toEqual({ title: 'Quiz', subject: null, institution: null, term: null, language: null })
    expect(result.page?.groups).toEqual([])
    expect(result.page?.questions[0]).toMatchObject({ section: null, groupId: null, translation: null, answer: { values: [], source: 'none' }, figures: [], issues: [], continuesOnNextPage: false, maxLength: null, markingRule: null })
  })

  it('tells the provider about an off-schema reply before retrying', async () => {
    const invalidReply = vi.fn()
    const provider = { ...fakeProvider(['{"questions": "nope"}', JSON.stringify(page([]))]), invalidReply }
    await extractPage(provider, image, 'quiz.pdf')
    expect(invalidReply).toHaveBeenCalledTimes(1)
  })

  it('reports a failure after running out of retries', async () => {
    const provider = fakeProvider(['not json', 'still not json'])
    const result = await extractPage(provider, image, 'quiz.pdf', { retries: 1 })
    expect(result.page).toBeNull()
    expect(result.error).toMatch(/JSON/)
  })

  it('does not retry when the provider refuses or runs out of tokens', async () => {
    const provider = fakeProvider([new ProviderStopError('fake', 'refusal', 'refused'), JSON.stringify(page([]))])
    const result = await extractPage(provider, image, 'quiz.pdf', { retries: 3 })
    expect(result.page).toBeNull()
    expect(result.attempts).toBe(1)
    expect(result.error).toBe('refused')
  })
})

describe('extractPage client errors', () => {
  it('does not retry a 4xx such as an unknown model', async () => {
    const notFound = Object.assign(new Error('models/old-model is no longer available'), { status: 404 })
    const provider = fakeProvider([notFound, JSON.stringify(page([]))])
    const result = await extractPage(provider, image, 'quiz.pdf', { retries: 2 })
    expect(result.attempts).toBe(1)
    expect(result.error).toMatch(/no longer available/)
  })

  it('waits the suggested delay after a rate limit, then retries', async () => {
    const rateLimited = Object.assign(new Error('Quota exceeded, limit: 5. Please retry in 58.2s.'), { status: 429 })
    const provider = fakeProvider([rateLimited, JSON.stringify(page([]))])
    const sleep = vi.fn(async () => {})
    const result = await extractPage(provider, image, 'quiz.pdf', { sleep })
    expect(result.page).not.toBeNull()
    expect(result.attempts).toBe(2)
    expect(sleep).toHaveBeenCalledWith(58_200)
  })

  it('backs off exponentially on 5xx without a suggested delay', async () => {
    const busy = () => Object.assign(new Error('high demand'), { status: 503 })
    const provider = fakeProvider([busy(), busy(), JSON.stringify(page([]))])
    const sleep = vi.fn(async () => {})
    const result = await extractPage(provider, image, 'quiz.pdf', { sleep })
    expect(result.page).not.toBeNull()
    expect(sleep.mock.calls.map((c) => (c as unknown[])[0])).toEqual([5_000, 10_000])
  })

  it('gives up after busyRetries', async () => {
    const busy = () => Object.assign(new Error('high demand'), { status: 503 })
    const provider = fakeProvider([busy(), busy(), busy()])
    const result = await extractPage(provider, image, 'quiz.pdf', { busyRetries: 2, sleep: async () => {} })
    expect(result.page).toBeNull()
    expect(result.attempts).toBe(3)
  })

  it('does not wait on a quota of zero', async () => {
    const noQuota = Object.assign(new Error('free_tier_requests, limit: 0, model: pro. Please retry in 22s.'), { status: 429 })
    const provider = fakeProvider([noQuota])
    const sleep = vi.fn(async () => {})
    const result = await extractPage(provider, image, 'quiz.pdf', { sleep })
    expect(result.attempts).toBe(1)
    expect(sleep).not.toHaveBeenCalled()
  })
})

describe('extractDocument', () => {
  it('only runs the requested pages', async () => {
    const provider = fakeProvider([JSON.stringify(page([])), JSON.stringify(page([]))])
    const doc = { fileName: 'quiz.pdf', kind: 'pdf' as const, pages: [1, 2, 3].map((n) => ({ ...image, pageNumber: n })) }
    const results = await extractDocument(provider, doc, { pages: [3] })
    expect(results.map((r) => r.pageNumber)).toEqual([3])
  })
})

describe('retryDelayMs', () => {
  it('reads both Gemini delay formats', () => {
    expect(retryDelayMs('Please retry in 21.3s.')).toBe(21_300)
    expect(retryDelayMs('{"retryDelay":"58s"}')).toBe(58_000)
    expect(retryDelayMs('try later')).toBeNull()
  })
})
