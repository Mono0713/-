import { afterAll, describe, expect, it } from 'vitest'
import { testDatabase } from '@exam/db'
import { BUILTIN_MODELS } from '@exam/models'
import { measuredPerUnit, monthStart, PostgresUsageStore, spend, SqliteUsageStore, type UsageStore } from '../src/index.ts'

const pg = await testDatabase()
afterAll(() => pg?.drop())

const stores: [string, () => UsageStore][] = [['SqliteUsageStore', () => new SqliteUsageStore(':memory:')]]
if (pg) stores.push(['PostgresUsageStore', () => new PostgresUsageStore(pg.sql)])

describe.each(stores)('%s', (_name, open) => {
  it('adds up calls per task and model, per person, since a moment', async () => {
    const store = open()
    const owner = `o-${Math.random()}`
    await store.record({ ownerId: owner, task: 'recognition', provider: 'claude', model: 'claude-sonnet-5-5', inputTokens: 6000, outputTokens: 3000 })
    await store.record({ ownerId: owner, task: 'recognition', provider: 'claude', model: 'claude-sonnet-5-5', inputTokens: 4000, outputTokens: null })
    await store.record({ ownerId: owner, task: 'grading', provider: 'openai', model: 'gpt-5-nano', inputTokens: 900, outputTokens: 300, units: 10 })
    await store.record({ ownerId: 'someone-else', task: 'grading', provider: 'openai', model: 'gpt-5-nano', inputTokens: 1, outputTokens: 1 })

    const rows = await store.summary(owner, new Date(Date.now() - 60_000))
    expect(rows).toEqual([
      { task: 'grading', provider: 'openai', model: 'gpt-5-nano', calls: 1, units: 10, inputTokens: 900, outputTokens: 300 },
      { task: 'recognition', provider: 'claude', model: 'claude-sonnet-5-5', calls: 2, units: 2, inputTokens: 10000, outputTokens: 3000 },
    ])
    expect(await store.summary(owner, new Date(Date.now() + 60_000))).toEqual([])
  })

  it('adds up only the calls of one scope when asked', async () => {
    const store = open()
    const owner = `o-${Math.random()}`
    await store.record({ ownerId: owner, task: 'grading', provider: 'openai', model: 'gpt-5-nano', inputTokens: 100, outputTokens: 10, scope: 'class:a' })
    await store.record({ ownerId: owner, task: 'grading', provider: 'openai', model: 'gpt-5-nano', inputTokens: 200, outputTokens: 20 })
    const since = new Date(Date.now() - 60_000)
    expect((await store.summary(owner, since, 'class:a')).map((r) => r.inputTokens)).toEqual([100])
    expect((await store.summary(owner, since, 'class:b'))).toEqual([])
    expect((await store.summary(owner, since)).map((r) => r.inputTokens)).toEqual([300])
  })
})

describe('spend and averages', () => {
  const providers = [
    { id: 'claude', label: 'Claude', ready: true, models: BUILTIN_MODELS.claude! },
    { id: 'c-1', label: 'Local', ready: true, models: [] },
  ]
  const rows = [
    { task: 'recognition' as const, provider: 'claude', model: 'claude-sonnet-5-5', calls: 4, units: 4, inputTokens: 20_000, outputTokens: 8_000 },
    { task: 'grading' as const, provider: 'c-1', model: 'local', calls: 1, units: 1, inputTokens: 10, outputTokens: 10 },
  ]

  it('prices what it can and says when a price is missing', () => {
    // 20k × $2 + 8k × $10 per million
    expect(spend(rows, providers)).toEqual({ usd: 0.12, unpriced: true })
    expect(spend(rows.slice(0, 1), providers).unpriced).toBe(false)
  })

  it('averages tokens per unit once there are enough', () => {
    expect(measuredPerUnit(rows, 'recognition', 'claude-sonnet-5-5')).toEqual({ input: 5000, output: 2000 })
    expect(measuredPerUnit(rows, 'grading', 'local')).toBeNull()
  })

  it('starts the month on the first, in UTC', () => {
    expect(monthStart(new Date('2026-10-17T05:00:00Z')).toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })
})
