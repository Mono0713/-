import type { DraftFigure, DraftQuestion } from '@exam/core'

/** exam: answer everything, then submit for a score. practice: see the answer after each question. */
export type QuizMode = 'exam' | 'practice'

export interface QuizSettings {
  mode: QuizMode
  shuffleQuestions: boolean
  /** Shuffles the options of choice questions; they are relabelled A, B, C… in the new order. */
  shuffleOptions: boolean
  /** Exam mode only; null means no limit. */
  timeLimitMinutes: number | null
}

/** A question as it appears in one quiz: a snapshot, so later edits in the bank do not change past results. */
export interface QuizItem {
  questionId: string
  question: DraftQuestion
  /** Shared passage and figures of the question's group, if it has one. */
  group: { stem: string; figures: DraftFigure[] } | null
  /** Option labels as stored, in the order shown. */
  optionOrder: string[]
  /** Label shown for each entry of optionOrder. */
  displayLabels: string[]
}

/**
 * What the person answered. Choice questions hold original option labels,
 * true/false holds "true" or "false", blanks hold one entry per blank, and
 * open questions hold the written text as the only entry.
 */
export interface QuizResponse {
  values: string[]
}

/** Who marked an open answer: the person against the model answer, or an AI teacher (planned). */
export type MarkedBy = 'self' | 'ai'

/**
 * A mark on an answer the program cannot check by itself (short answer, essay,
 * calculation). credit is the share of the points earned, from 0 to 1. The person
 * marks right (1) or wrong (0) today; a grader such as an AI teacher can give
 * partial credit and feedback in the same shape.
 */
export interface Marking {
  credit: number
  by: MarkedBy
  /** Comments on the answer, e.g. what is missing. */
  feedback: string | null
}

/** Marks open answers. Planned for an AI teacher; nothing implements it yet. */
export interface AnswerGrader {
  mark(input: { question: DraftQuestion; answer: string; language: string }): Promise<Marking>
}

export type GradeStatus = 'correct' | 'partial' | 'wrong' | 'unanswered' | 'pending' | 'no_key'

export interface Grade {
  status: GradeStatus
  score: number
  /** Points this question is worth; 0 when it has no answer key. */
  max: number
}

export interface QuizAttempt {
  id: string
  ownerId: string
  title: string
  examIds: string[]
  settings: QuizSettings
  items: QuizItem[]
  responses: (QuizResponse | null)[]
  /** Marks on open answers, by position. */
  markings: (Marking | null)[]
  /** Practice mode: questions whose answer has been revealed. */
  checked: boolean[]
  startedAt: string
  /** When a timed exam ends. */
  deadline: string | null
  finishedAt: string | null
}
