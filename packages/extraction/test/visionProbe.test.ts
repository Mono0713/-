import type OpenAI from 'openai'
import { describe, expect, it } from 'vitest'
import { probeVision } from '../src/index.ts'

const answering = (content: string | null) => ({ chat: { completions: { create: async () => ({ choices: [{ message: { content } }] }) } } }) as unknown as OpenAI
const failing = (status: number, message: string) =>
  ({ chat: { completions: { create: async () => { throw Object.assign(new Error(message), { status }) } } } }) as unknown as OpenAI
const probe = (client: OpenAI) => probeVision({ baseUrl: 'https://x/v1', model: 'm', client })

describe('probeVision', () => {
  it('reads pictures when it names the color', async () => {
    expect(await probe(answering('Orange'))).toBe(true)
    expect(await probe(answering('橘色'))).toBe(true)
  })
  it('does not when it names something else or refuses pictures', async () => {
    expect(await probe(answering('none'))).toBe(false)
    expect(await probe(failing(400, 'Model does not support image input'))).toBe(false)
  })
  it('cannot tell when the call fails for another reason', async () => {
    expect(await probe(failing(401, 'invalid api key'))).toBeNull()
    expect(await probe(failing(429, 'rate limited'))).toBeNull()
    expect(await probe(answering(''))).toBeNull()
  })
})
