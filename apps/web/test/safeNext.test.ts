import { describe, expect, it } from 'vitest'
import { safeNext } from '../src/shared/safeNext'

describe('safeNext', () => {
  it('keeps paths on this site', () => {
    expect(safeNext('/quiz/abc?x=1#q2')).toBe('/quiz/abc?x=1#q2')
    expect(safeNext('/')).toBe('/')
  })

  it('refuses anything that leaves the site', () => {
    for (const next of ['//evil.example', '/\\evil.example', '/\\/evil.example', 'https://evil.example', 'evil.example', '', null, 3]) expect(safeNext(next)).toBe('/')
  })
})
