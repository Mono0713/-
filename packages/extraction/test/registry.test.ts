import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProvider, GEMINI_DEFAULT_MODEL, OpenAICompatibleProvider } from '../src/index.ts'

describe('createProvider', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses the adapter default when nothing is configured', () => {
    vi.stubEnv('GEMINI_MODEL', '')
    expect(createProvider('gemini', { apiKey: 'k' }).model).toBe(GEMINI_DEFAULT_MODEL)
  })

  it('takes the model from <ID>_MODEL in the environment', () => {
    vi.stubEnv('GEMINI_MODEL', 'gemini-next')
    expect(createProvider('gemini', { apiKey: 'k' }).model).toBe('gemini-next')
  })

  it('lets an explicit model win over the environment', () => {
    vi.stubEnv('GEMINI_MODEL', 'gemini-next')
    expect(createProvider('gemini', { apiKey: 'k', model: 'gemini-pinned' }).model).toBe('gemini-pinned')
  })

  it('makes any provider with a base URL an OpenAI-compatible one', () => {
    const p = createProvider('c-local', { baseUrl: 'http://localhost:11434/v1', model: 'llava' })
    expect(p).toBeInstanceOf(OpenAICompatibleProvider)
    expect([p.id, p.model]).toEqual(['c-local', 'llava'])
  })

  it('rejects unknown providers', () => {
    expect(() => createProvider('nope')).toThrow(/Unknown provider/)
  })
})
