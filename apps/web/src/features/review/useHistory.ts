'use client'

import { useRef } from 'react'

// Typing in one box keeps adding to the same step until it pauses this long.
const PAUSE = 1000
const LIMIT = 300

type Step<S> = { state: S; focus?: string }

/**
 * Undo and redo for a value changed through `change`. Each change is one step, except that changes
 * sharing a `tag` one after another join the step before (typing in one box: tags starting with
 * "type:" join only while the typing has not paused; an AI run over the whole exam joins for as long
 * as nothing else changes in between). `focus` names what the step changed, handed back on undo/redo.
 * `apply` puts a state on screen; `now` is always the latest state, also inside async callbacks.
 */
export function useHistory<S>(initial: () => S, apply: (state: S) => void) {
  const now = useRef<S | null>(null)
  if (now.current === null) now.current = initial()
  const past = useRef<Step<S>[]>([])
  const future = useRef<Step<S>[]>([])
  const last = useRef<{ tag?: string; at: number }>({ at: 0 })

  const set = (state: S) => {
    now.current = state
    apply(state)
  }

  /** Changes the state from the latest one; returning the same state changes nothing. */
  const change = (next: (state: S) => S, step: { tag?: string; focus?: string } = {}) => {
    const before = now.current!
    const after = next(before)
    if (after === before) return
    const at = Date.now()
    const { tag } = step
    const joins = tag !== undefined && last.current.tag === tag && past.current.length > 0 && (!tag.startsWith('type:') || at - last.current.at < PAUSE)
    if (!joins) {
      past.current.push({ state: before, focus: step.focus })
      if (past.current.length > LIMIT) past.current.shift()
    }
    future.current = []
    last.current = { tag, at }
    set(after)
  }

  const move = (from: Step<S>[], to: Step<S>[]) => {
    const step = from.pop()
    if (!step) return null
    to.push({ state: now.current!, focus: step.focus })
    last.current = { at: 0 }
    set(step.state)
    return step
  }

  return {
    now: now as { readonly current: S },
    change,
    /** Goes back one step; returns it (with its focus), or null when there is nothing to undo. */
    undo: () => move(past.current, future.current),
    redo: () => move(future.current, past.current),
    /** Changes the state and every step before and after it the same way, without a step of its own (a page cut again). */
    rewrite: (fn: (state: S) => S) => {
      past.current = past.current.map((s) => ({ ...s, state: fn(s.state) }))
      future.current = future.current.map((s) => ({ ...s, state: fn(s.state) }))
      set(fn(now.current!))
    },
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  }
}
