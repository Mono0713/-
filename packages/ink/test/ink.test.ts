import { describe, expect, it } from 'vitest'
import { compactStroke, hitsStroke, inkToSvg, isEmptyInk, strokePath, type Stroke } from '../src/index.ts'

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
