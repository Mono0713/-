import type { ExamMeta, ExtractedPage, ExtractedQuestion, Figure, FigureBlank, QuestionGroup } from './schema.ts'

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

/** A figure after pages are merged: the page it is on and, once cropped, its own image. */
export interface DraftFigure extends Figure {
  pageNumber: number
  /** Cropped figure with handwriting removed from its blanks; blank boxes are relative to this image. */
  image: { file: string; width: number; height: number; blanks: FigureBlank[] } | null
}

/** A question after pages are merged, ready for human review. */
export interface DraftQuestion extends Omit<ExtractedQuestion, 'continuesFromPreviousPage' | 'continuesOnNextPage' | 'bbox' | 'figures'> {
  figures: DraftFigure[]
  /** Where the question sits on the source pages, one entry per page it spans. */
  /** `manual`: the person drew or moved this box themselves, so it is kept exactly as they left it. */
  locations: { pageNumber: number; bbox: ExtractedQuestion['bbox']; manual?: boolean }[]
}

export interface DraftExam {
  fileName: string
  meta: ExamMeta
  groups: (Omit<QuestionGroup, 'figures'> & { pageNumber: number; figures: DraftFigure[] })[]
  questions: DraftQuestion[]
  pages: { pageNumber: number; provider: string; model: string; notes: string | null }[]
}

export type { ExtractedPage }
