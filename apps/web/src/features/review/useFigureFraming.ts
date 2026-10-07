'use client'

import { useRef, useState } from 'react'
import type { FrameArea, FrameFigure } from '@/features/questions/QuestionEditor'
import type { Box } from './boxGeometry'

let opened = 0

/** A picture being framed on the page viewer: its box, and what the viewer does with it. */
export interface Framing extends FrameArea {
  /** New for each picture framed, so the viewer brings each one into view once. */
  id: number
  onChange: (bbox: Box, pageNumber: number) => void
  onApply: () => void
  onCancel: () => void
}

/**
 * Framing a question's picture on the original pages in the page viewer (the left side), with
 * the same box as the questions'. `frame` is handed to the question form; it resolves with the
 * area once 套用 is pressed, or null on 取消 (or when another picture starts framing).
 * `onStart`/`onEnd` let phones switch to the page and back.
 */
export function useFigureFraming(onStart: () => void, onEnd: () => void): { frame: FrameFigure; framing: Framing | null; cancel: () => void } {
  const [area, setArea] = useState<(FrameArea & { id: number }) | null>(null)
  const resolve = useRef<((area: FrameArea | null) => void) | null>(null)
  const end = (result: FrameArea | null) => {
    resolve.current?.(result)
    resolve.current = null
    setArea(null)
    onEnd()
  }
  const frame: FrameFigure = (start) =>
    new Promise((done) => {
      resolve.current?.(null)
      resolve.current = done
      setArea({ ...start, id: ++opened })
      onStart()
    })
  return {
    frame,
    /** Stops framing, as 取消 would (the form that asked closed). */
    cancel: () => void (resolve.current && end(null)),
    framing: area && {
      ...area,
      onChange: (bbox, pageNumber) => setArea((a) => a && { ...a, bbox, pageNumber }),
      onApply: () => end({ pageNumber: area.pageNumber, bbox: area.bbox }),
      onCancel: () => end(null),
    },
  }
}
