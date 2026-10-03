import { draftOf, type BankQuestion } from '@exam/bank'
import { buildItems, type QuizAttempt, type QuizSettings, type QuizSource } from '@exam/quiz'
import { services } from '@/server/context'

/**
 * Makes a quiz attempt for `ownerId` from bank questions, which may belong to someone
 * else when they come from a shared exam (`share`). The questions are copied into the
 * attempt, so later edits or a closed link do not change it.
 */
export async function startQuiz(input: {
  ownerId: string
  questions: BankQuestion[]
  /** Question ids in the order picked, to keep after drawing at random. */
  order?: string[]
  settings: QuizSettings
  /** Draw this many questions at random; null keeps them all. */
  limit?: number | null
  share?: string
}): Promise<QuizAttempt> {
  const { bank, quizzes } = services()
  let questions = input.questions
  if (input.limit && input.limit < questions.length) {
    const order = input.order ?? questions.map((q) => q.id)
    questions = [...questions].sort(() => Math.random() - 0.5).slice(0, input.limit)
    questions.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
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
  return quizzes.create({
    ownerId: input.ownerId,
    title: titles.length === 1 ? titles[0]! : `${titles[0]} 等 ${titles.length} 份考卷`,
    // Someone else's exams are not linked: the person cannot open them in the bank.
    examIds: input.share ? [] : [...exams.keys()],
    ...(input.share && { share: input.share }),
    settings,
    items: buildItems(sources, settings),
    responses: sources.map(() => null),
    markings: sources.map(() => null),
    checked: sources.map(() => false),
    startedAt: now.toISOString(),
    deadline: settings.timeLimitMinutes ? new Date(now.getTime() + settings.timeLimitMinutes * 60_000).toISOString() : null,
    finishedAt: null,
  })
}
