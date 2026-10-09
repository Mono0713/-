import { describe, expect, it } from 'vitest'
import { keyTrouble, withKeys } from '../src/keys.ts'

const status = (code: number, message = 'error') => Object.assign(new Error(message), { status: code })

describe('withKeys', () => {
  it('moves to the next key when one is out of quota, and starts from it next time', async () => {
    const used: string[] = []
    const call = async (key: string) => {
      used.push(key)
      if (key === 'a') throw status(429)
      return key
    }
    expect(await withKeys('quota', ['a', 'b', 'c'], call)).toBe('b')
    expect(await withKeys('quota', ['a', 'b', 'c'], call)).toBe('b')
    expect(used).toEqual(['a', 'b', 'b'])
  })

  it('throws a request error at once instead of trying every key', async () => {
    const used: string[] = []
    const call = async (key: string) => {
      used.push(key)
      throw status(400, 'bad image')
    }
    await expect(withKeys('bad', ['a', 'b'], call)).rejects.toThrow('bad image')
    expect(used).toEqual(['a'])
  })

  it('throws the last error when every key is refused', async () => {
    await expect(withKeys('all', ['a', 'b'], async (k) => Promise.reject(status(401, `no ${k}`)))).rejects.toThrow('no b')
  })
})

describe('keyTrouble', () => {
  it('knows quota and key messages from relays without a status', () => {
    expect(keyTrouble(new Error('insufficient_quota'))).toBe(true)
    expect(keyTrouble(new Error('余额不足'))).toBe(true)
    expect(keyTrouble(new Error('model not found'))).toBe(false)
  })
})
