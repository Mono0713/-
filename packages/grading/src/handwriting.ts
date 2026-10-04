import { inkToSvg, isEmptyInk, paperSvg, practicePaper, type InkDoc } from '@exam/ink'
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
  if (kind.kind === 'writing') return readPractice(model, kind.rows, ink)
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

/** The practice grid with the ink on it, uncropped so the rows stay where they were drawn. */
export async function practiceToPng(rows: string[], ink: InkDoc, width = 1200): Promise<Buffer> {
  const paper = practicePaper(rows)
  return sharp(Buffer.from(inkToSvg(ink, width, '#ffffff', paperSvg(paper, ink.height, width)))).flatten({ background: '#ffffff' }).png().toBuffer()
}

/**
 * Reads a writing-practice grid: for every row, the characters the student wrote, with "?" for
 * one that is malformed or wrong, so the program can tell whether the character was learnt.
 */
async function readPractice(model: TextModel, rows: string[], ink: InkDoc): Promise<string[]> {
  const system = `You check a student's character-writing practice. The image is a grid with ${rows.length} row(s) of square cells. In row n the student practises one character, given below; the printed model and tracing guides are not in the image, only the student's own strokes.
For every row, list the characters the student wrote in that row, left to right, with no spaces. Write "?" for a character that is malformed, missing strokes, has extra strokes or is a different character; be as strict as a primary-school teacher about stroke structure, not about beauty. Return "" for a row left empty.
Reply with JSON only: {"values": ["…", …]} with exactly ${rows.length} entries, one per row in order.`
  const prompt = `Characters practised, one per row:\n${rows.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
  const image = await practiceToPng(rows, ink)
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await model.complete(system, prompt, [image])
      const { values } = Reply.parse(JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)))
      return rows.map((_, i) => (values[i] ?? '').replace(/\s+/g, ''))
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
