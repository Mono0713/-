import { z } from 'zod'

/**
 * Formats the extractor returns for one scanned page.
 *
 * Every field is required and optional values are `null` rather than missing, so
 * the same schema works with every provider's strict structured-output mode
 * (OpenAI strict mode rejects optional properties).
 *
 * Text fields are Markdown. Math uses LaTeX between `$...$` / `$$...$$`,
 * chemistry uses mhchem (`$\ce{H2O}$`), and tables use Markdown tables (or HTML
 * when cells are merged).
 */

export const QuestionType = z.enum([
  'single_choice',
  'multiple_choice',
  'true_false',
  'fill_in_blank',
  'short_answer',
  'essay',
  /** A composition (作文): free writing on a topic, judged as a whole rather than against key points. */
  'composition',
  'calculation',
  'matching',
  /** Character or letter writing practice (生字練習): the answer holds the characters to write. */
  'writing',
  /** A drawing question (作圖題): marks drawn on the question's figure (a number line, axes, a diagram); the answer says what a right drawing shows. */
  'drawing',
  'other',
])
export type QuestionType = z.infer<typeof QuestionType>

export const AnswerSource = z.enum([
  /** Printed on the page, for example an answer key sheet. */
  'printed',
  /** Handwritten on the page. Could be a teacher's key or a student's answer. */
  'handwritten',
  /** No answer visible. */
  'none',
])
export type AnswerSource = z.infer<typeof AnswerSource>

export const Confidence = z.enum(['high', 'medium', 'low'])
export type Confidence = z.infer<typeof Confidence>

/** Rectangle in page coordinates normalised to 0..1, origin top-left. */
export const BoundingBox = z.object({
  x: z.number().describe('Left edge, 0..1 of page width'),
  y: z.number().describe('Top edge, 0..1 of page height'),
  width: z.number().describe('0..1 of page width'),
  height: z.number().describe('0..1 of page height'),
})
export type BoundingBox = z.infer<typeof BoundingBox>

/** Pen of the handwriting in a figure blank; decides how the blank is cleaned. */
export const BlankInk = z.enum(['none', 'colour', 'dark'])
export type BlankInk = z.infer<typeof BlankInk>

export const FigureBlank = z.object({
  label: z.string().describe('Number or label of the blank as printed on the figure, e.g. "7"'),
  bbox: BoundingBox.describe('The box or line the student writes in, including any handwriting in it'),
  ink: BlankInk.nullable()
    .default(null)
    .describe('Handwriting in the blank: "colour" for red, blue or other coloured pen, "dark" for pencil or black pen, "none" when empty'),
  printedText: z
    .string()
    .nullable()
    .default(null)
    .describe('Text printed inside the box (not handwriting), with ___ where the student writes and \\n between printed lines, e.g. "7. ___ host" or "Organ\\n5. ___"'),
})
export type FigureBlank = z.infer<typeof FigureBlank>

export const Figure = z.object({
  description: z.string().describe('What the figure shows, in the language of the exam'),
  bbox: BoundingBox,
  blanks: z.array(FigureBlank).describe('Blanks drawn on the figure for the student to fill in; empty for most figures'),
  option: z
    .string()
    .nullable()
    .default(null)
    .describe('Label of the option this figure is, when an option is a picture (graph, structure, diagram, photo); null for figures in the question itself'),
})
/** `option` is missing on figures saved before picture options existed. */
export type Figure = Omit<z.infer<typeof Figure>, 'option'> & { option?: string | null }

export const Option = z.object({
  label: z.string().describe('Label as printed, without brackets or punctuation, e.g. "A", "1", "甲"'),
  content: z.string().describe('Option text in Markdown/LaTeX, without the label'),
})
export type Option = z.infer<typeof Option>

export const Answer = z.object({
  values: z
    .array(z.string())
    .describe(
      'Option labels for choice questions (without brackets), "true"/"false" for true/false, one entry per blank for fill-in, or the full text for open questions',
    ),
  source: AnswerSource,
})
export type Answer = z.infer<typeof Answer>

export const ExtractedQuestion = z.object({
  number: z.string().describe('Question number as printed, e.g. "1", "3(2)", "Ch12-1"'),
  section: z
    .string()
    .nullable()
    .describe('Heading of the section the question sits under, e.g. "選擇題（每題 5 分）"'),
  groupId: z
    .string()
    .nullable()
    .describe('Id of a shared passage/figure in `groups` this question belongs to'),
  type: QuestionType,
  stem: z.string().describe('Question text in Markdown with LaTeX math, excluding options'),
  translation: z
    .string()
    .nullable()
    .describe('A translation of the stem printed or typed on the page (e.g. Chinese under an English question), kept out of the stem'),
  options: z.array(Option),
  answer: Answer,
  explanation: z.string().nullable().describe('Printed or typed worked solution, if any'),
  points: z.number().nullable(),
  maxLength: z
    .number()
    .nullable()
    .default(null)
    .describe('Most characters (words, for languages written with spaces) the answer may have when the paper sets a limit, e.g. 20 for "作答字數 20 字以內"; else null'),
  markingRule: z
    .string()
    .nullable()
    .default(null)
    .describe('How this answer is marked when the paper says more than its points, e.g. "一個錯字扣一分" or "列式 2 分，答案 1 分", from the question or its section; else null'),
  figures: z.array(Figure),
  bbox: BoundingBox.describe('Area of the whole question on the page'),
  continuesFromPreviousPage: z.boolean(),
  continuesOnNextPage: z.boolean(),
  confidence: Confidence,
  issues: z
    .array(z.string())
    .describe('Anything a reviewer should check: unreadable text, guessed symbols, cut-off parts'),
})
/** `maxLength` and `markingRule` are missing on questions saved before they existed. */
export type ExtractedQuestion = Omit<z.infer<typeof ExtractedQuestion>, 'maxLength' | 'markingRule'> & { maxLength?: number | null; markingRule?: string | null }

export const QuestionGroup = z.object({
  id: z.string(),
  stem: z.string().describe('Shared passage, data or instructions in Markdown'),
  figures: z.array(Figure),
})
export type QuestionGroup = z.infer<typeof QuestionGroup>

export const ExamMeta = z.object({
  title: z.string().nullable(),
  subject: z.string().nullable(),
  institution: z.string().nullable(),
  term: z.string().nullable().describe('School year / semester as printed'),
  language: z.string().nullable().describe('Main language, BCP 47, e.g. "zh-Hant", "en"'),
})
export type ExamMeta = z.infer<typeof ExamMeta>

export const ExtractedPage = z.object({
  meta: ExamMeta,
  groups: z.array(QuestionGroup),
  questions: z.array(ExtractedQuestion),
  notes: z
    .string()
    .nullable()
    .describe('Page-level remarks, e.g. "photo shows two exam pages side by side"'),
})
export type ExtractedPage = Omit<z.infer<typeof ExtractedPage>, 'questions'> & { questions: ExtractedQuestion[] }
