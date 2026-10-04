import { describe, expect, it } from 'vitest'
import { catalog, compare, scan, TARGETS } from '../scripts/i18n'
import { fill, makeT } from '../src/shared/i18n/format'
import { fromAcceptLanguage } from '../src/shared/i18n/locales'

describe('interface text', () => {
  const found = scan()

  it('passes every Chinese text through t() or msg()', () => {
    expect(found.leftovers).toEqual([])
    expect(found.problems).toEqual([])
  })

  it.each(TARGETS)('has every text translated to %s, with the same {placeholders} and <tags>', (locale) => {
    const result = compare(found.keys.keys(), catalog(locale))
    expect(result.missing).toEqual([])
    expect(result.mismatched).toEqual([])
  })
})

describe('t', () => {
  it('looks the text up, fills placeholders and falls back to the text itself', () => {
    const t = makeT({ '還有 {n} 題': '{n} left' })
    expect(t('還有 {n} 題', { n: 3 })).toBe('3 left')
    expect(t('沒翻到的字')).toBe('沒翻到的字')
    expect(fill('從第一個 { 到最後一個 }')).toBe('從第一個 { 到最後一個 }')
  })

  it('picks the interface language from the browser', () => {
    expect(fromAcceptLanguage('zh-CN,zh;q=0.9,en;q=0.8')).toBe('zh-Hans')
    expect(fromAcceptLanguage('zh-TW,zh;q=0.9')).toBe('zh-Hant')
    expect(fromAcceptLanguage('fr-FR,ja;q=0.7,en;q=0.5')).toBe('ja')
    expect(fromAcceptLanguage('fr-FR')).toBeNull()
  })
})
