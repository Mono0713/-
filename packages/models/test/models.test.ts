import { describe, expect, it } from 'vitest'
import { BUILTIN_MODELS, formatUsd, nearest, route, routeCost, type ProviderInfo } from '../src/index.ts'

const builtin = (id: string, ready = true): ProviderInfo => ({ id, label: id, ready, models: BUILTIN_MODELS[id]! })

describe('route', () => {
  it('follows the strength table on one provider', () => {
    const claude = [builtin('claude')]
    expect(route('recognition', 'save', claude)).toMatchObject({ primary: { model: 'claude-haiku-4-5-20251001' }, escalate: null })
    expect(route('recognition', 'balanced', claude)).toMatchObject({ primary: { model: 'claude-sonnet-5-5' }, escalate: { model: 'claude-opus-5-5' } })
    expect(route('recognition', 'best', claude)).toMatchObject({ primary: { model: 'claude-opus-5-5' }, escalate: null })
    expect(route('grading', 'balanced', claude)?.primary.model).toBe('claude-haiku-4-5-20251001')
    expect(route('grading', 'best', claude)?.primary.model).toBe('claude-sonnet-5-5')
  })

  it('puts the cheapest provider first and keeps the others as fallbacks', () => {
    const r = route('grading', 'save', [builtin('claude'), builtin('gemini'), builtin('openai')])!
    expect(r.primary).toEqual({ provider: 'openai', model: 'gpt-5-nano' })
    // Gemini's fast model has no known price yet, so it comes after the ones that do
    expect(r.fallbacks.map((f) => f.provider)).toEqual(['claude', 'gemini'])
  })

  it('skips providers without a key and returns null when none is left', () => {
    expect(route('grading', 'save', [builtin('openai', false), builtin('claude')])?.primary.provider).toBe('claude')
    expect(route('grading', 'save', [builtin('openai', false)])).toBeNull()
  })

  it('honours an override while its provider has a key, without escalating', () => {
    const providers = [builtin('claude'), builtin('openai')]
    const r = route('recognition', 'balanced', providers, { override: { provider: 'claude', model: 'claude-opus-5' } })!
    expect(r.primary).toEqual({ provider: 'claude', model: 'claude-opus-5' })
    expect(r.escalate).toBeNull()
    expect(r.fallbacks).toEqual([{ provider: 'openai', model: 'gpt-5-mini' }])
    expect(route('recognition', 'balanced', [builtin('openai')], { override: { provider: 'claude', model: 'x' } })?.primary.provider).toBe('openai')
  })

  it('reads images only with models that can see', () => {
    const custom: ProviderInfo = {
      id: 'c-1',
      label: 'Local',
      ready: true,
      models: [
        { id: 'text-only', label: 'text-only', tier: 'fast', vision: false, price: null },
        { id: 'sees', label: 'sees', tier: 'best', vision: true, price: null },
      ],
    }
    expect(route('recognition', 'save', [custom])?.primary.model).toBe('sees')
    expect(route('grading', 'save', [custom])?.primary.model).toBe('text-only')
  })
})

describe('nearest', () => {
  it('uses the closest tier, preferring the more capable one', () => {
    const [best, , fast] = BUILTIN_MODELS.openai!
    expect(nearest([best!, fast!], 'balanced')?.id).toBe('gpt-5')
    expect(nearest([fast!], 'best')?.id).toBe('gpt-5-nano')
  })
})

describe('cost', () => {
  it('estimates a routed task, escalation included', () => {
    const providers = [builtin('claude')]
    const save = routeCost(route('recognition', 'save', providers)!, providers, 10)!
    const balanced = routeCost(route('recognition', 'balanced', providers)!, providers, 10)!
    // Haiku: 10 pages × (6000 × $1 + 3000 × $5) / 1M
    expect(save).toBeCloseTo(0.21)
    expect(balanced).toBeGreaterThan(save)
    expect(routeCost(route('recognition', 'save', providers)!, providers, 10, { input: 3000, output: 1000 })).toBeCloseTo(0.08)
  })

  it('formats small sums', () => {
    expect(formatUsd(0.0042)).toBe('US$0.004')
    expect(formatUsd(0.214)).toBe('US$0.21')
    expect(formatUsd(3.5)).toBe('US$3.50')
  })
})
