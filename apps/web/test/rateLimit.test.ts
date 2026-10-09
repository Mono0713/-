import { describe, expect, it } from 'vitest'
import { overLimit } from '../src/server/rateLimit'
import { signInMissing } from '../src/server/signInCheck'

describe('overLimit', () => {
  it('refuses once the window holds the most attempts, and lets them through again later', () => {
    const key = `test:${Math.random()}`
    for (let i = 0; i < 3; i++) expect(overLimit(key, 3, 1000, 10_000 + i)).toBe(false)
    expect(overLimit(key, 3, 1000, 10_500)).toBe(true)
    expect(overLimit(key, 3, 1000, 11_100)).toBe(false)
  })
})

describe('signInMissing', () => {
  const env = (vars: Record<string, string | undefined>, fn: () => void) => {
    const before = { ...process.env }
    Object.assign(process.env, vars)
    for (const [k, v] of Object.entries(vars)) if (v === undefined) delete process.env[k]
    try {
      fn()
    } finally {
      process.env = before
    }
  }
  const hosted = { NODE_ENV: 'production', DATABASE_URL: 'postgres://db', NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined, ALLOW_SINGLE_USER: undefined }

  it('stops a hosted server that has a database but no sign-in', () => env(hosted, () => expect(signInMissing()).toBe(true)))
  it('lets a server with sign-in through', () => env({ ...hosted, NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' }, () => expect(signInMissing()).toBe(false)))
  it('lets the local single-person app through', () => env({ ...hosted, DATABASE_URL: undefined }, () => expect(signInMissing()).toBe(false)))
  it('lets a one-person server through when asked for', () => env({ ...hosted, ALLOW_SINGLE_USER: '1' }, () => expect(signInMissing()).toBe(false)))
})
