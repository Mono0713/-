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

export interface Solved {
  values: string[]
  explanation: string
}

const Reply = z.object({ values: z.array(z.string()), explanation: z.string() })

/**
 * Works out the answer to a question whose paper printed no key, with a short worked explanation.
 * The values follow the same format the recognizer writes, so the quiz marks them as usual; the
 * caller labels them as the AI's, for the person to check.
 */
export class AiSolver {
  constructor(private readonly model: TextModel) {}

  async solve(req: SolveRequest): Promise<Solved> {
    const images = await Promise.all(req.images.map((b) => sharp(b).png().toBuffer()))
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await this.model.complete(system(LANGUAGE_NAMES[req.language] ?? req.language), prompt(req), images)
        const start = text.indexOf('{')
        const reply = Reply.parse(JSON.parse(text.slice(start, text.lastIndexOf('}') + 1)))
        const values = reply.values.map((v) => v.trim()).filter(Boolean)
        if (!values.length) throw new Error('the reply gave no answer')
        return { values: normalise(req.question, values), explanation: reply.explanation.trim() }
      } catch (err) {
        lastError = err
      }
    }
    throw lastError
  }
}

function system(language: string): string {
  return [
    'You are an experienced teacher writing the answer key for one exam question.',
    'Work the question out carefully, then reply with one JSON object only: {"values": [...], "explanation": "..."}.',
    'Format of "values":',
    '- single_choice / multiple_choice: the option labels only, without brackets, e.g. ["C"] or ["A", "C", "E"].',
    '- true_false: ["true"] or ["false"].',
    '- fill_in_blank: one entry per blank, in order; when the blanks are filled with labels from a printed list, one label per blank.',
    '- matching: one option label per numbered item, in the items\' order, e.g. ["C", "A", "B"].',
    '- short_answer, essay, calculation, other: the full model answer as one entry; calculation ends with the final result.',
    '- drawing: one entry saying in words what a correct drawing shows.',
    `"explanation": a short worked explanation a student can follow, in ${language}. Use Markdown and LaTeX ($...$) for formulas.`,
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
