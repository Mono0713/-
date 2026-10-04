import { describe, expect, it } from 'vitest'
import { untangleBoxes } from '../src/index.ts'

const at = (pageNumber: number, x: number, y: number, width: number, height: number) => ({ locations: [{ pageNumber, bbox: { x, y, width, height } }] })

describe('untangleBoxes', () => {
  it('ends a box where the next question in the same column starts', () => {
    const [five, six] = untangleBoxes([at(1, 0.55, 0.4, 0.4, 0.25), at(1, 0.56, 0.6, 0.38, 0.2)])
    expect(five!.locations[0]!.bbox.y + five!.locations[0]!.bbox.height).toBeCloseTo(0.597)
    expect(six!.locations[0]!.bbox.height).toBe(0.2)
  })

  it('leaves columns side by side and other pages alone', () => {
    const qs = [at(1, 0.05, 0.4, 0.4, 0.3), at(1, 0.55, 0.5, 0.4, 0.2), at(2, 0.05, 0.5, 0.4, 0.2)]
    expect(untangleBoxes(qs)).toBe(qs)
  })

  it('keeps a box the person placed by hand', () => {
    const five = { locations: [{ pageNumber: 1, bbox: { x: 0.55, y: 0.4, width: 0.4, height: 0.25 }, manual: true }] }
    const qs = [five, at(1, 0.56, 0.6, 0.38, 0.2)]
    expect(untangleBoxes(qs)).toBe(qs)
  })
})
