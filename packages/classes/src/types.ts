import { randomInt } from 'node:crypto'
import type { QuizMode, QuizSource } from '@exam/quiz'


export type ClassRole = 'teacher' | 'assistant' | 'student'

/** Who pays for AI marking of the class's assignments: the teacher, each student, or the teacher up to the cap and then the student. */
export type AiPayer = 'teacher' | 'student' | 'mixed' | 'off'

export interface Classroom {
  id: string
  /** The teacher who made the class. */
  ownerId: string
  name: string
  /** What students type, or what the join link carries, to join. */
  joinCode: string
  /** Whether new students may join with the code. */
  joinOpen: boolean
  aiPayer: AiPayer
  /** Most the teacher spends on the class's AI marking in a calendar month, in US dollars; null is no cap. */
  aiMonthlyCapUsd: number | null
  createdAt: string
}

export interface Member {
  classId: string
  userId: string
  role: ClassRole
  /** The name the class sees: what the person's account says when they joined. */
  name: string
  joinedAt: string
}

/** When students see the answer key: once they hand in, once the assignment closes, or never. */
export type AssignmentAnswers = 'after_submit' | 'after_close' | 'never'

export interface AssignmentSettings {
  mode: QuizMode
  shuffleQuestions: boolean
  shuffleOptions: boolean
  timeLimitMinutes: number | null
  /** Multiple-choice questions earn part of their points when partly right. */
  multiplePartial?: boolean
  /** How many times each student may start it; null is no limit. */
  maxAttempts: number | null
  answers: AssignmentAnswers
  /** Exam mode: students take it in full screen; leaving it is recorded for the teacher. */
  fullscreen?: boolean
  /** More time or tries for single students (a make-up, an extension), by user id. */
  exceptions?: Record<string, StudentException>
}

/** What one student gets beyond the assignment's own rules. */
export interface StudentException {
  /** Their own deadline, later (or earlier) than the class's. */
  closesAt?: string
  /** Tries on top of the assignment's limit. */
  extraAttempts?: number
  /** Minutes on top of the exam's time limit. */
  extraMinutes?: number
}

/** An exam given to a class, frozen as it was when given. */
export interface Assignment {
  id: string
  classId: string
  /** The exam it was made from, while that still exists. */
  examId: string | null
  title: string
  settings: AssignmentSettings
  /** The questions as they were when assigned. */
  sources: QuizSource[]
  opensAt: string | null
  closesAt: string | null
  createdAt: string
}

/** `id` may be picked ahead, e.g. to name the folder its figures are copied to. */
export type NewAssignment = Omit<Assignment, 'id' | 'createdAt'> & { id?: string }
export type AssignmentPatch = Partial<Pick<Assignment, 'title' | 'opensAt' | 'closesAt'>> & {
  answers?: AssignmentAnswers
  /** Sets (or with null removes) one student's exception. */
  exception?: { userId: string; value: StudentException | null }
}

/** A short note the teacher posts to the class, shown on the class page. */
export interface Announcement {
  id: string
  classId: string
  authorId: string
  text: string
  createdAt: string
}

/** One start of an assignment by a member; a teacher's own try is a preview and does not count. */
export interface ClassAttempt {
  attemptId: string
  assignmentId: string
  userId: string
  preview: boolean
  startedAt: string
}

export type ClassPatch = Partial<Pick<Classroom, 'name' | 'joinOpen' | 'aiPayer' | 'aiMonthlyCapUsd'>>

/** Classes, their members, assignments and the attempts made on them. */
export interface ClassStore {
  /** A new class with its teacher as the first member. */
  create(ownerId: string, ownerName: string, name: string): Promise<Classroom>
  get(id: string): Promise<Classroom | null>
  byCode(code: string): Promise<Classroom | null>
  update(id: string, patch: ClassPatch): Promise<void>
  /** Replaces the join code; the old one stops working. */
  newCode(id: string): Promise<string>
  delete(id: string): Promise<void>
  /** The classes a person is in, with their role, newest first. */
  of(userId: string): Promise<{ classroom: Classroom; role: ClassRole }[]>
  members(classId: string): Promise<Member[]>
  member(classId: string, userId: string): Promise<Member | null>
  /** Adds a student; someone already in the class keeps their role. */
  join(classId: string, userId: string, name: string): Promise<Member>
  setRole(classId: string, userId: string, role: ClassRole): Promise<void>
  leave(classId: string, userId: string): Promise<void>

  assign(input: NewAssignment): Promise<Assignment>
  assignments(classId: string): Promise<Assignment[]>
  assignment(id: string): Promise<Assignment | null>
  updateAssignment(id: string, patch: AssignmentPatch): Promise<void>
  deleteAssignment(id: string): Promise<void>

  /** Notes to the class, newest first. */
  announcements(classId: string): Promise<Announcement[]>
  announce(classId: string, authorId: string, text: string): Promise<Announcement>
  deleteAnnouncement(id: string): Promise<void>

  recordAttempt(a: Omit<ClassAttempt, 'startedAt'>): Promise<void>
  /** Attempts on an assignment, oldest first; only `userId`'s when given. */
  attempts(assignmentId: string, userId?: string): Promise<ClassAttempt[]>
}

// No 0/O, 1/I/L: read aloud and typed from a board without mix-ups.
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const JOIN_CODE = /^[A-HJKMNP-Z2-9]{6}$/

export function newJoinCode(): string {
  return Array.from({ length: 6 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join('')
}

/** A join code as typed: spaces and dashes dropped, upper case. */
export const normalizeCode = (code: string): string => code.replace(/[\s-]/g, '').toUpperCase()

export function isOpen(a: Pick<Assignment, 'opensAt' | 'closesAt'>, now = new Date()): boolean {
  return (!a.opensAt || now >= new Date(a.opensAt)) && (!a.closesAt || now < new Date(a.closesAt))
}

/** Whether a member with this role runs the class: sees everyone's work and changes assignments. */
export const canTeach = (role: ClassRole | null | undefined): boolean => role === 'teacher' || role === 'assistant'
