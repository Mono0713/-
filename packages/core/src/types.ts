import type { ExamMeta, ExtractedPage, ExtractedQuestion, QuestionGroup } from './schema.ts'

/** One rendered page image handed from ingest to extraction. */
export interface PageImage {
  /** 1-based page number within the source file. */
  pageNumber: number
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  data: Buffer
  width: number
  height: number
  /** Text layer of the PDF page, when the PDF has one. Helps the model with spelling. */
  textLayer: string | null
}

/** A source document after ingest: every page rendered to an image. */
export interface IngestedDocument {
  fileName: string
  kind: 'pdf' | 'image'
  pages: PageImage[]
}

/** A question after pages are merged, ready for human review. */
export interface DraftQuestion extends Omit<ExtractedQuestion, 'continuesFromPreviousPage' | 'continuesOnNextPage' | 'bbox'> {
  /** Where the question sits on the source pages, one entry per page it spans. */
  locations: { pageNumber: number; bbox: ExtractedQuestion['bbox'] }[]
}

export interface DraftExam {
  fileName: string
  meta: ExamMeta
  groups: (QuestionGroup & { pageNumber: number })[]
  questions: DraftQuestion[]
  pages: { pageNumber: number; provider: string; model: string; notes: string | null }[]
}

export type { ExtractedPage }
