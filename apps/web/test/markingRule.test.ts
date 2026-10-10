import { describe, expect, it } from 'vitest'
import { sameRule, sharedRule, withoutRule } from '../src/shared/markingRule.ts'

describe('marking rules', () => {
  it('drops the rule written into the stem, with its brackets', () => {
    expect(withoutRule('這 5 秒內行駛的距離。(列式 2 分，答案 2 分，共 8 分)', '列式 2 分，答案 2 分，共 8 分')).toBe('這 5 秒內行駛的距離。')
    expect(withoutRule('求加速度（列式2分，答案2分）', '列式 2 分，答案 2 分')).toBe('求加速度')
    expect(withoutRule('加速度；', '列式 2 分')).toBe('加速度；')
  })
  it('finds the rule all sub-questions share', () => {
    expect(sharedRule([{ markingRule: '列式 2 分' }, { markingRule: '列式2分' }])).toBe('列式 2 分')
    expect(sharedRule([{ markingRule: '列式 2 分' }, { markingRule: null }])).toBeNull()
    expect(sharedRule([{ markingRule: '列式 2 分' }])).toBeNull()
    expect(sameRule('a b', 'ab')).toBe(true)
  })
})
