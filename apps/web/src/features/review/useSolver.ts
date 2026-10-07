'use client'

import { type DraftExam, type DraftQuestion, needsAnswer, needsExplanation, SOLVABLE } from '@exam/core'
import { useCallback, useRef, useState } from 'react'
import { msg } from '@/shared/i18n/format'
import { solveQuestion } from './actions'

/** The note an AI answer carries until the person confirms the card. Translated where shown. */
export const AI_ANSWER_NOTE = msg('答案由 AI 作答，請確認是否正確。')

const AT_ONCE = 3

export type SolveJob = 'answer' | 'explain'
/** A whole-exam run: only the questions still missing it, or every question it can cover (redone, one undo step). */
export type SolveScope = 'missing' | 'all'
type Patch = (q: DraftQuestion) => DraftQuestion

const NEEDS: Record<SolveJob, (q: DraftQuestion) => boolean> = { answer: needsAnswer, explain: needsExplanation }

/** Questions the AI can work on at all: those with an answer to give. */
export const canSolve = (q: DraftQuestion) => SOLVABLE.has(q.type)

/** How a reply lands in its card. `again` (one question, asked for) replaces what is there. */
function patchFor(job: SolveJob, result: { values: string[] } | { explanation: string }, again: boolean): Patch {
  return (q) => {
    if (!again && !NEEDS[job](q)) return q
    if ('explanation' in result) return { ...q, explanation: result.explanation }
    return {
      ...q,
      answer: { values: result.values, source: 'ai' },
      confidence: q.confidence === 'high' ? 'medium' : q.confidence,
      issues: [...q.issues.filter((x) => x !== AI_ANSWER_NOTE), AI_ANSWER_NOTE],
    }
  }
}

export interface Solver {
  /** Indices of the questions each job would cover across the whole exam. */
  missing: Record<SolveJob, number[]>
  /** Every question each job can work on: all that take an answer, and for explanations those with a key. */
  all: Record<SolveJob, number[]>
  /** The whole-exam run in progress, if any. */
  running: { job: SolveJob; scope: SolveScope; done: number; total: number } | null
  /** How the last run ended: how many the AI could not do, or an error for one question. */
  result: { job: SolveJob; scope?: SolveScope; failed: number; total: number; error?: string } | null
  /** Card keys of questions the AI is working on right now, and on what. */
  busy: Map<string, SolveJob>
  runAll: (job: SolveJob, scope: SolveScope) => void
  /** One question, on request: a key or explanation already there is redone (Ctrl+Z brings it back). */
  runOne: (index: number, job: SolveJob) => void
  dismiss: () => void
}

/**
 * AI 作答 (works out the answers the paper left out) and AI 詳解 (explanations for questions that
 * have a key), for the whole exam or one question. Each runs on its own model from settings.
 * Replies land in their cards as they come back; AI answers are marked 「AI 解答」 and flagged to check.
 */
export function useSolver(
  importId: string,
  draft: DraftExam,
  keys: string[],
  /** Lands a reply in its card; replies with the same `tag` are undone together. */
  onSolved: (key: string, patch: Patch, tag: string) => void,
): Solver {
  const [running, setRunning] = useState<Solver['running']>(null)
  const [result, setResult] = useState<Solver['result']>(null)
  const [busy, setBusy] = useState<Map<string, SolveJob>>(new Map())
  const latest = useRef({ draft, keys })
  latest.current = { draft, keys }

  const missing = {
    answer: draft.questions.flatMap((q, i) => (needsAnswer(q) ? [i] : [])),
    explain: draft.questions.flatMap((q, i) => (needsExplanation(q) ? [i] : [])),
  }
  const all = {
    answer: draft.questions.flatMap((q, i) => (canSolve(q) ? [i] : [])),
    explain: draft.questions.flatMap((q, i) => (canSolve(q) && q.answer.values.some((v) => v.trim()) ? [i] : [])),
  }
  const mark = (key: string, job: SolveJob | null) =>
    setBusy((b) => {
      const next = new Map(b)
      if (job) next.set(key, job)
      else next.delete(key)
      return next
    })
  const ask = (index: number, job: SolveJob, again: boolean) => {
    const { draft: d, keys: k } = latest.current
    const question = d.questions[index]!
    const shared = d.groups.find((g) => g.id === question.groupId)?.stem ?? null
    return { key: k[index]!, request: solveQuestion(importId, job, question, shared, again).catch(() => ({ error: '' })) }
  }

  const runAll = async (job: SolveJob, scope: SolveScope) => {
    if (running) return
    const indices = (scope === 'all' ? all : missing)[job]
    const again = scope === 'all'
    // the whole run is undone in one step
    const tag = `ai-${job}-${Date.now()}`
    let done = 0, failed = 0, next = 0
    setResult(null)
    setRunning({ job, scope, done, total: indices.length })
    const worker = async () => {
      while (next < indices.length) {
        const { key, request } = ask(indices[next++]!, job, again)
        mark(key, job)
        const reply = await request
        mark(key, null)
        if ('error' in reply) failed++
        else onSolved(key, patchFor(job, reply, again), tag)
        setRunning({ job, scope, done: ++done, total: indices.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, indices.length) }, worker))
    setRunning(null)
    setResult({ job, scope, failed, total: indices.length })
  }

  const runOne = async (index: number, job: SolveJob) => {
    if (busy.has(latest.current.keys[index]!)) return
    const { key, request } = ask(index, job, true)
    mark(key, job)
    const reply = await request
    mark(key, null)
    if ('error' in reply) setResult({ job, failed: 1, total: 1, error: reply.error })
    else onSolved(key, patchFor(job, reply, true), `ai-one-${Date.now()}`)
  }

  const dismiss = useCallback(() => setResult(null), [])
  return { missing, all, running, result, busy, runAll: (job, scope) => void runAll(job, scope), runOne: (i, job) => void runOne(i, job), dismiss }
}
