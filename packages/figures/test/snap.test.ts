import { describe, expect, it } from 'vitest'
import { lineShift } from '../src/index.ts'

/** A white page 1000 px tall with black text lines 20 px high, starting every 40 px from y = 100. */
function page(): { grey: Uint8Array; width: number; height: number } {
  const width = 400
  const height = 1000
  const grey = new Uint8Array(width * height).fill(255)
  for (let top = 100; top < 900; top += 40) for (let y = top; y < top + 20; y++) for (let x = 20; x < 380; x += 3) grey[y * width + x] = 0
  return { grey, width, height }
}

const box = (y: number) => ({ x: 0, y: y / 1000, width: 1, height: 0.1 })
const moved = (y: number) => {
  const { grey, width, height } = page()
  return Math.round(y + lineShift(grey, width, height, box(y)) * 1000)
}

describe('lineShift', () => {
  it('moves a box half a line too high down onto its first line', () => {
    // the question's first line is 220–240: a top in the gap above it, or in the lower half of the line above (180–200)
    expect(moved(205)).toBe(216)
    expect(moved(195)).toBe(216)
  })

  it('moves a box that cuts into the top of a line up to it', () => {
    expect(moved(224)).toBe(216)
  })

  it('leaves a box already in place', () => {
    expect(moved(216)).toBe(216)
  })
})

describe('lineShift in a table', () => {
  it('leaves a box inside a tall block alone', () => {
    const width = 400
    const height = 1000
    const grey = new Uint8Array(width * height).fill(255)
    // a table: side borders ink every row from 100 to 400
    for (let y = 100; y < 400; y++) grey[y * width + 20] = grey[y * width + 21] = grey[y * width + 380] = grey[y * width + 381] = 0
    expect(lineShift(grey, width, height, { x: 0, y: 0.25, width: 1, height: 0.1 })).toBe(0)
  })
})
