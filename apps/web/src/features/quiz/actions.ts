'use server'

import { draftOf } from '@exam/bank'
import { markOpenAnswers, unreadHandwriting } from '@exam/grading'
import { buildItems, gradeItem, isOver, needsTeacher, type QuizAttempt, type QuizResponse, type QuizSettings, type QuizSource } from '@exam/quiz'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { currentOwner, localeOf, services, teacherFor } from '@/server/context'
import { ownedAttempt } from '@/server/owned'
import { readInk, startTeacher } from './teacher'
import { revealedItem } from './visible'

async function owned(id: string): Promise<QuizAttempt> {
  const attempt = await ownedAttempt(id)
  if (!attempt) throw new Error('找不到這次測驗')
  return attempt
}

/** What the browser may send as an answer: text and ink only; whether AI read it is decided here. */
function fromClient(response: QuizResponse): QuizResponse {
  const { values, scratch, handwriting } = response
  return { values: Array.isArray(values) ? values.map(String) : [], ...(scratch && { scratch }), ...(handwriting && { handwriting }) }
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
  const owner = await currentOwner()
  let questions = (await bank.getQuestions(input.questionIds)).filter((q) => q.ownerId === owner)
  if (!questions.length) return { error: '請至少選一題' }
  if (input.limit && input.limit < questions.length) {
    questions = [...questions].sort(() => Math.random() - 0.5).slice(0, input.limit)
    questions.sort((a, b) => input.questionIds.indexOf(a.id) - input.questionIds.indexOf(b.id))
  }
  const examIds = [...new Set(questions.map((q) => q.examId))]
  const exams = new Map(await Promise.all(examIds.map(async (id) => [id, await bank.getExam(id)] as const)))
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
  const attempt = await quizzes.create({
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
  await owned(id)
  let accepted = false
  await services().quizzes.update(id, (attempt) => {
    if (isOver(attempt) || attempt.checked[index]) return null
    accepted = true
    return { ...attempt, responses: withAt(attempt.responses, index, fromClient(response)) }
  })
  return { accepted }
}

/** A copy of the list with one entry replaced. */
function withAt<T>(list: T[], index: number, value: T): T[] {
  const next = [...list]
  next[index] = value
  return next
}

/** Practice mode: locks the answer and reveals the key, explanation and translation. */
export async function checkAnswer(id: string, index: number, response: QuizResponse) {
  let attempt = await owned(id)
  if (attempt.settings.mode !== 'practice') throw new Error('只有練習模式能逐題看答案')
  attempt =
    (await services().quizzes.update(id, (a) =>
      a.checked[index] || a.finishedAt ? null : { ...a, responses: withAt(a.responses, index, fromClient(response)), checked: withAt(a.checked, index, true) },
    )) ?? attempt
  const item = attempt.items[index]!
  const teacher = await teacherFor(attempt.ownerId)
  // A handwritten answer is read into text first, then checked like a typed one.
  if (teacher && unreadHandwriting(attempt.responses[index]) && !attempt.markings[index]) {
    try {
      attempt = await readInk(attempt, teacher, [index])
    } catch {
      // It stays unread: the person can mark it against the key.
    }
  }
  // An answer the key cannot settle is marked by the AI teacher right away, when there is one.
  if (teacher && needsTeacher(item, attempt.responses[index] ?? null, attempt.markings[index] ?? null)) {
    try {
      const { markings } = await markOpenAnswers(attempt, { grader: teacher.teacher, cache: services().gradingCache, language: await localeOf(attempt.ownerId), only: [index] })
      attempt = (await services().quizzes.update(id, (a) => ({ ...a, markings: withAt(a.markings, index, markings[index] ?? null) }))) ?? attempt
    } catch {
      // Marking can wait: the person can mark it or ask again from the results.
    }
  }
  const marking = attempt.markings[index] ?? null
  const answer = attempt.responses[index] ?? null
  return { item: revealedItem(item), grade: gradeItem(item, answer, marking), marking, response: answer }
}

/** The person marks their own open answer against the model answer: credit 1 is right, 0 is wrong, null clears it. */
export async function markAnswer(id: string, index: number, credit: number | null) {
  const attempt = await owned(id)
  const revealed = attempt.finishedAt !== null || attempt.checked[index]
  if (!revealed) throw new Error('交卷後才能自評')
  const marking = credit === null ? null : { credit: Math.min(1, Math.max(0, credit)), by: 'self' as const, feedback: null }
  await services().quizzes.update(id, (a) => ({ ...a, markings: withAt(a.markings, index, marking) }))
  revalidatePath(`/quiz/${id}`)
  const item = attempt.items[index]!
  return { marking, grade: gradeItem(item, attempt.responses[index] ?? null, marking) }
}

export async function finishQuiz(id: string) {
  await owned(id)
  let handedIn = false
  await services().quizzes.update(id, (attempt) => {
    if (attempt.finishedAt) return null
    handedIn = true
    const now = new Date()
    const end = attempt.deadline && now > new Date(attempt.deadline) ? attempt.deadline : now.toISOString()
    return { ...attempt, finishedAt: end }
  })
  if (handedIn) await startTeacher(id)
  revalidatePath('/quiz')
  revalidatePath(`/quiz/${id}`)
}

/** Asks the AI teacher again for answers still waiting to be marked, e.g. after it failed or was turned on. */
export async function askTeacher(id: string): Promise<{ error: string } | undefined> {
  const attempt = await owned(id)
  if (!attempt.finishedAt) return { error: '交卷後才能批改' }
  if (!(await teacherFor(attempt.ownerId))) return { error: '沒有可用的 AI：請在設定裡開啟 AI 批改並加上 API 金鑰。' }
  await startTeacher(id)
  revalidatePath(`/quiz/${id}`)
}

/** Removes a quiz for good; the list calls it once the 復原 note has run out. */
export async function removeQuiz(id: string) {
  await owned(id)
  await services().quizzes.delete(id)
  revalidatePath('/quiz')
}
