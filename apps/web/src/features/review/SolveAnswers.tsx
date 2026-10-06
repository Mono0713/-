'use client'

import { type DraftExam, type DraftQuestion, needsAnswer, needsExplanation } from '@exam/core'
import { useState } from 'react'
import { IconSparkles } from '@/shared/icons'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { Button } from '@/shared/ui'
import { solveQuestion } from './actions'

/** The note an AI answer carries until the person confirms the card. Translated where shown. */
export const AI_ANSWER_NOTE = msg('答案由 AI 作答，請確認是否正確。')

const AT_ONCE = 3

type Job = 'answer' | 'explain'
type Patch = (q: DraftQuestion) => DraftQuestion

const NEEDS: Record<Job, (q: DraftQuestion) => boolean> = { answer: needsAnswer, explain: needsExplanation }

/** How a reply lands in its card, if the card still needs it by then. */
function patchFor(job: Job, result: { values: string[] } | { explanation: string }): Patch {
  return (q) => {
    if (!NEEDS[job](q)) return q
    if ('explanation' in result) return { ...q, explanation: result.explanation }
    return {
      ...q,
      answer: { values: result.values, source: 'ai' },
      confidence: q.confidence === 'high' ? 'medium' : q.confidence,
      issues: [...q.issues.filter((x) => x !== AI_ANSWER_NOTE), AI_ANSWER_NOTE],
    }
  }
}

/**
 * Offers, on request only, to let the AI work out the answers the paper left out (AI 作答) and to
 * write explanations for questions that have a key but none (AI 詳解). Each runs on its own model
 * from settings. Replies land in their cards as they come back; AI answers are marked 「AI 解答」
 * and flagged to check.
 */
export function SolveAnswers({ importId, draft, keys, onSolved }: { importId: string; draft: DraftExam; keys: string[]; onSolved: (key: string, patch: Patch) => void }) {
  const t = useT()
  const [running, setRunning] = useState<{ job: Job; done: number; total: number } | null>(null)
  const [failed, setFailed] = useState<Partial<Record<Job, number>>>({})
  const missing = (job: Job) => draft.questions.flatMap((q, i) => (NEEDS[job](q) ? [i] : []))
  const answers = missing('answer')
  const explanations = missing('explain')
  if (!answers.length && !explanations.length && !running) return null

  const run = async (job: Job) => {
    const jobs = missing(job).map((i) => ({ key: keys[i]!, question: draft.questions[i]!, shared: draft.groups.find((g) => g.id === draft.questions[i]!.groupId)?.stem ?? null }))
    let done = 0, bad = 0, next = 0
    setFailed((f) => ({ ...f, [job]: 0 }))
    setRunning({ job, done, total: jobs.length })
    const worker = async () => {
      while (next < jobs.length) {
        const item = jobs[next++]!
        const result = await solveQuestion(importId, job, item.question, item.shared).catch(() => ({ error: '' }))
        if ('error' in result) bad++
        else onSolved(item.key, patchFor(job, result))
        setRunning({ job, done: ++done, total: jobs.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, jobs.length) }, worker))
    setFailed((f) => ({ ...f, [job]: bad }))
    setRunning(null)
  }

  const line = (job: Job, count: number, status: string, label: string) =>
    (count > 0 || running?.job === job) && (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 basis-56 text-muted">
          {running?.job === job
            ? job === 'answer' ? t('AI 正在作答…（{done} / {total}）', running) : t('AI 正在寫詳解…（{done} / {total}）', running)
            : failed[job]
              ? t('其中 {failed} 題 AI 沒做出來。', { failed: failed[job] }) + ' ' + status
              : status}
        </span>
        <Button onClick={() => run(job)} disabled={Boolean(running)} loading={running?.job === job} icon={<IconSparkles size={15} />}>
          {failed[job] ? t('再試一次') : label}
        </Button>
      </div>
    )

  return (
    <div className="space-y-2 rounded-2xl bg-surface px-4 py-3 text-sm shadow-sheet">
      {line('answer', answers.length, t('有 {n} 題卷上沒有答案。', { n: answers.length }), t('AI 作答'))}
      {line('explain', explanations.length, t('有 {n} 題有答案但沒有詳解。', { n: explanations.length }), t('AI 詳解'))}
    </div>
  )
}
