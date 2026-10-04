import { describe, expect, it } from 'vitest'
import { explainError as explain } from '../src/features/imports/errors'
import { fill, type T } from '../src/shared/i18n/format'

const t: T = (s, v) => fill(s, v)
const explainError = (raw: string) => explain(raw, t)

const geminiFreeTier = `{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details.\\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count, limit: 0, model: gemini-3.1-pro\\nPlease retry in 7h22m53.455400204s.","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"26573s"}]}}`

describe('explainError', () => {
  it('says a model with a zero free quota needs billing or another model', () => {
    expect(explainError(geminiFreeTier)).toMatchObject({ title: '這個模型不在免費額度裡', fix: 'model' })
  })

  it('tells how long until a used-up quota comes back', () => {
    const used = geminiFreeTier.replace('limit: 0', 'limit: 50')
    expect(explainError(used).detail).toContain('7 小時 23 分')
    expect(explainError('{"error":{"code":429,"details":[{"retryDelay":"90s"}]}}').detail).toContain('2 分鐘')
  })

  it('sends a rejected key to settings', () => {
    expect(explainError('401 Unauthorized: invalid x-api-key')).toMatchObject({ fix: 'settings' })
    expect(explainError('{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}')).toMatchObject({ fix: 'settings' })
  })

  it('names the model a retired one should be replaced with', () => {
    const retired = `{"error":{"code":404,"message":"This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features and improvements.","status":"NOT_FOUND"}}`
    expect(explainError(retired)).toMatchObject({ title: '這個模型已經停止提供', fix: 'model' })
    expect(explainError(retired).detail).toContain('改用 gemini-3.8-flash。')
  })

  it('recognises a missing model, an overloaded service and a network failure', () => {
    expect(explainError('404 model: claude-old not found').title).toBe('找不到這個模型')
    expect(explainError('529 {"type":"error","error":{"type":"overloaded_error"}}').fix).toBe('retry')
    expect(explainError('TypeError: fetch failed').title).toBe('連不到 AI 服務')
  })

  it('falls back to a general note', () => {
    expect(explainError('something odd').title).toBe('AI 沒有讀完這份考卷')
  })

  it('says a reading cut off by a restart or a stalled file store can simply be run again', () => {
    expect(explainError('Reading was interrupted because the server restarted')).toMatchObject({ title: '辨識到一半被中斷了', fix: 'retry' })
    expect(explainError('File store could not write u/a/figures/f1.png: no answer within 60 s')).toMatchObject({ title: '檔案沒有存進去', fix: 'retry' })
  })
})
