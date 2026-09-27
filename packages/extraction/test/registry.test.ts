import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProvider, GEMINI_DEFAULT_MODEL } from '../src/index.ts'

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

  it('rejects unknown providers', () => {
    expect(() => createProvider('nope')).toThrow(/Unknown provider/)
  })
})
