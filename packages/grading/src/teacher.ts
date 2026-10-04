import type { AnswerGrader, GradingTask, Marking, QuizItem, QuizResponse } from '@exam/quiz'
import { answerKind, toPaperLabels } from '@exam/quiz'
import { z } from 'zod'
import type { TextModel } from './model.ts'

export const LANGUAGE_NAMES: Record<string, string> = {
  'zh-Hant': 'Traditional Chinese (繁體中文)',
  'zh-Hans': 'Simplified Chinese (简体中文)',
  en: 'English',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
  pt: 'Portuguese (Português)',
  vi: 'Vietnamese (Tiếng Việt)',
  th: 'Thai (ไทย)',
  id: 'Indonesian (Bahasa Indonesia)',
}

const Reply = z.object({
  results: z.array(
    z.object({
      item: z.number(),
      credit: z.number().min(0).max(1).nullable(),
      feedback: z.string().default(''),
    }),
  ),
})

/** Items per request: enough to share the instructions, few enough to keep each answer short. */
const BATCH = 10
/** Long essays are cut here; the rest rarely changes a mark and costs tokens. */
const MAX_ANSWER = 4000

/**
 * An AI teacher: marks many answers in one request, against the answer key, or against
 * its own solution when the question has none. Returns null for an answer it cannot judge
 * (for example one that depends on a figure it cannot see); the person marks those.
 */
export class AiTeacher implements AnswerGrader {
  constructor(private readonly model: TextModel) {}

  get label(): string {
    return this.model.model
  }

  async markAll(tasks: GradingTask[], language: string): Promise<(Marking | null)[]> {
    const out: (Marking | null)[] = []
    for (let i = 0; i < tasks.length; i += BATCH) out.push(...(await this.batch(tasks.slice(i, i + BATCH), language)))
    return out
  }

  private async batch(tasks: GradingTask[], language: string): Promise<(Marking | null)[]> {
    const system = systemPrompt(LANGUAGE_NAMES[language] ?? language)
    const prompt = tasks.map((t, i) => describe(t, i + 1)).join('\n\n')
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await this.model.complete(system, prompt)
        const start = text.indexOf('{')
        const reply = Reply.parse(JSON.parse(text.slice(start, text.lastIndexOf('}') + 1)))
        return tasks.map((_, i) => {
          const r = reply.results.find((x) => x.item === i + 1)
          if (!r || r.credit === null) return null
          return { credit: Math.round(r.credit * 100) / 100, by: 'ai' as const, feedback: r.feedback.trim() || null }
        })
      } catch (err) {
        lastError = err
      }
    }
    throw lastError
  }
}

function systemPrompt(language: string): string {
  return `You are a fair, careful teacher marking a student's answers to exam questions. For every item, decide what share of its points the answer earns: "credit" from 0 to 1.

- Judge meaning, not form. Accept equivalent notation (1/2, 0.5, \\frac{1}{2}), the same quantity in other units, synonyms, answers written in another language, and small spelling mistakes that leave a term unambiguous.
- Blanks: each blank is an equal share; credit is the share of blanks answered correctly.
- Calculations: a correct final answer earns full credit. With a wrong final answer, give partial credit for correct method only when the working is shown.
- Short answers and essays: compare with the key points of the reference answer and give credit in proportion to the points covered. Do not reward length or restating the question.
- No reference answer: work out the correct answer yourself first (use the explanation if there is one), then mark against it.
- If you cannot judge an answer, for example because it depends on a figure you cannot see, set "credit" to null.
- "feedback": in ${language}, one or two sentences the student can act on: what is wrong or missing, and the right idea. Use $...$ for maths. Empty when the answer is fully right.

Reply with JSON only, one entry per item:
{"results":[{"item":1,"credit":0.5,"feedback":"..."}]}`
}

/** One item as the teacher sees it: the question, the key, and the student's answer. */
function describe({ item, response }: GradingTask, n: number): string {
  const lines = [`### Item ${n}`, `Type: ${item.question.type}. Points: ${item.question.points ?? 1}.`, ...questionLines(item)]
  lines.push(`Student's answer:\n${studentAnswer(item, response)}`)
  return lines.join('\n')
}

/** The question with its passage, options, figure descriptions, key and explanation. */
export function questionLines(item: QuizItem): string[] {
  const q = item.question
  const lines: string[] = []
  if (item.group?.stem) lines.push(`Shared passage:\n${item.group.stem}`)
  lines.push(`Question:\n${q.stem}`)
  if (q.options.length) lines.push(`Options:\n${q.options.map((o) => `(${o.label}) ${o.content}`).join('\n')}`)
  for (const f of [...(item.group?.figures ?? []), ...q.figures]) if (f.description) lines.push(`Figure (described, not shown): ${f.description}`)
  const key = q.answer.values.filter((v) => v.trim())
  lines.push(key.length ? `Reference answer:\n${numbered(key)}` : 'Reference answer: none given.')
  if (q.explanation) lines.push(`Explanation:\n${q.explanation}`)
  return lines
}

/** The student's answer as text; blanks answered with the option labels shown in this quiz are given in the paper's labels. */
export function studentAnswer(item: QuizItem, response: QuizResponse): string {
  const kind = answerKind(item.question).kind
  const given = response.values.map((v) => (kind === 'blanks' ? toPaperLabels(item, v) : v).slice(0, MAX_ANSWER))
  return kind === 'blanks' ? numbered(given.map((v) => v || '(blank)')) : given.join('\n')
}

const numbered = (values: string[]) => (values.length === 1 ? values[0]! : values.map((v, i) => `${i + 1}. ${v}`).join('\n'))
