'use client'

import { type DraftExam, type DraftQuestion, needsAnswer } from '@exam/core'
import { useState } from 'react'
import { IconSparkles } from '@/shared/icons'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { Button } from '@/shared/ui'
import { solveAnswer } from './actions'

/** The note an AI answer carries until the person confirms the card. Translated where shown. */
export const AI_ANSWER_NOTE = msg('答案由 AI 作答，請確認是否正確。')

const AT_ONCE = 3

/**
 * When the paper printed no key, offers to let the AI work out the answers (and an explanation where
 * there is none). Each answer lands in its card as it comes back, marked 「AI 解答」 and flagged to check.
 */
export function SolveAnswers({ importId, draft, keys, onSolved }: { importId: string; draft: DraftExam; keys: string[]; onSolved: (key: string, patch: (q: DraftQuestion) => DraftQuestion) => void }) {
  const t = useT()
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null)
  const [failed, setFailed] = useState(0)
  const missing = draft.questions.flatMap((q, i) => (needsAnswer(q) ? [i] : []))
  if (!missing.length && !running) return null

  const run = async () => {
    const jobs = missing.map((i) => ({ key: keys[i]!, question: draft.questions[i]!, shared: draft.groups.find((g) => g.id === draft.questions[i]!.groupId)?.stem ?? null }))
    let done = 0, bad = 0, next = 0
    setFailed(0)
    setRunning({ done, total: jobs.length })
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++]!
        const result = await solveAnswer(importId, job.question, job.shared).catch(() => ({ error: '' }))
        if ('error' in result) bad++
        else
          onSolved(job.key, (q) =>
            needsAnswer(q)
              ? {
                  ...q,
                  answer: { values: result.values, source: 'ai' },
                  explanation: q.explanation?.trim() ? q.explanation : result.explanation || q.explanation,
                  confidence: q.confidence === 'high' ? 'medium' : q.confidence,
                  issues: [...q.issues.filter((x) => x !== AI_ANSWER_NOTE), AI_ANSWER_NOTE],
                }
              : q,
          )
        setRunning({ done: ++done, total: jobs.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, jobs.length) }, worker))
    setFailed(bad)
    setRunning(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-surface px-4 py-3 text-sm shadow-sheet">
      <span className="min-w-0 flex-1 basis-56 text-muted">
        {running
          ? t('AI 正在作答…（{done} / {total}）', running)
          : failed
            ? t('還有 {n} 題沒有答案，其中 {failed} 題 AI 沒答出來。', { n: missing.length, failed })
            : t('有 {n} 題卷上沒有答案。', { n: missing.length })}
      </span>
      <Button onClick={run} disabled={Boolean(running)} loading={Boolean(running)} icon={<IconSparkles size={15} />}>
        {failed ? t('再試一次') : t('讓 AI 作答')}
      </Button>
    </div>
  )
}
