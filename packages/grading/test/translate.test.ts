import { describe, expect, it } from 'vitest'
import { AiTranslator, parseTranslation, type TextModel } from '../src/index.ts'

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
