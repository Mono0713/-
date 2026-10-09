import type { DraftExam, DraftFigure, DraftQuestion, QuestionType } from '@exam/core'
import sharp from 'sharp'
import { z } from 'zod'
import type { TextModel } from './model.ts'
import { LANGUAGE_NAMES } from './teacher.ts'

export type Difficulty = 'easy' | 'medium' | 'hard'

/** What to write: how many questions of each type, how hard, and anything else the person asked for. */
export interface ExamPlan {
  types: { type: QuestionType; count: number }[]
  difficulty: Difficulty
  /** Some questions may share a passage, table or figure (題組). */
  groups: boolean
  /** Questions may show figures, tables or photos taken from the material's pages. */
  figures: boolean
  /** The person's own words, e.g. "only chapter 3" or "more on reaction rates". */
  notes: string | null
  title: string | null
}

export interface WriteRequest {
  /** Pages of the material: their text when known, their image when the model should see it (any image format). */
  pages: { pageNumber: number; text: string | null; image: Buffer | null }[]
  /** Material given as plain text. */
  text: string | null
  plan: ExamPlan
  /** Language of the person, used when the material does not settle which language to write in. */
  language: string
}

const Box = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
const FigureRef = z.object({ page: z.number(), bbox: Box, description: z.string().nullish() }).nullish()
const Reply = z.object({
  title: z.string().nullish(),
  subject: z.string().nullish(),
  language: z.string().nullish(),
  groups: z.array(z.object({ id: z.string(), stem: z.string(), figure: FigureRef })).nullish(),
  questions: z.array(
    z.object({
      type: z.string(),
      groupId: z.string().nullish(),
      stem: z.string(),
      options: z.array(z.object({ label: z.string(), content: z.string() })).nullish(),
      answer: z.array(z.union([z.string(), z.number(), z.boolean()])).nullish(),
      explanation: z.string().nullish(),
      figure: FigureRef,
    }),
  ),
})
type Reply = z.infer<typeof Reply>

const KNOWN_TYPES = new Set<string>(['single_choice', 'multiple_choice', 'true_false', 'fill_in_blank', 'short_answer', 'essay', 'composition', 'calculation', 'matching', 'writing', 'drawing', 'other'])

/**
 * Writes a new exam from study material (講義、筆記、課本頁面): the asked number of questions of each
 * type, each with its answer and a short explanation, as a draft the editor opens like any other.
 * Figures point at a material page and a box on it; the caller crops them. Answers are marked as the
 * AI's, for the person to check.
 */
export class AiExamWriter {
  constructor(private readonly model: TextModel) {}

  async write(req: WriteRequest): Promise<DraftExam> {
    const images = await Promise.all(req.pages.filter((p) => p.image).map((p) => sharp(p.image!).png().toBuffer()))
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const reply = await this.model.complete(system(req), prompt(req), images)
        const parsed = Reply.parse(JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1)))
        if (!parsed.questions.length) throw new Error('the reply held no questions')
        return toDraft(parsed, req)
      } catch (err) {
        lastError = err
      }
    }
    throw lastError
  }
}

const DIFFICULTY: Record<Difficulty, string> = {
  easy: 'easy: checks that the student remembers and understands the main points',
  medium: 'medium: a mix of recall and applying the ideas, like a normal school test',
  hard: 'hard: mostly applying, combining and reasoning about the ideas, with careful distractors',
}

const TYPE_RULES = [
  '- single_choice: 4 options labelled A to D, exactly one correct; answer ["B"].',
  '- multiple_choice: 5 options labelled A to E, one or more correct; answer lists every correct label, e.g. ["A", "C", "E"].',
  '- true_false: a statement; answer ["true"] or ["false"].',
  '- fill_in_blank: write each blank as ___ where it stands; answer has one entry per blank, in order.',
  '- short_answer: answered in a word, a phrase or a sentence or two; answer is the model answer.',
  '- essay: answered in a paragraph; answer lists the key points a full answer covers.',
  '- composition: a writing topic; answer says what a good piece covers.',
  '- calculation: a worked problem; answer is the full worked solution ending with the result.',
  '- matching: "options" holds the column to pick from (labels A, B, …, at least as many as the items); the stem lists the items one per line, numbered "1. …"; answer gives one option label per item in order.',
].join('\n')

