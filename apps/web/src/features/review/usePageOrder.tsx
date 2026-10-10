'use client'

import { inverseOrder, isSameOrder } from '@exam/core'
import { useRef, useState } from 'react'
import { useT } from '@/shared/i18n/client'
import { UNDO_MS } from '@/shared/removal'
import { Toast } from '@/shared/Toast'
import { reorderPages } from './pageActions'
import type { SourcePage } from './usePageCrops'

/** The original's pages being put in order on the page viewer. */
export interface Arranging {
  /** Page numbers in the order shown, e.g. [2, 1, 3]. */
  order: number[]
  busy: boolean
  note: string | null
  onChange: (order: number[]) => void
  onApply: () => void
  onCancel: () => void
}

/**
 * Putting the original's pages in another order (頁面順序): the pages show small, dragged into place;
 * 套用 moves them on the server and the questions follow their pages, in the draft and every undo
 * step. A note offers 復原 for a few seconds.
 */
export function usePageOrder(
  importId: string,
  pages: SourcePage[],
  replacePages: (pages: SourcePage[]) => void,
  reorderDraft: (order: number[]) => void,
) {
  const t = useT()
  const [state, setState] = useState<{ order: number[]; busy: boolean; note: string | null } | null>(null)
  const [undo, setUndo] = useState<number[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const save = async (order: number[]) => {
    replacePages(await reorderPages(importId, order))
    reorderDraft(order)
  }

  const apply = async () => {
    if (!state || state.busy) return
    const { order } = state
    if (isSameOrder(order)) return setState(null)
    setState({ ...state, busy: true, note: null })
    try {
      await save(order)
      setState(null)
      clearTimeout(timer.current)
      setUndo(inverseOrder(order))
      timer.current = setTimeout(() => setUndo(null), UNDO_MS)
    } catch {
      setState((s) => s && { ...s, busy: false, note: t('沒有存好，再試一次。') })
    }
  }

  const arranging: Arranging | null = state && {
    ...state,
    onChange: (order) => setState((s) => s && { ...s, order }),
    onApply: () => void apply(),
    onCancel: () => setState(null),
  }

  return {
    arranging,
    start: () => setState({ order: pages.map((p) => p.pageNumber), busy: false, note: null }),
    toast: (
      <Toast
        show={undo !== null}
        action={t('復原')}
        onAction={() => {
          if (undo) void save(undo).catch(() => {})
          setUndo(null)
        }}
      >
        {t('頁面順序已調整，題目也跟著重排')}
      </Toast>
    ),
  }
}
