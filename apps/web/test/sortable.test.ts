import { describe, expect, it } from 'vitest'
import { underPointer } from '../src/features/review/sortable'

// Three cards of very different heights, stacked with 16px gaps.
const rects = new Map(
  [
    ['a', 0, 100],
    ['b', 116, 600],
    ['c', 732, 80],
  ].map(([id, top, height]) => [id as string, { top: top as number, bottom: (top as number) + (height as number), height: height as number, left: 0, right: 500, width: 500 }]),
)
const containers = [...rects.keys()].map((id) => ({ id }))

function target(active: string, y: number) {
  const hits = underPointer({
    active: { id: active },
    collisionRect: { top: y, bottom: y + 56, left: 0, right: 500, width: 500, height: 56 },
    droppableRects: rects,
    droppableContainers: containers,
    pointerCoordinates: { x: 250, y },
  } as unknown as Parameters<typeof underPointer>[0])
  return hits[0]?.id
}

describe('underPointer', () => {
  it('moves past a card only once the pointer passes its middle', () => {
    expect(target('a', 300)).toBe('a') // above the middle of the tall card b
    expect(target('a', 500)).toBe('b') // past it
    expect(target('a', 800)).toBe('c')
  })

  it('works the same way moving up', () => {
    expect(target('c', 500)).toBe('c')
    expect(target('c', 300)).toBe('b')
    expect(target('c', 20)).toBe('a')
  })
})
