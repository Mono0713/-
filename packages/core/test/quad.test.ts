import { describe, expect, it } from 'vitest'
import { FULL_QUAD, isUsableQuad, remapBox, remapBoxes, type Quad } from '../src/index.ts'

const half: Quad = [
  { x: 0.25, y: 0.25 },
  { x: 0.75, y: 0.25 },
  { x: 0.75, y: 0.75 },
  { x: 0.25, y: 0.75 },
]

describe('remapBox', () => {
  it('moves a box from the whole image onto a cut-out middle and back', () => {
    const box = { x: 0.3, y: 0.3, width: 0.2, height: 0.1 }
    const inside = remapBox(box, null, half)
    expect(inside.x).toBeCloseTo(0.1)
    expect(inside.y).toBeCloseTo(0.1)
    expect(inside.width).toBeCloseTo(0.4)
    expect(inside.height).toBeCloseTo(0.2)
    const back = remapBox(inside, half, null)
    expect(back.x).toBeCloseTo(box.x)
    expect(back.width).toBeCloseTo(box.width)
  })

  it('keeps boxes on the page when the new cut is smaller', () => {
    const b = remapBox({ x: 0, y: 0, width: 1, height: 1 }, null, half)
    expect(b).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })
})

describe('remapBoxes', () => {
  it('changes every bbox except those of a cropped picture', () => {
    const move = () => ({ x: 9, y: 9, width: 9, height: 9 })
    const out = remapBoxes({ bbox: { x: 0, y: 0, width: 1, height: 1 }, blanks: [{ bbox: { x: 0, y: 0, width: 1, height: 1 } }], image: { blanks: [{ bbox: { x: 0, y: 0, width: 1, height: 1 } }] } }, move)
    expect(out.bbox.x).toBe(9)
    expect(out.blanks[0]!.bbox.x).toBe(9)
    expect(out.image.blanks[0]!.bbox.x).toBe(0)
  })
})

describe('isUsableQuad', () => {
  it('turns down crossed corners', () => {
    expect(isUsableQuad(FULL_QUAD)).toBe(true)
    expect(isUsableQuad([FULL_QUAD[0], FULL_QUAD[2], FULL_QUAD[1], FULL_QUAD[3]])).toBe(false)
  })
})
