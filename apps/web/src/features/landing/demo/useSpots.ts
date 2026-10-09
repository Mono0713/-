import { useLayoutEffect, useState, type RefObject } from 'react'

type Spot = { x: number; y: number }

/** Where `el` sits inside `root` by layout alone, so the stage's scale and pieces still rising in don't skew it. */
function offsetIn(el: HTMLElement, root: HTMLElement) {
  let x = 0
  let y = 0
  for (let at: HTMLElement | null = el; at && at !== root; at = at.offsetParent as HTMLElement | null) {
    x += at.offsetLeft
    y += at.offsetTop
  }
  return { x, y }
}

/**
 * Where the pointer should go to click each of `targets`, in the picture's own coordinates.
 * `fallback` holds until measured; `key` says when to measure again.
 */
export function useSpots(root: RefObject<HTMLElement | null>, targets: RefObject<HTMLElement | null>[], fallback: Spot[], key: unknown): Spot[] {
  const [spots, setSpots] = useState(fallback)
  useLayoutEffect(() => {
    const box = root.current
    if (!box) return
    setSpots(
      targets.map((target, i) => {
        const el = target.current
        if (!el) return fallback[i]!
        const { x, y } = offsetIn(el, box)
        return { x: x + el.offsetWidth / 2, y: y + el.offsetHeight / 2 }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return spots
}
