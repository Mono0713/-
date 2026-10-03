import { describe, expect, it } from 'vitest'
import { checkServiceUrl, isInternalAddress } from '../src/server/serviceUrl'

describe('isInternalAddress', () => {
  it('flags loopback, private, link-local and mapped addresses', () => {
    for (const a of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isInternalAddress(a), a).toBe(true)
    }
    for (const a of ['1.1.1.1', '104.18.0.1', '2606:4700::1111', '::ffff:8.8.8.8']) expect(isInternalAddress(a), a).toBe(false)
  })
})

describe('checkServiceUrl', () => {
  it('allows a local model when run locally, and trims the trailing slash', async () => {
    expect(await checkServiceUrl('http://localhost:11434/v1/', false)).toBe('http://localhost:11434/v1')
  })

  it('refuses internal or plain-http services when hosted', async () => {
    await expect(checkServiceUrl('http://api.example.com/v1', true)).rejects.toThrow(/https/)
    await expect(checkServiceUrl('https://localhost/v1', true)).rejects.toThrow(/本機/)
    await expect(checkServiceUrl('https://169.254.169.254/latest', true)).rejects.toThrow(/本機/)
    await expect(checkServiceUrl('https://[::1]/v1', true)).rejects.toThrow(/本機/)
    await expect(checkServiceUrl('https://user:pw@1.1.1.1/v1', true)).rejects.toThrow(/帳號密碼/)
    await expect(checkServiceUrl('not a url', true)).rejects.toThrow(/格式/)
  })

  it('accepts a public HTTPS address when hosted', async () => {
    expect(await checkServiceUrl('https://1.1.1.1/v1', true)).toBe('https://1.1.1.1/v1')
  })
})