function system(req: WriteRequest): string {
  return [
    'You are an experienced teacher writing a new exam from the study material you are given (lecture notes, handouts, textbook pages).',
    'Every question must be answerable from the material and must test something the material actually teaches; never test page numbers, layout or trivia about the material itself.',
    'Questions must be clear, correct and different from each other, spread over the whole material. Wrong options must be plausible but clearly wrong.',
    `Write in the main language of the material (when unclear, in ${LANGUAGE_NAMES[req.language] ?? req.language}), unless the teacher's notes ask for another language.`,
    'Write text as Markdown and all math as LaTeX inside $...$; chemistry with mhchem, e.g. $\\ce{H2O}$. Tables as Markdown tables.',
    '',
    'Question types and their answers:',
    TYPE_RULES,
    '',
    'Each question has "explanation": one to three sentences saying why the answer is right, in the same language.',
    req.plan.groups
      ? 'Some questions may form a group (題組) sharing a passage, data table or figure: put the shared part in "groups" with an id and set each of its questions\' groupId. A group has 2 to 5 questions; its questions still count toward the numbers asked for.'
      : 'Do not use groups: "groups" is empty and every groupId is null.',
    req.plan.figures
      ? 'When a question or group needs a figure, diagram, chart, table image or photo that appears on a material page you can see, set "figure" to {"page": <page number>, "bbox": {"x","y","width","height"} as fractions 0..1 of that page (origin top-left, tight around the picture and its labels), "description": "<what it shows>"}. Only use pictures you can see on a page; otherwise figure is null. Do not invent figures.'
      : 'Do not use figures: every "figure" is null.',
    '',
    'Reply with one JSON object only, on one line:',
    '{"title": "...", "subject": "...", "language": "<BCP 47, e.g. zh-Hant>", "groups": [{"id": "g1", "stem": "...", "figure": null}], "questions": [{"type": "single_choice", "groupId": null, "stem": "...", "options": [{"label": "A", "content": "..."}], "answer": ["A"], "explanation": "...", "figure": null}]}',
    'Questions that have no options give "options": []. List the questions grouped by type, in the order the types are asked for.',
  ].join('\n')
}

function prompt({ pages, text, plan }: WriteRequest): string {
  const lines: string[] = []
  lines.push(`Write these questions (exactly this many of each type):\n${plan.types.map((t) => `- ${t.type}: ${t.count}`).join('\n')}`)
  lines.push(`Difficulty: ${DIFFICULTY[plan.difficulty]}`)
  if (plan.title?.trim()) lines.push(`Exam title: ${plan.title.trim()}`)
  if (plan.notes?.trim()) lines.push(`The teacher's notes (follow them):\n${plan.notes.trim()}`)
  const seen = pages.filter((p) => p.image).map((p) => p.pageNumber)
  if (seen.length) lines.push(`The images show material pages ${seen.join(', ')}, in that order.`)
  const read = pages.filter((p) => p.text?.trim())
  if (read.length) lines.push(`Text of the material pages:\n${read.map((p) => `--- Page ${p.pageNumber} ---\n${p.text!.trim()}`).join('\n\n')}`)
  if (text?.trim()) lines.push(`Material given as text:\n${text.trim()}`)
  return lines.join('\n\n')
}

/** The model's exam as a draft the editor and the A4 sheet use. Sections are left to the caller. */
export function toDraft(reply: Reply, req: WriteRequest): DraftExam {
  const seen = new Set(req.pages.filter((p) => p.image).map((p) => p.pageNumber))
  const figure = (ref: z.infer<typeof FigureRef>): DraftFigure[] => {
    if (!ref || !req.plan.figures || !seen.has(ref.page)) return []
    const b = ref.bbox
    const x = clamp(b.x), y = clamp(b.y)
    const width = Math.min(clamp(b.width), 1 - x), height = Math.min(clamp(b.height), 1 - y)
    if (width < 0.02 || height < 0.02) return []
    return [{ description: ref.description ?? '', bbox: { x, y, width, height }, blanks: [], option: null, pageNumber: ref.page, image: null }]
  }
  const groupIds = new Set<string>()
  const groups = req.plan.groups
    ? (reply.groups ?? []).filter((g) => g.stem.trim() && !groupIds.has(g.id) && groupIds.add(g.id)).map((g) => ({ id: g.id, stem: g.stem, pageNumber: 0, figures: figure(g.figure) }))
    : []
  const questions = reply.questions
    .filter((q) => KNOWN_TYPES.has(q.type) && q.stem.trim())
    .map((q, i): DraftQuestion => {
      const type = q.type as QuestionType
      const values = (q.answer ?? []).map((v) => String(v).trim()).filter(Boolean)
      return {
        number: String(i + 1),
        section: null,
        groupId: q.groupId && groupIds.has(q.groupId) ? q.groupId : null,
        type,
        stem: q.stem,
        translation: null,
        options: (q.options ?? []).map((o) => ({ label: o.label.replace(/[()（）.\s]/g, ''), content: o.content })),
        answer: { values: type === 'true_false' ? [/^(true|t|o|○|yes|對|是)$/i.test(values[0] ?? '') ? 'true' : 'false'] : values.map((v) => v.replace(/^[(（](\w)[)）]$/, '$1')), source: 'ai' },
        explanation: q.explanation?.trim() || null,
        points: null,
        maxLength: null,
        markingRule: null,
        figures: figure(q.figure),
        locations: [],
        confidence: 'high',
        issues: [],
      }
    })
  // a group none of the questions ended up in prints nothing useful
  const used = new Set(questions.map((q) => q.groupId).filter(Boolean))
  return {
    fileName: reply.title?.trim() || req.plan.title?.trim() || 'exam',
    meta: { title: req.plan.title?.trim() || reply.title?.trim() || null, subject: reply.subject?.trim() || null, institution: null, term: null, language: reply.language?.trim() || null },
    groups: groups.filter((g) => used.has(g.id)),
    questions,
    pages: [],
  }
}

const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))
