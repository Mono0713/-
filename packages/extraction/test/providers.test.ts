import { describe, expect, it, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import type { GoogleGenAI } from '@google/genai'
import type OpenAI from 'openai'
import type { PageImage } from '@exam/core'
import { ClaudeProvider, GeminiProvider, OpenAICompatibleProvider, OpenAIProvider, ProviderStopError, type PageRequest } from '../src/index.ts'

/** First argument of the first call to a mocked SDK method. */
function firstArg<T>(fn: { mock: { calls: unknown[][] } }): T {
  return fn.mock.calls[0]![0] as T
}

const request: PageRequest = {
  page: { pageNumber: 1, mimeType: 'image/png', data: Buffer.from('img'), width: 1, height: 1, textLayer: null } satisfies PageImage,
  system: 'SYSTEM',
  prompt: 'PROMPT',
  jsonSchema: { type: 'object' },
}

describe('ClaudeProvider', () => {
  function client(message: object) {
    const stream = vi.fn(() => ({ finalMessage: async () => message }))
    return { client: { messages: { stream } } as unknown as Anthropic, stream }
  }

  it('sends the image with the schema as structured output and returns the text', async () => {
    const { client: c, stream } = client({
      model: 'claude-opus-5',
      stop_reason: 'end_turn',
      content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 100, output_tokens: 20 },
    })
    const reply = await new ClaudeProvider({ client: c }).complete(request)
    expect(reply).toEqual({ text: '{"ok":true}', model: 'claude-opus-5', usage: { inputTokens: 100, outputTokens: 20 } })
    const params = firstArg<Anthropic.MessageCreateParams>(stream)
    expect(params.model).toBe('claude-opus-5')
    expect(params.system).toBe('SYSTEM')
    expect(params.output_config?.format).toEqual({ type: 'json_schema', schema: { type: 'object' } })
    expect(params.messages[0]!.content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from('img').toString('base64') } },
      { type: 'text', text: 'PROMPT' },
    ])
  })

  it('reads with Haiku without adaptive thinking or effort, which it does not take', async () => {
    const { client: c, stream } = client({ model: 'claude-haiku-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }], usage: { input_tokens: 1, output_tokens: 1 } })
    await new ClaudeProvider({ client: c, model: 'claude-haiku-4-5' }).complete(request)
    const params = firstArg<Anthropic.MessageCreateParams>(stream)
    expect(params.thinking).toBeUndefined()
    expect(params.output_config).toEqual({ format: { type: 'json_schema', schema: { type: 'object' } } })
  })

  it('throws a stop error on refusal', async () => {
    const { client: c } = client({ model: 'm', stop_reason: 'refusal', content: [], usage: { input_tokens: 1, output_tokens: 0 } })
    await expect(new ClaudeProvider({ client: c }).complete(request)).rejects.toBeInstanceOf(ProviderStopError)
  })
})

describe('OpenAIProvider', () => {
  it('sends a data URL image with a strict json_schema format', async () => {
    const create = vi.fn(async () => ({
      status: 'completed',
      model: 'gpt-5',
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }],
      output_text: '{"ok":true}',
      usage: { input_tokens: 50, output_tokens: 10 },
    }))
    const c = { responses: { create } } as unknown as OpenAI
    const reply = await new OpenAIProvider({ client: c, model: 'gpt-5' }).complete(request)
    expect(reply.text).toBe('{"ok":true}')
    const params = firstArg<Record<string, any>>(create)
    expect(params.instructions).toBe('SYSTEM')
    expect(params.input[0].content[0].image_url).toMatch(/^data:image\/png;base64,/)
    expect(params.text.format).toMatchObject({ type: 'json_schema', strict: true, schema: { type: 'object' } })
  })

  it('throws a stop error on refusal', async () => {
    const create = vi.fn(async () => ({
      status: 'completed',
      model: 'gpt-5',
      output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }],
      output_text: '',
    }))
    const c = { responses: { create } } as unknown as OpenAI
    await expect(new OpenAIProvider({ client: c }).complete(request)).rejects.toBeInstanceOf(ProviderStopError)
  })
})

