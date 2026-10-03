'use client'

import type { QuizMode } from '@exam/quiz'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { IconBank, IconLoader, IconQuiz } from '@/shared/icons'
import { Button } from '@/shared/ui'
import { copyShared, startShared } from './actions'

/** What someone with the link can do: practise, take it as an exam, or copy it to their bank. */
export function SharedActions({ token, copy }: { token: string; copy: string | null }) {
  const [shuffle, setShuffle] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<'practice' | 'exam' | 'copy' | null>(null)
  const run = (what: 'practice' | 'exam' | 'copy', action: () => Promise<{ error: string } | undefined>) => {
    setBusy(what)
    setError(null)
    start(async () => {
      // On success each action opens the new page.
      const result = await action()
      if (result) setError(result.error)
      setBusy(null)
    })
  }
  const quiz = (mode: QuizMode) => run(mode, () => startShared(token, mode, shuffle))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Choice title="練習" detail="一題一題做，做完就能看對錯和解析。" onClick={() => quiz('practice')} loading={busy === 'practice'} disabled={pending} primary />
        <Choice title="考試" detail="全部做完再交卷，交卷後才看分數。" onClick={() => quiz('exam')} loading={busy === 'exam'} disabled={pending} />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" className="m-check" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
        打亂題目和選項順序
      </label>
      <div className="flex flex-wrap items-center gap-3 border-t border-line/70 pt-4">
        {copy ? (
          <Link href={`/bank/exams/${copy}`} className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
            <IconBank size={15} />
            已經在你的題庫裡，打開
          </Link>
        ) : (
          <Button icon={<IconBank size={15} />} loading={busy === 'copy'} disabled={pending} onClick={() => run('copy', () => copyShared(token))}>
            加到我的題庫
          </Button>
        )}
        <span className="text-xs text-muted">加進去的是你自己的副本，可以修改，不影響原本的考卷。</span>
      </div>
      {error && <p className="m-shake text-sm text-bad">{error}</p>}
    </div>
  )
}

function Choice({ title, detail, onClick, loading, disabled, primary = false }: { title: string; detail: string; onClick: () => void; loading: boolean; disabled: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`m-press flex items-start gap-3 rounded-2xl p-4 text-left disabled:cursor-not-allowed ${primary ? 'm-push bg-brand text-on-accent hover:brightness-110' : 'm-push-quiet bg-surface shadow-sheet hover:bg-accent-soft/50'}`}
    >
      {loading ? <IconLoader size={20} className="m-spin mt-0.5 shrink-0" aria-hidden /> : <IconQuiz size={20} className="mt-0.5 shrink-0" />}
      <span>
        <span className="block font-semibold">{title}</span>
        <span className={`mt-0.5 block text-sm ${primary ? 'opacity-80' : 'text-muted'}`}>{detail}</span>
      </span>
    </button>
  )
}
