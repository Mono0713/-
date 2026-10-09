import type { DraftExam, DraftFigure } from '@exam/core'
import { describe, expect, it } from 'vitest'
import { keepDraftFiles, keepQuestionFiles } from '../src/server/fileKeys'

const figure = (file: string | null): DraftFigure =>
  ({ description: '', pageNumber: 1, bbox: { x: 0, y: 0, width: 1, height: 1 }, image: file ? { file, width: 10, height: 10, blanks: [] } : null }) as unknown as DraftFigure

describe('keepDraftFiles', () => {
  it("drops pictures that point at someone else's files, in questions and groups", () => {
    const draft = {
      questions: [{ figures: [figure('u/me/imports/1/figures/a.png'), figure('u/them/imports/9/sources/1.pdf')] }],
      groups: [{ figures: [figure('u/them/classes/x/figure-1.png')] }],
    } as unknown as DraftExam
    const kept = keepDraftFiles('u/me/', draft)
    expect(kept.questions[0]!.figures.map((f) => f.image?.file ?? null)).toEqual(['u/me/imports/1/figures/a.png', null])
    expect(kept.groups[0]!.figures[0]!.image).toBeNull()
    // the figures themselves stay, so the question keeps its shape
    expect(kept.questions[0]!.figures).toHaveLength(2)
  })

  it('keeps everything for the single local person and leaves clean drafts untouched', () => {
    const question = { figures: [figure('imports/1/figures/a.png')] }
    expect(keepQuestionFiles('', question)).toBe(question)
    const mine = { figures: [figure('u/me/copies/2/figure-1.png'), figure(null)] }
    expect(keepQuestionFiles('u/me/', mine)).toBe(mine)
  })
})
