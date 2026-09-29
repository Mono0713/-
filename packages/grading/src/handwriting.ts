import { inkToSvg, isEmptyInk, type InkDoc } from '@exam/ink'
import { answerKind, type QuizAttempt, type QuizItem, type QuizResponse } from '@exam/quiz'
import sharp from 'sharp'
import { z } from 'zod'
import type { TextModel } from './model.ts'

/** The ink as a PNG on white, cropped to what was written, for a model to read. */
export async function inkToPng(doc: InkDoc, width = 1200): Promise<Buffer> {
  const png = await sharp(Buffer.from(inkToSvg(doc, width))).flatten({ background: '#ffffff' }).png().toBuffer()
  // trim() cuts the empty margin; keep a little border so edge strokes stay readable.
  return sharp(png).trim({ background: '#ffffff', threshold: 10 }).extend({ top: 24, bottom: 24, left: 24, right: 24, background: '#ffffff' }).png().toBuffer()
}

const Reply = z.object({ values: z.array(z.string()) })

/**
 * Reads a handwritten answer into text: one entry per blank, or one for an open answer.
 * Maths comes back in LaTeX between $…$, so the usual checks (1/2 = 0.5) apply.
 */
export async function readHandwriting(model: TextModel, item: QuizItem, ink: InkDoc): Promise<string[]> {
  const kind = answerKind(item.question)
  const count = kind.kind === 'blanks' ? kind.count : 1
  const system = `You transcribe a student's handwritten exam answer exactly as written, without correcting it.
- Write mathematics in LaTeX between $...$ (for example $\\frac{1}{2}$, $x^{2}$), chemistry with \\ce{...}.
- Keep the student's language, words and mistakes. Crossed-out writing is left out.
- ${count > 1 ? `The answer has ${count} blanks, usually written in order and often numbered (1), (2)…; return one string per blank, "" for a blank left empty.` : 'Return the whole answer as one string, keeping line breaks.'}
Reply with JSON only: {"values": [${count > 1 ? '"…", "…"' : '"…"'}]}. Escape backslashes as JSON requires ("$\\\\frac{1}{2}$").`
  const prompt = `The question, for context only (do not answer it):\n${item.question.stem}`
  const image = await inkToPng(ink)
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await model.complete(system, prompt, [image])
      const { values } = Reply.parse(JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)))
      return Array.from({ length: count }, (_, i) => repairLatex(count === 1 ? values.join('\n') : (values[i] ?? '')).trim())
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

/**
 * Undoes LaTeX a model forgot to escape in JSON: "\frac" parses as a form feed and "rac",
 * "\theta" as a tab and "heta". Newlines only count as "\n…" commands inside $…$.
 */
export function repairLatex(text: string): string {
  return text
    .replace(/\f/g, '\\f')
    .replace(/\x08/g, '\\b')
    .replace(/[\t\r\v](?=[a-zA-Z])/g, (c) => ({ '\t': '\\t', '\r': '\\r', '\v': '\\v' })[c]!)
    .replace(/\$[^$]*\$/g, (math) => math.replace(/\n(?=[a-zA-Z])/g, '\\n'))
}

/** A handwritten answer that has not been read into text yet (typing always wins over ink). */
export function unreadHandwriting(response: QuizResponse | null | undefined): boolean {
  return !!response && !isEmptyInk(response.handwriting) && !response.values.some((v) => v.trim())
}

/**
 * Reads every handwritten answer nobody has read yet, in place of typing, so it can be marked.
 * Returns the responses with `values` filled in and `transcribed` set. `only` limits it to some questions.
 * Answers that fail to be read stay unread; it throws only when every read failed.
 */
export async function readHandwrittenAnswers(attempt: Pick<QuizAttempt, 'items' | 'responses'>, model: TextModel, only?: number[]): Promise<QuizAttempt['responses']> {
  const responses = [...attempt.responses]
  const results = await Promise.allSettled(
    attempt.items.map(async (item, i) => {
      const r = responses[i]
      if (!r || (only && !only.includes(i)) || !unreadHandwriting(r)) return false
      responses[i] = { ...r, values: await readHandwriting(model, item, r.handwriting!), transcribed: true }
      return true
    }),
  )
  // One unreadable page stays unread (the person can mark it); only a total failure is an error.
  const failed = results.find((r) => r.status === 'rejected')
  if (failed && !results.some((r) => r.status === 'fulfilled' && r.value)) throw failed.reason
  return responses
}
