'use client'

import type { DraftExam } from '@exam/core'
import { useEffect, useState, useTransition } from 'react'
import { msg } from '@/shared/i18n/format'
import { publishDraft, saveDraft } from './actions'

export type SaveState = 'saved' | 'dirty' | 'saving'

export const SAVE_LABELS: Record<SaveState, string> = { saved: msg('草稿已自動儲存'), saving: msg('儲存中…'), dirty: msg('有未儲存的修改') }

/**
 * Saves the draft shortly after each edit, and puts it in the bank on `publish`.
 * `initial` is the draft as loaded (no save until it changes); `start` is what was last in the bank, if anything was.
 */
export function useDraftSaving(
  importId: string,
  draft: DraftExam,
  initial: DraftExam,
  start: DraftExam,
  savedExam: { id: string; questionCount: number } | null,
) {
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [published, setPublished] = useState(savedExam ? { count: savedExam.questionCount, examId: savedExam.id } : null)
  // The draft as it was last put in the bank: until it changes, there is nothing to update.
  const [inBank, setInBank] = useState<DraftExam | null>(savedExam ? start : null)
  const [publishing, startPublish] = useTransition()

  // Autosave shortly after the last edit.
  useEffect(() => {
    if (draft === initial) return
    setSaveState('dirty')
    const timer = setTimeout(async () => {
      setSaveState('saving')
      await saveDraft(importId, draft)
      setSaveState('saved')
    }, 800)
    return () => clearTimeout(timer)
  }, [draft, importId, initial])

  const publish = () =>
    startPublish(async () => {
      const snapshot = draft
      if (saveState !== 'saved') await saveDraft(importId, snapshot)
      setPublished(await publishDraft(importId, snapshot))
      setInBank(snapshot)
      setSaveState('saved')
    })

  return { saveState, published, inSync: inBank === draft, publish, publishing }
}
