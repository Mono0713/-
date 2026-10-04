import type { Marking, QuizItem, QuizResponse, TutorTurn } from '@exam/quiz'
import { z } from 'zod'
import type { TextModel } from './model.ts'
import { LANGUAGE_NAMES, questionLines, studentAnswer } from './teacher.ts'

/** Earlier messages sent with each question; older ones are left out. */
const HISTORY = 16
/** A student's message is cut here. */
export const MAX_MESSAGE = 1000

const Reply = z.object({ reply: z.string().min(1) })

export interface TutorQuestion {
  item: QuizItem
  response: QuizResponse | null
  marking: Marking | null
  /** The conversation so far, ending with the student's new message. */
  turns: TutorTurn[]
  language: string
}

/**
 * An AI tutor for one question: explains it against the student's own answer, then
 * answers follow-up questions. It needs no training: everything it knows comes with
 * the request (the question, key, explanation, the student's answer and the talk so far).
 */
export class AiTutor {
  constructor(private readonly model: TextModel) {}

  get label(): string {
    return this.model.model
  }

  async reply(q: TutorQuestion): Promise<string> {
    const text = await this.model.complete(systemPrompt(LANGUAGE_NAMES[q.language] ?? q.language), prompt(q))
    return parseReply(text)
  }
}

/** The reply's text: from the JSON asked for, or the whole text from a model that answered in plain prose. */
export function parseReply(text: string): string {
  const start = text.indexOf('{')
  if (start >= 0) {
    try {
      return Reply.parse(JSON.parse(text.slice(start, text.lastIndexOf('}') + 1))).reply.trim()
    } catch {
      // not the JSON asked for
    }
  }
  const plain = text.trim()
  if (!plain) throw new Error('The tutor gave an empty reply')
  return plain
}

function systemPrompt(language: string): string {
  return `You are a patient, encouraging tutor. A student has just answered one exam question and wants to understand it. Write in ${language}.

- First reply: a full worked solution (詳解) of the question. Start with one sentence on whether the student's answer is right, partly right or wrong. Then give the key idea, every step to the correct answer, and for a choice question why each wrong option is wrong. When the student's answer is wrong, point at the exact step or idea that went wrong.
- Follow-up questions: answer what the student asks, building on what was already said; do not repeat the whole explanation. If they are stuck, try a different angle, an example, or a smaller question they can answer.
- Base the explanation on the reference answer and explanation. If the reference answer looks wrong, say so carefully and explain why. With no reference answer, work it out yourself and say when you are not sure.
- A figure you cannot see: use its description, and say when the answer depends on details it does not give.
- Follow-up replies stay short: a few sentences or a short list, longer only when a calculation needs every step. Use Markdown, and $...$ or $$...$$ for maths.
- Stay with this question and the subject. If asked about something else, steer back in one sentence.

Reply with JSON only: {"reply":"..."}`
}

function prompt({ item, response, marking, turns }: TutorQuestion): string {
  const lines = [`Type: ${item.question.type}.`, ...questionLines(item)]
  const answered = response && response.values.some((v) => v.trim())
  lines.push(`Student's answer:\n${answered ? studentAnswer(item, response) : '(no answer)'}`)
  if (marking) lines.push(`Mark: ${Math.round(marking.credit * 100)}% of the points${marking.feedback ? `. Comment: ${marking.feedback}` : ''}`)
  const recent = turns.slice(-HISTORY)
  lines.push('Conversation:', ...recent.map((t) => `${t.from === 'student' ? 'Student' : 'Tutor'}: ${t.from === 'student' ? t.text.slice(0, MAX_MESSAGE) : t.text}`))
  lines.push("Reply to the student's last message.")
  return lines.join('\n\n')
}