describe('GeminiProvider', () => {
  it('sends inline image data with a JSON response schema', async () => {
    const generateContent = vi.fn(async () => ({
      text: '{"ok":true}',
      modelVersion: 'gemini-2.5-pro',
      candidates: [{ finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 7 },
    }))
    const c = { models: { generateContent } } as unknown as GoogleGenAI
    const reply = await new GeminiProvider({ client: c }).complete(request)
    expect(reply).toEqual({ text: '{"ok":true}', model: 'gemini-2.5-pro', usage: { inputTokens: 30, outputTokens: 7 } })
    const params = firstArg<Record<string, any>>(generateContent)
    expect(params.contents[0].parts[0].inlineData.mimeType).toBe('image/png')
    expect(params.config).toMatchObject({ systemInstruction: 'SYSTEM', responseMimeType: 'application/json', responseJsonSchema: { type: 'object' } })
  })

  it('throws a stop error when generation stops early', async () => {
    const generateContent = vi.fn(async () => ({ text: '', candidates: [{ finishReason: 'MAX_TOKENS' }] }))
    const c = { models: { generateContent } } as unknown as GoogleGenAI
    await expect(new GeminiProvider({ client: c }).complete(request)).rejects.toBeInstanceOf(ProviderStopError)
  })
})

describe('OpenAICompatibleProvider', () => {
  const reply = (content: string, finish = 'stop') => ({
    model: 'deepseek-vl',
    choices: [{ finish_reason: finish, message: { content, refusal: null } }],
    usage: { prompt_tokens: 40, completion_tokens: 8 },
  })

  it('sends chat completions with the image and a strict schema', async () => {
    const create = vi.fn(async () => reply('```json\n{"ok":true}\n```'))
    const c = { chat: { completions: { create } } } as unknown as OpenAI
    const out = await new OpenAICompatibleProvider({ id: 'c-1', baseUrl: 'http://x', model: 'deepseek-vl', client: c }).complete(request)
    expect(out).toEqual({ text: '{"ok":true}', model: 'deepseek-vl', usage: { inputTokens: 40, outputTokens: 8 } })
    const params = firstArg<Record<string, any>>(create)
    expect(params.messages[0]).toEqual({ role: 'system', content: 'SYSTEM' })
    expect(params.messages[1].content[0].image_url.url).toMatch(/^data:image\/png;base64,/)
    expect(params.response_format).toMatchObject({ type: 'json_schema', json_schema: { strict: true, schema: { type: 'object' } } })
  })

  it('moves the schema into the prompt when the service rejects it', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('response_format json_schema is not supported'), { status: 400 }))
      .mockResolvedValue(reply('{"ok":true}'))
    const c = { chat: { completions: { create } } } as unknown as OpenAI
    const provider = new OpenAICompatibleProvider({ id: 'c-1', baseUrl: 'http://x', model: 'm', client: c })
    expect((await provider.complete(request)).text).toBe('{"ok":true}')
    await provider.complete(request)
    const retried = create.mock.calls[1]![0] as Record<string, any>
    expect(retried.response_format).toEqual({ type: 'json_object' })
    expect(retried.messages[1].content[1].text).toContain('JSON Schema')
    // remembered: the third call goes straight to the prompt form
    expect(create).toHaveBeenCalledTimes(3)
    expect((create.mock.calls[2]![0] as Record<string, any>).response_format).toEqual({ type: 'json_object' })
  })

  it('throws a stop error when the reply is cut off', async () => {
    const create = vi.fn(async () => reply('{"ok"', 'length'))
    const c = { chat: { completions: { create } } } as unknown as OpenAI
    await expect(new OpenAICompatibleProvider({ id: 'c-1', baseUrl: 'http://x', model: 'm', client: c }).complete(request)).rejects.toBeInstanceOf(ProviderStopError)
  })
})
