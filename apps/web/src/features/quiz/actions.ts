'use server'

import { MAX_MESSAGE, markOpenAnswers, translationKey, unreadHandwriting } from '@exam/grading'
import { gradeItem, isOver, needsTeacher, type QuizAttempt, type QuizItem, type QuizResponse, type QuizSettings, type TutorTurn } from '@exam/quiz'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { graderFor, keyRule, selfMarks } from '@/server/classes'
import { currentOwner, localeOf, services } from '@/server/context'
import { translatorFor, tutorFor } from '@/server/ai'
import { ownedAttempt } from '@/server/owned'
import { getT } from '@/shared/i18n/server'
import { startQuiz } from './start'
import { readInk, startTeacher } from './teacher'
import { keyShown, revealedItem } from './visible'

async function owned(id: string): Promise<QuizAttempt> {
  const attempt = await ownedAttempt(id)
  if (!attempt) {
    const t = await getT()
    throw new Error(t('找不到這次測驗'))
  }
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
  const t = await getT()
  const owner = await currentOwner()
  const questions = (await services().bank.getQuestions(input.questionIds)).filter((q) => q.ownerId === owner)
  if (!questions.length) return { error: t('請至少選一題') }
  const attempt = await startQuiz({ ownerId: owner, questions, order: input.questionIds, settings: input.settings, limit: input.limit })
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
  if (attempt.settings.mode !== 'practice') {
    const t = await getT()
    throw new Error(t('只有練習模式能逐題看答案'))
  }
  // Once the attempt is over (handed in, or past its deadline) no new answer is taken or revealed.
  let closed = false
  attempt =
    (await services().quizzes.update(id, (a) => {
      if (a.checked[index]) return null
      if (isOver(a)) {
        closed = true
        return null
      }
      return { ...a, responses: withAt(a.responses, index, fromClient(response)), checked: withAt(a.checked, index, true) }
    })) ?? attempt
  if (closed) return { closed: true as const }
  const item = attempt.items[index]!
  // Most answers are settled by the key alone; only look up the AI teacher when one is needed.
  const unread = unreadHandwriting(attempt.responses[index]) && !attempt.markings[index]
  const teacher = unread || needsTeacher(item, attempt.responses[index] ?? null, attempt.markings[index] ?? null) ? await graderFor(attempt) : null
  // A handwritten answer is read into text first, then checked like a typed one.
  if (teacher && unread) {
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
  return { item: revealedItem(item, await keyRule(attempt)), grade: gradeItem(item, answer, marking), marking, response: answer }
}

/** The person marks their own open answer against the model answer: credit 1 is right, 0 is wrong, null clears it. */
export async function markAnswer(id: string, index: number, credit: number | null) {
  const t = await getT()
  const attempt = await owned(id)
  const revealed = attempt.finishedAt !== null || attempt.checked[index]
  if (!revealed) throw new Error(t('交卷後才能自評'))
  if (!selfMarks(attempt)) throw new Error(t('班級作業由老師批改'))
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
  const t = await getT()
  const attempt = await owned(id)
  if (!attempt.finishedAt) return { error: t('交卷後才能批改') }
  if (!(await graderFor(attempt))) return { error: attempt.assignment ? t('這個班級的 AI 批改現在沒有開放，老師會批改。') : t('沒有可用的 AI：請在設定裡開啟 AI 批改並加上 API 金鑰。') }
  await startTeacher(id)
  revalidatePath(`/quiz/${id}`)
}

/** Pictures sent with one question to 問 AI, at most; a question rarely has more. */
const MAX_PICTURES = 6

/** The pictures of a question in an attempt, its group's first, as stored files. */
async function pictures(item: QuizItem): Promise<Buffer[]> {
  const { files } = services()
  const keys = [...(item.group?.figures ?? []), ...item.question.figures].flatMap((f) => (f.image ? [f.image.file] : [])).slice(0, MAX_PICTURES)
  return (await Promise.all(keys.map((k) => files.read(k).catch(() => null)))).filter((b): b is Buffer => Boolean(b))
}

/** Messages one question's conversation keeps; then it starts over. */
const MAX_TURNS = 40

/**
 * Asks the AI tutor about one question once its answer has been shown: the first time to explain it,
 * then follow-up questions. The conversation is kept with the attempt. Paid with the student's own keys.
 */
export async function askTutor(id: string, index: number, message: string): Promise<{ turns: TutorTurn[] } | { error: string }> {
  const t = await getT()
  const attempt = await owned(id)
  const item = attempt.items[index]
  if (!item) return { error: t('找不到這一題') }
  if (!attempt.finishedAt && !attempt.checked[index]) return { error: t('看過答案後才能問 AI') }
  // The tutor would give the answer away.
  if (!keyShown(await keyRule(attempt))) return { error: attempt.assignment ? t('老師公開答案後才能問 AI。') : t('這份考卷的答案沒有公開，不能問 AI。') }
  const text = message.trim().slice(0, MAX_MESSAGE)
  if (!text) return { error: t('請輸入問題') }
  const images = await pictures(item)
  const tutor = await tutorFor(attempt.ownerId, images.length > 0)
  if (!tutor) return { error: t('還沒有可用的 AI：請到設定加上 API 金鑰。') }
  const earlier = attempt.tutoring?.[index] ?? []
  const asked: TutorTurn = { from: 'student', text, at: new Date().toISOString() }
  let reply: string
  try {
    reply = await tutor.reply({ item, response: attempt.responses[index] ?? null, marking: attempt.markings[index] ?? null, turns: [...earlier, asked], language: await localeOf(attempt.ownerId), images })
  } catch {
    return { error: t('AI 暫時沒有回應，請再試一次。') }
  }
  const answered: TutorTurn = { from: 'tutor', text: reply, at: new Date().toISOString() }
  const saved = await services().quizzes.update(id, (a) => {
    const turns = [...(a.tutoring?.[index] ?? []), asked, answered].slice(-MAX_TURNS)
    return { ...a, tutoring: { ...a.tutoring, [index]: turns } }
  })
  return { turns: saved?.tutoring?.[index] ?? [...earlier, asked, answered] }
}

/**
 * A question in the reader's language, options included. The stem printed on the paper wins when there
 * is one; the rest comes from this attempt, else from the shared cache (anyone who read the same text in
 * the same language), else from the translation way chosen in settings, which is then kept in both.
 * Not while an exam is running.
 */
export async function translateQuestion(id: string, index: number): Promise<{ stem: string; options: string[] } | { error: string }> {
  const t = await getT()
  const attempt = await owned(id)
  const item = attempt.items[index]
  if (!item) return { error: t('找不到這一題') }
  if (attempt.settings.mode === 'exam' && !attempt.finishedAt) return { error: t('考試中不能翻譯。') }
  const q = item.question
  const printed = q.translation?.trim() || null
  if (printed && !q.options.some((o) => o.content.trim())) return { stem: printed, options: [] }
  const shown = (t: { stem: string; options: string[] }) => ({ stem: printed ?? t.stem, options: t.options })
  const { engine, translator } = await translatorFor(attempt.ownerId)
  const kept = attempt.translations?.[index]
  if (kept && (kept.engine ?? 'ai') === engine) return shown(kept)
  const language = await localeOf(attempt.ownerId)
  const { quizzes, translationCache } = services()
  const keep = (translation: { stem: string; options: string[] }) =>
    quizzes.update(id, (a) => ({ ...a, translations: { ...a.translations, [index]: { ...translation, engine } } }))
  // the shared cache holds options in text order, so a shuffled attempt finds the same entry
  const sorted = [...q.options].sort((x, y) => (x.content < y.content ? -1 : x.content > y.content ? 1 : 0))
  const source = { stem: q.stem, options: sorted }
  const inOrder = (t: { stem: string; options: string[] }) => {
    const byText = new Map(sorted.map((o, i) => [o.content, t.options[i] ?? '']))
    return { stem: t.stem, options: q.options.map((o) => byText.get(o.content) ?? '') }
  }
  // an AI translation someone already paid for is better than a free one, so the free way takes it too
  for (const way of engine === 'free' ? (['ai', 'free'] as const) : (['ai'] as const)) {
    const cached = await translationCache.get(translationKey(source, language, way)).catch(() => null)
    if (cached) {
      const translation = inOrder(cached)
      await keep(translation)
      return shown(translation)
    }
  }
  let made: { stem: string; options: string[] }
  try {
    made = await translator.translate(source, language)
  } catch {
    if (printed) return { stem: printed, options: [] }
    return { error: engine === 'free' ? t('免費翻譯暫時沒有回應，請再試一次，或到設定改用 AI 翻譯。') : t('翻譯暫時沒有回應，請再試一次。') }
  }
  const translation = inOrder(made)
  await Promise.all([keep(translation), translationCache.set(translationKey(source, language, engine), made).catch(() => {})])
  return shown(translation)
}

/** Removes a quiz for good; the list calls it once the 復原 note has run out. */
export async function removeQuiz(id: string) {
  const t = await getT()
  const attempt = await owned(id)
  // What was handed in to a class stays for the teacher.
  if (!selfMarks(attempt)) throw new Error(t('班級作業的紀錄不能刪除'))
  await services().quizzes.delete(id)
  revalidatePath('/quiz')
}
