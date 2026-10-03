import type { DraftFigure, DraftQuestion } from '@exam/core'
import type { InkDoc } from '@exam/ink'

/** exam: answer everything, then submit for a score. practice: see the answer after each question. */
export type QuizMode = 'exam' | 'practice'

export interface QuizSettings {
  mode: QuizMode
  shuffleQuestions: boolean
  /** Shuffles the options of choice questions; they are relabelled A, B, C… in the new order. */
  shuffleOptions: boolean
  /** Exam mode only; null means no limit. */
  timeLimitMinutes: number | null
  /** The answer key and explanations are never shown, e.g. a shared exam whose owner keeps them private. */
  keyHidden?: boolean
  /** The answer key stays hidden until this moment, e.g. a class assignment that shows answers once it closes. */
  keyUntil?: string
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
  /** Working written on the scratch pad; never marked. */
  scratch?: InkDoc
  /** A handwritten answer (open and blank questions). An AI reads it into `values` when it is checked. */
  handwriting?: InkDoc
  /** `values` were read from the handwriting by AI, so the person can see what was understood. */
  transcribed?: boolean
}

/** Who marked an open answer: the person against the model answer, the AI teacher, or the class teacher. */
export type MarkedBy = 'self' | 'ai' | 'teacher'

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
  /** The mark this one replaced, when a teacher changed an AI mark: what the class page counts as overridden. */
  replaced?: { by: MarkedBy; credit: number }
}

/** One answer the answer key could not settle. */
export interface GradingTask {
  item: QuizItem
  response: QuizResponse
}

/** Marks answers the key cannot settle, several at once. The AI teacher (@exam/grading) implements it. */
export interface AnswerGrader {
  /** Markings in the order of `tasks`, with feedback in `language`; null for an answer it cannot judge. */
  markAll(tasks: GradingTask[], language: string): Promise<(Marking | null)[]>
}

/** Where the AI teacher is with an attempt's open answers. */
export interface TeacherState {
  status: 'running' | 'done' | 'failed'
  /** The model that marked them, for display. */
  model: string | null
  error: string | null
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
  /** The link token when the questions came from an exam someone shared. */
  share?: string
  /** The class assignment this attempt belongs to; a teacher's own try is a preview. */
  assignment?: { classId: string; assignmentId: string; preview?: boolean }
  /** Set once an AI teacher has been asked to mark this attempt. */
  teacher?: TeacherState
  /** Conversations with the AI tutor, by question position. */
  tutoring?: Record<number, TutorTurn[]>
}

/** One message in a conversation with the AI tutor about a question. */
export interface TutorTurn {
  from: 'student' | 'tutor'
  text: string
  at: string
}
