import { needsTeacher, type AnswerGrader, type GradingTask, type Marking, type QuizAttempt } from '@exam/quiz'
import { cacheKey, type GradingCache } from './cache.ts'

export interface MarkResult {
  /** The attempt's markings with the new ones filled in. */
  markings: (Marking | null)[]
  /** Answers the teacher marked in this call, from the model and from the cache. */
  asked: number
  cached: number
}

/**
 * Marks the answers of an attempt that the key could not settle, spending as little as possible:
 * the program's own checks run first (see needsTeacher), answers marked before come from the
 * cache, and everything else goes to the grader together. `only` limits it to some questions.
 */
export async function markOpenAnswers(
  attempt: Pick<QuizAttempt, 'items' | 'responses' | 'markings'>,
  opts: { grader: AnswerGrader; cache: GradingCache; language: string; only?: number[] },
): Promise<MarkResult> {
  const markings = [...attempt.markings]
  const todo: { index: number; task: GradingTask; key: string }[] = []
  let cached = 0
  for (const [index, item] of attempt.items.entries()) {
    const response = attempt.responses[index] ?? null
    if (opts.only && !opts.only.includes(index)) continue
    if (!response || !needsTeacher(item, response, markings[index] ?? null)) continue
    const task = { item, response }
    const key = cacheKey(task, opts.language)
    const hit = await opts.cache.get(key)
    if (hit) {
      markings[index] = hit
      cached++
    } else todo.push({ index, task, key })
  }
  if (todo.length) {
    const results = await opts.grader.markAll(
      todo.map((t) => t.task),
      opts.language,
    )
    for (const [i, t] of todo.entries()) {
      const marking = results[i]
      if (!marking) continue
      markings[t.index] = marking
      await opts.cache.set(t.key, marking)
    }
  }
  return { markings, asked: todo.length, cached }
}
