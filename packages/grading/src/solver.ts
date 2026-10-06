import type { DraftQuestion } from '@exam/core'
import sharp from 'sharp'
import { z } from 'zod'
import type { TextModel } from './model.ts'
import { LANGUAGE_NAMES } from './teacher.ts'

export interface SolveRequest {
  question: DraftQuestion
  /** The passage or shared text of its group (閱讀題組). */
  shared?: string | null
  /** The question's figures (and its group's), any image format, shown to the model as PNG. */
  images: Buffer[]
  /** Language the explanation is written in, e.g. "zh-Hant". */
  language: string
}

const Answer = z.object({ values: z.array(z.string()) })
const Explanation = z.object({ explanation: z.string() })

/**
 * Works out the answer to a question whose paper printed no key, or writes a worked explanation
 * for one that has a key. The two are separate calls, each on its own model, so a person pays only
 * for what they ask for. Answers follow the format the recognizer writes, so the quiz marks them as
 * usual; the caller labels them as the AI's, for the person to check.
 */
export class AiSolver {
  constructor(private readonly model: TextModel) {}

  /** The answer key's values for a question without one. */
  async solve(req: SolveRequest): Promise<string[]> {
    const reply = await this.ask(SOLVE, prompt(req), req, Answer)
    const values = reply.values.map((v) => v.trim()).filter(Boolean)
    if (!values.length) throw new Error('the reply gave no answer')
    return normalise(req.question, values)
  }

  /** A worked explanation that arrives at the question's key, in `req.language`. */
  async explain(req: SolveRequest): Promise<string> {
    const key = req.question.answer.values.filter((v) => v.trim())
    const explanation = (await this.ask(explainSystem(LANGUAGE_NAMES[req.language] ?? req.language), `${prompt(req)}\n\nAnswer key:\n${key.join('\n')}`, req, Explanation)).explanation.trim()
    if (!explanation) throw new Error('the reply gave no explanation')
    return explanation
  }

  private async ask<T>(system: string, text: string, req: SolveRequest, shape: z.ZodType<T>): Promise<T> {
    const images = await Promise.all(req.images.map((b) => sharp(b).png().toBuffer()))
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const reply = await this.model.complete(system, text, images)
        return shape.parse(JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1)))
      } catch (err) {
        lastError = err
      }
    }
    throw lastError
  }
}

const SOLVE = [
  'You are an experienced teacher writing the answer key for one exam question.',
  'Work the question out carefully, then reply with one JSON object only: {"values": [...]}.',
  'Format of "values":',
  '- single_choice / multiple_choice: the option labels only, without brackets, e.g. ["C"] or ["A", "C", "E"].',
  '- true_false: ["true"] or ["false"].',
  '- fill_in_blank: one entry per blank, in order; when the blanks are filled with labels from a printed list, one label per blank.',
  '- matching: one option label per numbered item, in the items\' order, e.g. ["C", "A", "B"].',
  '- short_answer, essay, calculation, other: the full model answer as one entry; calculation ends with the final result.',
  '- drawing: one entry saying in words what a correct drawing shows.',
  'Write math as LaTeX inside $...$.',
].join('\n')

function explainSystem(language: string): string {
  return [
    'You are an experienced teacher. Write a short worked explanation of how to reach the given answer key for one exam question, one a student can follow.',
    `Write it in ${language}, using Markdown and LaTeX ($...$) for formulas. Do not question the key.`,
    'Reply with one JSON object only: {"explanation": "..."}.',
  ].join('\n')
}

function prompt({ question: q, shared }: SolveRequest): string {
  const lines: string[] = [`Question type: ${q.type}`]
  if (shared?.trim()) lines.push(`Shared passage:\n${shared.trim()}`)
  lines.push(`Question:\n${q.stem}`)
  if (q.options.length) lines.push(`Options:\n${q.options.map((o) => `(${o.label}) ${o.content}`).join('\n')}`)
  for (const f of q.figures) if (f.description) lines.push(`Figure: ${f.description}`)
  const blanks = q.figures.flatMap((f) => f.image?.blanks ?? f.blanks)
  if (blanks.length) lines.push(`Blanks on the figure, in order: ${blanks.map((b) => b.label).join(', ')}`)
  if (q.section) lines.push(`Section heading: ${q.section}`)
  return lines.join('\n\n')
}

/** Choice answers come back as the paper's labels ("(c)" → "C"); everything else as written. */
function normalise(q: DraftQuestion, values: string[]): string[] {
  if (q.type === 'true_false') return [/^(true|t|o|○|yes|對|是)$/i.test(values[0]!) ? 'true' : 'false']
  if (!q.options.length) return values
  const labels = new Map(q.options.map((o) => [o.label.trim().toLowerCase(), o.label]))
  return values.map((v) => labels.get(v.replace(/[()（）]/g, '').trim().toLowerCase()) ?? v)
}
