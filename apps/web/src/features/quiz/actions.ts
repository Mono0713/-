'use server'

import { draftOf } from '@exam/bank'
import { markOpenAnswers } from '@exam/grading'
import { buildItems, gradeItem, isOver, needsTeacher, type QuizAttempt, type QuizResponse, type QuizSettings, type QuizSource } from '@exam/quiz'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { currentOwner, localeOf, services, teacherFor } from '@/server/context'
import { startTeacher } from './teacher'
import { revealedItem } from './visible'

function owned(id: string): QuizAttempt {
  const attempt = services().quizzes.get(id)
  if (!attempt || attempt.ownerId !== currentOwner()) throw new Error('找不到這次測驗')
  return attempt
}

export interface NewQuiz {
  questionIds: string[]
  settings: QuizSettings
  /** Draw this many questions at random from the chosen ones; null keeps them all. */
  limit: number | null
}

/** Starts a quiz and opens it; returns only when it cannot start. */
export async function createQuiz(input: NewQuiz): Promise<{ error: string } | undefined> {
  const { bank, quizzes } = services()
  const owner = currentOwner()
  let questions = bank.getQuestions(input.questionIds).filter((q) => q.ownerId === owner)
  if (!questions.length) return { error: '請至少選一題' }
  if (input.limit && input.limit < questions.length) {
    questions = [...questions].sort(() => Math.random() - 0.5).slice(0, input.limit)
    questions.sort((a, b) => input.questionIds.indexOf(a.id) - input.questionIds.indexOf(b.id))
  }
  const exams = new Map([...new Set(questions.map((q) => q.examId))].map((id) => [id, bank.getExam(id)]))
  const sources: QuizSource[] = questions.map((q) => {
    const group = q.groupId ? exams.get(q.examId)?.groups.find((g) => g.id === q.groupId) : undefined
    return { questionId: q.id, question: draftOf(q), group: group ? { stem: group.stem, figures: group.figures } : null }
  })
  const titles = [...exams.values()].map((e) => e?.title ?? '未命名考卷')
  const settings: QuizSettings = {
    ...input.settings,
    timeLimitMinutes: input.settings.mode === 'exam' && input.settings.timeLimitMinutes ? input.settings.timeLimitMinutes : null,
  }
  const now = new Date()
  const attempt = quizzes.create({
    ownerId: owner,
    title: titles.length === 1 ? titles[0]! : `${titles[0]} 等 ${titles.length} 份考卷`,
    examIds: [...exams.keys()],
    settings,
    items: buildItems(sources, settings),
    responses: sources.map(() => null),
    markings: sources.map(() => null),
    checked: sources.map(() => false),
    startedAt: now.toISOString(),
    deadline: settings.timeLimitMinutes ? new Date(now.getTime() + settings.timeLimitMinutes * 60_000).toISOString() : null,
    finishedAt: null,
  })
  revalidatePath('/quiz')
  redirect(`/quiz/${attempt.id}`)
}

/** Saves an answer while the quiz is running; answers after the time limit are ignored. */
export async function saveResponse(id: string, index: number, response: QuizResponse): Promise<{ accepted: boolean }> {
  const attempt = owned(id)
  if (isOver(attempt) || attempt.checked[index]) return { accepted: false }
  attempt.responses[index] = response
  services().quizzes.save(attempt)
  return { accepted: true }
}

/** Practice mode: locks the answer and reveals the key, explanation and translation. */
export async function checkAnswer(id: string, index: number, response: QuizResponse) {
  const attempt = owned(id)
  if (attempt.settings.mode !== 'practice') throw new Error('只有練習模式能逐題看答案')
  if (!attempt.checked[index] && !attempt.finishedAt) {
    attempt.responses[index] = response
    attempt.checked[index] = true
    services().quizzes.save(attempt)
  }
  const item = attempt.items[index]!
  // An answer the key cannot settle is marked by the AI teacher right away, when there is one.
  const teacher = teacherFor(attempt.ownerId)
  if (teacher && needsTeacher(item, attempt.responses[index] ?? null, attempt.markings[index] ?? null)) {
    try {
      const { markings } = await markOpenAnswers(attempt, { grader: teacher.teacher, cache: services().gradingCache, language: localeOf(attempt.ownerId), only: [index] })
      attempt.markings[index] = markings[index] ?? null
      services().quizzes.save(attempt)
    } catch {
      // Marking can wait: the person can mark it or ask again from the results.
    }
  }
  const marking = attempt.markings[index] ?? null
  return { item: revealedItem(item), grade: gradeItem(item, attempt.responses[index] ?? null, marking), marking }
}

/** The person marks their own open answer against the model answer: credit 1 is right, 0 is wrong, null clears it. */
export async function markAnswer(id: string, index: number, credit: number | null) {
  const attempt = owned(id)
  const revealed = attempt.finishedAt !== null || attempt.checked[index]
  if (!revealed) throw new Error('交卷後才能自評')
  const marking = credit === null ? null : { credit: Math.min(1, Math.max(0, credit)), by: 'self' as const, feedback: null }
  attempt.markings[index] = marking
  services().quizzes.save(attempt)
  revalidatePath(`/quiz/${id}`)
  const item = attempt.items[index]!
  return { marking, grade: gradeItem(item, attempt.responses[index] ?? null, marking) }
}

export async function finishQuiz(id: string) {
  const attempt = owned(id)
  if (!attempt.finishedAt) {
    const now = new Date()
    const end = attempt.deadline && now > new Date(attempt.deadline) ? attempt.deadline : now.toISOString()
    services().quizzes.save({ ...attempt, finishedAt: end })
    startTeacher(id)
  }
  revalidatePath('/quiz')
  revalidatePath(`/quiz/${id}`)
}

/** Asks the AI teacher again for answers still waiting to be marked, e.g. after it failed or was turned on. */
export async function askTeacher(id: string): Promise<{ error: string } | undefined> {
  const attempt = owned(id)
  if (!attempt.finishedAt) return { error: '交卷後才能批改' }
  if (!teacherFor(attempt.ownerId)) return { error: '沒有可用的 AI：請在設定裡開啟 AI 批改並加上 API 金鑰。' }
  startTeacher(id)
  revalidatePath(`/quiz/${id}`)
}

export async function deleteQuiz(id: string) {
  owned(id)
  services().quizzes.delete(id)
  revalidatePath('/quiz')
  redirect('/quiz')
}
