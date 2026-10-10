'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useT } from '@/shared/i18n/client'
import { Toast } from './Toast'

/** How long something deleted waits for 復原 before it is really gone. */
export const UNDO_MS = 5000

interface Removal {
  /** What disappears: lists hide anything with this id while it waits. */
  id: string
  /** The note at the bottom, e.g. 已刪除考卷. */
  note: string
  /** Deletes it for good; called once the note has run out. */
  commit: () => Promise<unknown> | unknown
  /** Called on 復原, for a component that hid the thing itself. */
  onUndo?: () => void
}

interface Removals {
  remove: (removal: Removal) => void
  isRemoved: (id: string) => boolean
}

const Context = createContext<Removals>({ remove: (r) => void r.commit(), isRemoved: () => false })

/**
 * Deleting never asks first. The thing goes at once, a note offers 復原 for a few seconds, and only
 * then is it removed. This lives in the layout, so the wait carries on when a delete also leaves the
 * page (deleting an exam from its own page goes back to the bank, where the card is already gone).
 */
export function RemovalProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const [hidden, setHidden] = useState<string[]>([])
  const [note, setNote] = useState<Removal | null>(null)
  const pending = useRef(new Map<string, { removal: Removal; timer: ReturnType<typeof setTimeout> }>())

  const commit = useCallback((id: string) => {
    const entry = pending.current.get(id)
    if (!entry) return
    clearTimeout(entry.timer)
    pending.current.delete(id)
    void entry.removal.commit()
  }, [])

  const remove = useCallback(
    (removal: Removal) => {
      if (pending.current.has(removal.id)) return
      setHidden((h) => [...h, removal.id])
      setNote(removal)
      const timer = setTimeout(() => {
        commit(removal.id)
        setNote((n) => (n?.id === removal.id ? null : n))
      }, UNDO_MS)
      pending.current.set(removal.id, { removal, timer })
    },
    [commit],
  )

  const undo = () => {
    if (!note) return
    clearTimeout(pending.current.get(note.id)?.timer)
    pending.current.delete(note.id)
    setHidden((h) => h.filter((id) => id !== note.id))
    note.onUndo?.()
    setNote(null)
  }

  // closing the tab ends the wait: what was deleted stays deleted
  useEffect(() => {
    const map = pending.current
    const onHide = () => document.visibilityState === 'hidden' && [...map.keys()].forEach(commit)
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [commit])

  const value = useMemo(() => ({ remove, isRemoved: (id: string) => hidden.includes(id) }), [remove, hidden])
  return (
    <Context.Provider value={value}>
      {children}
      <Toast show={note !== null} action={t('復原')} onAction={undo}>
        {note?.note}
      </Toast>
    </Context.Provider>
  )
}

export function useRemoval(): Removals {
  return useContext(Context)
}

/** Hides its children while the thing with this id waits to be deleted. For lists drawn on the server. */
export function Removable({ id, children }: { id: string; children: ReactNode }) {
  return useRemoval().isRemoved(id) ? null : children
}
