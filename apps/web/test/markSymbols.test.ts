import { describe, expect, it } from 'vitest'
import { markSymbols } from '../src/shared/markSymbols'

describe('markSymbols', () => {
  it('evens out true/false marks after 畫', () => {
    expect(markSymbols('三、是非題（每題 2 分，對的畫 ∘，錯的畫 ╳）')).toBe('三、是非題（每題 2 分，對的畫 Ｏ，錯的畫 Ｘ）')
    expect(markSymbols('對的打○，錯的打×')).toBe('對的打 Ｏ，錯的打 Ｘ')
    expect(markSymbols('畫x軸')).toBe('畫x軸')
  })
  it('leaves other text alone', () => {
    expect(markSymbols('畫出下列圖形')).toBe('畫出下列圖形')
    expect(markSymbols('一、單選題（每題 4 分）')).toBe('一、單選題（每題 4 分）')
  })
})
