import { describe, expect, it } from 'vitest'
import { AiTranslator, FreeTranslator, parseTranslation, type TextModel } from '../src/index.ts'
import { protect, restore } from '../src/translate.ts'

describe('AiTranslator', () => {
  it('translates the stem and each option into the chosen language', async () => {
    const calls: { system: string; prompt: string }[] = []
    const model: TextModel = {
      provider: 'fake',
      model: 'fake-1',
      complete: async (system, prompt) => (calls.push({ system, prompt }), '{"stem":"引子由哪個酵素合成？","options":["連接酶","引子酶"]}'),
    }
    const result = await new AiTranslator(model).translate(
      { stem: 'Primer is synthesized by the enzyme ____.', options: [{ label: '1', content: 'Ligases' }, { label: '2', content: 'Primase' }] },
      'zh-Hant',
    )
    expect(result).toEqual({ stem: '引子由哪個酵素合成？', options: ['連接酶', '引子酶'] })
    expect(calls[0]!.system).toContain('Traditional Chinese')
    expect(calls[0]!.prompt).toContain('Option 2 (2):\nPrimase')
  })

  it('keeps one entry per option and refuses an empty reply', () => {
    expect(parseTranslation('ok {"stem":"題目","options":["一"]}', 3)).toEqual({ stem: '題目', options: ['一', '', ''] })
    expect(() => parseTranslation('{"stem":" "}', 0)).toThrow()
    expect(() => parseTranslation('sorry', 0)).toThrow()
  })
})

describe('FreeTranslator', () => {
  const q = { stem: 'Solve $x^2 = 4$ and fill ____.', options: [{ label: 'A', content: 'Two roots' }, { label: 'B', content: '$x = 2$' }] }

  it('asks Google for the stem and each option, keeping maths and blanks as written', async () => {
    const urls: string[] = []
    const fetcher = async (url: string) => {
      urls.push(url)
      const text = new URL(url).searchParams.get('q')!
      const out = text === 'Two roots' ? '兩個根' : '解 {0} 並填入 {1}。'
      return { ok: true, status: 200, json: async () => [[[out, text, null, null]], null, 'en'] }
    }
    const result = await new FreeTranslator(fetcher).translate(q, 'zh-Hant')
    expect(result).toEqual({ stem: '解 $x^2 = 4$ 並填入 ____。', options: ['兩個根', '$x = 2$'] })
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain('tl=zh-TW')
  })

  it('falls back to MyMemory when Google refuses', async () => {
    const fetcher = async (url: string) =>
      url.includes('googleapis')
        ? { ok: false, status: 429, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({ responseStatus: 200, responseData: { translatedText: '譯文' } }) }
    const result = await new FreeTranslator(fetcher).translate({ stem: 'Hello world', options: [] }, 'zh-Hant')
    expect(result).toEqual({ stem: '譯文', options: [] })
  })

  it('fails when both services fail', async () => {
    const fetcher = async () => ({ ok: false, status: 503, json: async () => ({}) })
    await expect(new FreeTranslator(fetcher).translate({ stem: 'Hello world', options: [] }, 'en')).rejects.toThrow()
  })
})

describe('protect / restore', () => {
  it('round-trips maths, code and blanks, even with spaces added around the placeholder', () => {
    const { masked, kept } = protect('Let $a$ be `n` and $$b$$ ____')
    expect(masked).toBe('Let {0} be {1} and {2} {3}')
    expect(restore('令 { 0 } 為 {1}，{2} {3}', kept)).toBe('令 $a$ 為 `n`，$$b$$ ____')
  })
})
