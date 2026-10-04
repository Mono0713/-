'use client'

import type { QuizMode } from '@exam/quiz'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconBank, IconLoader, IconQuiz } from '@/shared/icons'
import { Button } from '@/shared/ui'
import { copyShared, startShared } from './actions'

/** What someone with the link can do: practise, take it as an exam, or copy it to their bank when allowed. */
export function SharedActions({ token, copy, allowCopy }: { token: string; copy: string | null; allowCopy: boolean }) {
  const t = useT()
  const [shuffleQuestions, setShuffleQuestions] = useState(true)
  const [shuffleOptions, setShuffleOptions] = useState(true)
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
  const quiz = (mode: QuizMode) => run(mode, () => startShared(token, mode, { questions: shuffleQuestions, options: shuffleOptions }))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Choice title={t('練習')} detail={t('一題一題做，做完就能看對錯和解析。')} onClick={() => quiz('practice')} loading={busy === 'practice'} disabled={pending} />
        <Choice title={t('考試')} detail={t('全部做完再交卷，交卷後才看分數。')} onClick={() => quiz('exam')} loading={busy === 'exam'} disabled={pending} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="m-check" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} />
          {t('打亂題目順序')}
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="m-check" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} />
          {t('打亂選項順序')}
        </label>
      </div>
      {(copy || allowCopy) && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line/70 pt-4">
          {copy ? (
            <Link href={`/bank/exams/${copy}`} className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
              <IconBank size={15} />
              {t('已經在你的題庫裡，打開')}
            </Link>
          ) : (
            <Button icon={<IconBank size={15} />} loading={busy === 'copy'} disabled={pending} onClick={() => run('copy', () => copyShared(token))}>
              {t('加到我的題庫')}
            </Button>
          )}
          <span className="text-xs text-muted">{t('加進去的是你自己的副本，可以修改，不影響原本的考卷。')}</span>
        </div>
      )}
      {error && <p className="m-shake text-sm text-bad">{error}</p>}
    </div>
  )
}

/** Both ways in look alike; the one under the pointer (or keyboard focus, or the one starting) lights up in ink blue. */
function Choice({ title, detail, onClick, loading, disabled }: { title: string; detail: string; onClick: () => void; loading: boolean; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-on={loading || undefined}
      className="m-press m-push-quiet flex items-start gap-3 rounded-2xl bg-surface p-4 text-left shadow-sheet outline-none transition-colors duration-150 enabled:hover:bg-accent enabled:hover:text-on-accent enabled:hover:[--m-depth:var(--color-accent-deep)] focus-visible:bg-accent focus-visible:text-on-accent disabled:cursor-not-allowed data-[on]:bg-accent data-[on]:text-on-accent"
    >
      {loading ? <IconLoader size={20} className="m-spin mt-0.5 shrink-0" aria-hidden /> : <IconQuiz size={20} className="mt-0.5 shrink-0" />}
      <span>
        <span className="block font-semibold">{title}</span>
        {/* the text colour of the card, a little lighter, so it reads on either background */}
        <span className="mt-0.5 block text-sm opacity-75">{detail}</span>
      </span>
    </button>
  )
}
