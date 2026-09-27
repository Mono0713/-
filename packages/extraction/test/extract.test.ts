import { describe, expect, it, vi } from 'vitest'
import type { PageImage } from '@exam/core'
import { extractPage, ProviderStopError, type PageRequest, type ProviderReply, type VisionProvider } from '../src/index.ts'
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

  it('retries after a reply that fails validation', async () => {
    const provider = fakeProvider(['{"questions": "nope"}', JSON.stringify(page([question()]))])
    const result = await extractPage(provider, image, 'quiz.pdf')
    expect(result.page).not.toBeNull()
    expect(result.attempts).toBe(2)
  })

  it('reports a failure after running out of retries', async () => {
    const provider = fakeProvider(['not json', 'still not json'])
    const result = await extractPage(provider, image, 'quiz.pdf', 1)
    expect(result.page).toBeNull()
    expect(result.error).toMatch(/JSON/)
  })

  it('does not retry when the provider refuses or runs out of tokens', async () => {
    const provider = fakeProvider([new ProviderStopError('fake', 'refusal', 'refused'), JSON.stringify(page([]))])
    const result = await extractPage(provider, image, 'quiz.pdf', 3)
    expect(result.page).toBeNull()
    expect(result.attempts).toBe(1)
    expect(result.error).toBe('refused')
  })
})
