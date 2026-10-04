import { draftOf, type BankExam, type BankQuestion } from '@exam/bank'
import { buildItems, type QuizAttempt, type QuizSettings, type QuizSource } from '@exam/quiz'
import { services } from '@/server/context'
import type { T } from '@/shared/i18n/format'
import { getT } from '@/shared/i18n/server'

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
  let questions = input.questions
  if (input.limit && input.limit < questions.length) {
    const order = input.order ?? questions.map((q) => q.id)
    questions = draw(questions, input.limit)
    questions.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  }
  const { sources, exams } = await sourcesOf(questions)
  return startFromSources({
    ownerId: input.ownerId,
    title: titles(exams, await getT()),
    // Someone else's exams are not linked: the person cannot open them in the bank.
    examIds: input.share ? [] : [...exams.keys()],
    sources,
    settings: input.settings,
    ...(input.share && { share: input.share }),
  })
}

/**
 * About `limit` questions at random. A reading passage's questions are drawn as a whole, never
 * split, so the count can go a little over when the last pick is a passage.
 */
function draw(questions: BankQuestion[], limit: number): BankQuestion[] {
  const units = new Map<string, BankQuestion[]>()
  for (const q of questions) {
    const key = q.groupId ? `${q.examId}:${q.groupId}` : q.id
    units.set(key, [...(units.get(key) ?? []), q])
  }
  const picked: BankQuestion[] = []
  for (const unit of [...units.values()].sort(() => Math.random() - 0.5)) {
    if (picked.length >= limit) break
    picked.push(...unit)
  }
  return picked
}

/** Bank questions as a quiz takes them, each with its group's passage and figures, and the exams they come from. */
export async function sourcesOf(questions: BankQuestion[]): Promise<{ sources: QuizSource[]; exams: Map<string, BankExam | null> }> {
  const { bank } = services()
  const examIds = [...new Set(questions.map((q) => q.examId))]
  const exams = new Map(await Promise.all(examIds.map(async (id) => [id, await bank.getExam(id)] as const)))
  const sources = questions.map((q): QuizSource => {
    const group = q.groupId ? exams.get(q.examId)?.groups.find((g) => g.id === q.groupId) : undefined
    return { questionId: q.id, question: draftOf(q), group: group ? { stem: group.stem, figures: group.figures } : null }
  })
  return { sources, exams }
}

function titles(exams: Map<string, { title: string | null } | null>, t: T): string {
  const list = [...exams.values()].map((e) => e?.title ?? t('未命名考卷'))
  return list.length === 1 ? list[0]! : t('{title} 等 {n} 份考卷', { title: list[0]!, n: list.length })
}

/**
 * Makes a quiz attempt from questions already copied out of the bank, such as a class
 * assignment's frozen questions. `endsBy` ends it early, e.g. when the assignment closes.
 */
export async function startFromSources(input: {
  ownerId: string
  title: string
  examIds: string[]
  sources: QuizSource[]
  settings: QuizSettings
  share?: string
  assignment?: QuizAttempt['assignment']
  endsBy?: string | null
}): Promise<QuizAttempt> {
  const settings: QuizSettings = {
    ...input.settings,
    timeLimitMinutes: input.settings.mode === 'exam' && input.settings.timeLimitMinutes ? input.settings.timeLimitMinutes : null,
  }
  const now = new Date()
  const limit = settings.timeLimitMinutes ? now.getTime() + settings.timeLimitMinutes * 60_000 : null
  const close = input.endsBy ? new Date(input.endsBy).getTime() : null
  const end = limit !== null && close !== null ? Math.min(limit, close) : (limit ?? close)
  const { sources } = input
  return services().quizzes.create({
    ownerId: input.ownerId,
    title: input.title,
    examIds: input.examIds,
    ...(input.share && { share: input.share }),
    ...(input.assignment && { assignment: input.assignment }),
    settings,
    items: buildItems(sources, settings),
    responses: sources.map(() => null),
    markings: sources.map(() => null),
    checked: sources.map(() => false),
    startedAt: now.toISOString(),
    deadline: end !== null ? new Date(end).toISOString() : null,
    finishedAt: null,
  })
}
