import { describe, expect, it } from 'vitest'
import { compactStroke, hitsStroke, inkToSvg, isEmptyInk, LINE_GAP, paperGuides, paperLines, paperSvg, PRACTICE_COLUMNS, practiceHeight, practicePaper, strokePath, type Stroke } from '../src/index.ts'

const line: Stroke = { points: [[0.1, 0.1, 0.5], [0.2, 0.1, 0.5], [0.3, 0.1, 0.5]], color: '#1b1d33', size: 0.004 }

describe('ink', () => {
  it('draws a stroke as a closed SVG path, scaled to the page width', () => {
    const d = strokePath(line, 1000)
    expect(d).toMatch(/^M[\d. ]+Q.*Z$/)
    expect(inkToSvg({ strokes: [line], height: 0.5 }, 800)).toContain('height="400"')
  })

  it('keeps saved ink small', () => {
    const dense: Stroke = { ...line, points: Array.from({ length: 100 }, (_, i) => [0.1 + i * 0.00001, 0.1, 0.51234] as [number, number, number]) }
    const small = compactStroke(dense)
    expect(small.points.length).toBeLessThan(5)
    expect(small.points[0]).toEqual([0.1, 0.1, 0.51])
  })

  it('finds the stroke under the eraser', () => {
    expect(hitsStroke(line, 0.15, 0.102, 0.004)).toBe(true)
    expect(hitsStroke(line, 0.15, 0.2, 0.004)).toBe(false)
  })

  it('knows empty ink', () => {
    expect(isEmptyInk(null)).toBe(true)
    expect(isEmptyInk({ strokes: [line], height: 0.5 })).toBe(false)
  })
})

describe('paper', () => {
  it('lays out one practice row per character with a model and traced copies', () => {
    const paper = practicePaper(['永', '春 天'])
    expect(paper.rows).toEqual(['永', '春', '天'])
    expect(practiceHeight(paper)).toBeCloseTo(3 / PRACTICE_COLUMNS)
    const guides = paperGuides(paper)
    expect(guides.filter((g) => g.kind === 'model').map((g) => g.char)).toEqual(['永', '春', '天'])
    expect(guides.filter((g) => g.kind === 'trace')).toHaveLength(3 * paper.traced)
    // borders plus the dashed cross through each cell
    const lines = paperLines(paper, practiceHeight(paper))
    expect(lines.filter((l) => l.style === 'border')).toHaveLength(4 + PRACTICE_COLUMNS + 1)
    expect(lines.filter((l) => l.style === 'guide')).toHaveLength(3 + PRACTICE_COLUMNS)
    expect(paperSvg(paper, practiceHeight(paper), 800)).toContain('stroke-dasharray')
  })

  it('rules lines and squares down the whole page', () => {
    expect(paperLines({ kind: 'lines' }, 0.5)).toHaveLength(Math.ceil(0.5 / LINE_GAP) - 1)
    expect(paperLines({ kind: 'dots' }, 0.5)).toEqual([])
    const squares = paperLines({ kind: 'squares', columns: 10 }, 0.5)
    expect(squares.filter((l) => l.x1 === l.x2)).toHaveLength(11)
    expect(squares.filter((l) => l.y1 === l.y2)).toHaveLength(6)
  })
})
