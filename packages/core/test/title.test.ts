import { describe, expect, it } from 'vitest'
import { isFormName, withExamTitle } from '../src/index.ts'

const meta = { title: '考試命題紙', subject: '實用英文(一)', institution: '中原大學', term: '113 學年度 上學期 期末考試', language: 'en' }

describe('exam titles', () => {
  it('a heading that only names the form becomes subject and term', () => {
    expect(withExamTitle(meta).title).toBe('實用英文(一) 113 學年度 上學期 期末考試')
    expect(withExamTitle({ ...meta, title: null }).title).toBe('實用英文(一) 113 學年度 上學期 期末考試')
    expect(isFormName('Exam Paper')).toBe(true)
  })
  it('keeps a real title, or the form name when nothing better is known', () => {
    expect(withExamTitle({ ...meta, title: '第三次段考 英文' }).title).toBe('第三次段考 英文')
    const bare = { ...meta, subject: null, term: null }
    expect(withExamTitle(bare)).toBe(bare)
  })
})
