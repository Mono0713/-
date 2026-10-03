import { canTeach, type Assignment, type Classroom, type ClassRole, type Member } from '@exam/classes'
import type { DraftFigure } from '@exam/core'
import type { QuizAttempt, QuizSettings, QuizSource } from '@exam/quiz'
import { monthStart, spend } from '@exam/usage'
import { authEnabled, currentOwner, currentUser, localPerson } from './auth'
import { keyPrefixOf, providersOf, services, teacherFor, type Teacher } from './context'

export interface InClass {
  classroom: Classroom
  me: Member
  /** Teacher or assistant: sees everyone's work and changes assignments. */
  teaches: boolean
}

/** The class and the signed-in person's place in it, or null when they are not in it. */
export async function inClass(classId: string): Promise<InClass | null> {
  const { classes } = services()
  const [owner, classroom] = await Promise.all([currentOwner(), classes.get(classId)])
  if (!classroom) return null
  const me = await classes.member(classroom.id, owner)
  return me ? { classroom, me, teaches: canTeach(me.role) } : null
}

/** For actions: the class when the person teaches it, else an error. */
export async function requireTeaching(classId: string): Promise<InClass> {
  const found = await inClass(classId)
  if (!found?.teaches) throw new Error('找不到這個班級')
  return found
}

/** An assignment with the person's place in its class, or null. */
export async function inAssignment(assignmentId: string): Promise<(InClass & { assignment: Assignment }) | null> {
  const assignment = await services().classes.assignment(assignmentId)
  if (!assignment) return null
  const found = await inClass(assignment.classId)
  return found && { ...found, assignment }
}

/** The name classmates see: the account's name, else the part of the e-mail before the @. */
export async function displayName(): Promise<string> {
  if (!authEnabled()) return (await localPerson()).name
  const user = await currentUser()
  return user?.name ?? user?.email?.split('@')[0] ?? '我'
}

export const ROLE_LABELS: Record<ClassRole, string> = { teacher: '老師', assistant: '助教', student: '學生' }

/**
 * Copies the figure images of the questions into the class's own folder, so the
 * assignment keeps working after the exam is edited or deleted.
 */
export async function freezeFigures(sources: QuizSource[], teacherId: string, assignmentKey: string): Promise<QuizSource[]> {
  const { files } = services()
  const folder = `${keyPrefixOf(teacherId)}classes/${assignmentKey}`
  const done = new Map<string, string>()
  let n = 0
  const copy = async (f: DraftFigure): Promise<DraftFigure> => {
    if (!f.image) return f
    let file = done.get(f.image.file)
    if (!file) {
      const data = await files.read(f.image.file)
      if (!data) return { ...f, image: null }
      file = `${folder}/figure-${++n}.png`
      await files.write(file, data)
      done.set(f.image.file, file)
    }
    return { ...f, image: { ...f.image, file } }
  }
  const out: QuizSource[] = []
  for (const s of sources) {
    out.push({
      ...s,
      // The class has no pages to point at.
      question: { ...s.question, figures: await Promise.all(s.question.figures.map(copy)), locations: [] },
      group: s.group && { ...s.group, figures: await Promise.all(s.group.figures.map(copy)) },
    })
  }
  return out
}

const CLASS_FILE = /^u\/([^/]+)\/classes\/([^/]+)\//

/** Whether a file in a class folder may be served to this person: they are in the class of its assignment. */
export async function classFile(key: string, userId: string): Promise<boolean> {
  const m = CLASS_FILE.exec(key)
  if (!m) return false
  const { classes } = services()
  const assignment = await classes.assignment(m[2]!)
  const classroom = assignment && (await classes.get(assignment.classId))
  if (!classroom || classroom.ownerId !== m[1]) return false
  return (await classes.member(classroom.id, userId)) !== null
}

/** What the class's AI marking has cost its teacher this month, in US dollars. */
export async function classSpend(classroom: Classroom): Promise<{ usd: number; unpriced: boolean }> {
  const { usage, settings } = services()
  const [rows, s] = await Promise.all([usage.summary(classroom.ownerId, monthStart(), `class:${classroom.id}`), settings.get(classroom.ownerId)])
  return spend(rows, providersOf(s))
}

/**
 * Who marks an attempt's open answers with AI, and on whose keys. A class assignment
 * follows the class's choice: the teacher pays (up to the monthly cap), each student pays
 * with their own keys, or the teacher pays up to the cap and then the student does.
 */
export async function graderFor(attempt: Pick<QuizAttempt, 'ownerId' | 'assignment'>): Promise<Teacher | null> {
  const a = attempt.assignment
  if (!a || a.preview) return teacherFor(attempt.ownerId)
  const classroom = await services().classes.get(a.classId)
  if (!classroom) return teacherFor(attempt.ownerId)
  if (classroom.aiPayer === 'off') return null
  if (classroom.aiPayer === 'student') return teacherFor(attempt.ownerId)
  const cap = classroom.aiMonthlyCapUsd
  const underCap = cap === null || (await classSpend(classroom)).usd < cap
  if (underCap) {
    const teacher = await teacherFor(classroom.ownerId, { scope: `class:${classroom.id}`, always: true })
    if (teacher || classroom.aiPayer === 'teacher') return teacher
  }
  return classroom.aiPayer === 'mixed' ? teacherFor(attempt.ownerId) : null
}

/** Whether the person may mark their own open answers: not on a class assignment, where the teacher or AI does. */
export const selfMarks = (attempt: Pick<QuizAttempt, 'assignment'>): boolean => !attempt.assignment || Boolean(attempt.assignment.preview)

/** A student's attempt the signed-in person may look at as its teacher, with the assignment; null otherwise. */
export async function taughtAttempt(attemptId: string): Promise<{ attempt: QuizAttempt; assignment: Assignment; in: InClass } | null> {
  const attempt = await services().quizzes.get(attemptId)
  if (!attempt?.assignment) return null
  const found = await inAssignment(attempt.assignment.assignmentId)
  if (!found?.teaches) return null
  return { attempt, assignment: found.assignment, in: found }
}

/**
 * When the answer key of an attempt may show, from its assignment as it is now (the
 * teacher can change it after students started): never, after the assignment closes,
 * or once handed in. Attempts outside a class keep their own settings.
 */
export async function keyRule(attempt: Pick<QuizAttempt, 'settings' | 'assignment'>): Promise<Pick<QuizSettings, 'keyHidden' | 'keyUntil'>> {
  const a = attempt.assignment
  if (!a || a.preview) return attempt.settings
  const assignment = await services().classes.assignment(a.assignmentId)
  if (!assignment) return attempt.settings
  const { answers } = assignment.settings
  if (answers === 'never') return { keyHidden: true }
  if (answers === 'after_close') return assignment.closesAt ? { keyUntil: assignment.closesAt } : { keyHidden: true }
  return {}
}
