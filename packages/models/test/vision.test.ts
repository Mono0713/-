import { describe, expect, it } from 'vitest'
import { guessVision } from '../src/index.ts'

describe('guessVision', () => {
  it('knows the TokenHub models', () => {
    for (const id of ['glm-5.3-flash', 'glm-5.3-flashx', 'deepseek-v4.1-flash', 'deepseek/deepseek-flash', 'deepseek/deepseek-v4-flash-vision-exp', 'mimo-v2.6-flash', 'mimo-v2.6-pro', 'kimi-k3', 'kimi-k2.6', 'kimi-k2.8-preview', 'minimax-m3', 'glm-5v-turbo', 'step-5-preview'])
      expect(guessVision(id), id).toBe(true)
    for (const id of ['hy3', 'hy4-preview', 'hy-mt2-pro', 'minimax-m2.7', 'deepseek-v4-pro-0813', 'deepseek/deepseek-v4-pro', 'deepseek-v4-flash', 'glm-5.3', 'glm-5.2', 'mimo-v2.5-pro', 'kinfra-text-embedding-4b'])
      expect(guessVision(id), id).toBe(false)
  })

  it('knows the usual vision families behind relays', () => {
    for (const id of ['claude-sonnet-5-5', 'anthropic/claude-haiku-4-5', 'gpt-5-mini', 'gemini-3.8-flash', 'qwen3-vl-plus', 'meta-llama/llama-4-maverick'])
      expect(guessVision(id), id).toBe(true)
  })

  it('leaves names it does not know to a test call', () => {
    expect(guessVision('qwen3.8-flash')).toBeNull()
    expect(guessVision('my-local-model')).toBeNull()
  })
})
