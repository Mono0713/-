'use server'

import { randomUUID } from 'node:crypto'
import { isOpen, type AiPayer, type AssignmentAnswers, type AssignmentSettings, type ClassRole } from '@exam/classes'
import type { Marking } from '@exam/quiz'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sourcesOf, startFromSources } from '@/features/quiz/start'
import { displayName, freezeFigures, inAssignment, inClass, requireTeaching, taughtAttempt } from '@/server/classes'
import { currentOwner, services } from '@/server/context'
import { ownedExam } from '@/server/owned'

const PAYERS: AiPayer[] = ['teacher', 'student', 'mixed', 'off']
const ANSWERS: AssignmentAnswers[] = ['after_submit', 'after_close', 'never']
const ROLES: ClassRole[] = ['assistant', 'student']

const clean = (text: string, max = 80) => text.trim().replace(/\s+/g, ' ').slice(0, max)

/** Makes a class with the person as its teacher and opens it. */
export async function createClass(name: string): Promise<{ error: string } | undefined> {
  const title = clean(name)
  if (!title) return { error: '請幫班級取個名字' }
  const classroom = await services().classes.create(await currentOwner(), await displayName(), title)
  revalidatePath('/classes')
  redirect(`/classes/${classroom.id}`)
}

/** Joins the class with this code as a student and opens it. */
export async function joinClass(code: string): Promise<{ error: string } | undefined> {
  const { classes } = services()
  const classroom = await classes.byCode(code)
  if (!classroom) return { error: '找不到這個加入碼，請再確認一次。' }
  const owner = await currentOwner()
  if (!classroom.joinOpen && !(await classes.member(classroom.id, owner))) return { error: '這個班級現在不開放加入，請問老師。' }
  await classes.join(classroom.id, owner, await displayName())
  revalidatePath('/classes')
  redirect(`/classes/${classroom.id}`)
}

/** The class's own teacher: the only one who changes who pays, roles, or deletes it. */
async function requireOwner(classId: string) {
  const found = await requireTeaching(classId)
  if (found.me.role !== 'teacher') throw new Error('只有老師能改這個設定')
  return found
}

export async function renameClass(classId: string, name: string): Promise<void> {
  const { classroom } = await requireTeaching(classId)
  const title = clean(name)
  if (title) await services().classes.update(classroom.id, { name: title })
  revalidatePath(`/classes/${classroom.id}`)
}

export async function setJoinOpen(classId: string, open: boolean): Promise<void> {
  const { classroom } = await requireTeaching(classId)
  await services().classes.update(classroom.id, { joinOpen: open })
  revalidatePath(`/classes/${classroom.id}`)
}

/** A new join code: the old one, and links made with it, stop working. */
export async function renewJoinCode(classId: string): Promise<{ code: string }> {
  const { classroom } = await requireTeaching(classId)
  const code = await services().classes.newCode(classroom.id)
  revalidatePath(`/classes/${classroom.id}`)
  return { code }
}

/** Who pays for the class's AI marking, and the most the teacher spends in a month (null: no cap). */
export async function setAiPayer(classId: string, payer: AiPayer, capUsd: number | null): Promise<void> {
  const { classroom } = await requireOwner(classId)
  if (!PAYERS.includes(payer)) throw new Error('不明的付費方式')
  const cap = capUsd === null || !Number.isFinite(capUsd) || capUsd < 0 ? null : Math.round(capUsd * 100) / 100
  await services().classes.update(classroom.id, { aiPayer: payer, aiMonthlyCapUsd: cap })
  revalidatePath(`/classes/${classroom.id}`)
}

export async function deleteClass(classId: string): Promise<void> {
  const { classroom } = await requireOwner(classId)
  await services().classes.delete(classroom.id)
  revalidatePath('/classes')
}

/** A student leaves; their handed-in work stays with the teacher until the class is deleted. */
export async function leaveClass(classId: string): Promise<void> {
  const found = await inClass(classId)
  if (!found || found.me.role === 'teacher') return
  await services().classes.leave(found.classroom.id, found.me.userId)
  revalidatePath('/classes')
}

export async function removeMember(classId: string, userId: string): Promise<void> {
  const { classroom, me } = await requireTeaching(classId)
  const them = await services().classes.member(classroom.id, userId)
  // The teacher stays; assistants are removed by the teacher only.
  if (!them || them.role === 'teacher' || (them.role === 'assistant' && me.role !== 'teacher')) return
  await services().classes.leave(classroom.id, userId)
  revalidatePath(`/classes/${classroom.id}`)
}

export async function setMemberRole(classId: string, userId: string, role: ClassRole): Promise<void> {
  const { classroom } = await requireOwner(classId)
  if (!ROLES.includes(role)) return
  const them = await services().classes.member(classroom.id, userId)
  if (!them || them.role === 'teacher') return
  await services().classes.setRole(classroom.id, userId, role)
  revalidatePath(`/classes/${classroom.id}`)
}

export interface NewAssignmentInput {
  examId: string
  title: string
  settings: AssignmentSettings
  opensAt: string | null
  closesAt: string | null
}

const when = (v: string | null): string | null => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const count = (n: number | null): number | null => (n && Number.isFinite(n) && n >= 1 ? Math.min(999, Math.round(n)) : null)

/**
 * Gives one of the teacher's exams to the class. Its questions and figures are copied
 * now, so editing or deleting the exam later does not change what students get.
 */
export async function createAssignment(classId: string, input: NewAssignmentInput): Promise<{ error: string } | undefined> {
  const { classroom, me } = await requireTeaching(classId)
  const exam = await ownedExam(input.examId)
  if (!exam) return { error: '請選一份自己題庫裡的考卷' }
  const { items } = await services().bank.listQuestions({ ownerId: exam.ownerId, examId: exam.id, limit: 1000 })
  if (!items.length) return { error: '這份考卷還沒有題目' }
  const opensAt = when(input.opensAt)
  const closesAt = when(input.closesAt)
  if (opensAt && closesAt && closesAt <= opensAt) return { error: '截止時間要在開始時間之後' }
  const s = input.settings
  const settings: AssignmentSettings = {
    mode: s.mode === 'practice' ? 'practice' : 'exam',
    shuffleQuestions: Boolean(s.shuffleQuestions),
    shuffleOptions: Boolean(s.shuffleOptions),
    timeLimitMinutes: s.mode === 'exam' ? count(s.timeLimitMinutes) : null,
    maxAttempts: count(s.maxAttempts),
    // Practice shows each answer once it is written, so its answers cannot wait.
    answers: s.mode !== 'practice' && ANSWERS.includes(s.answers) ? s.answers : 'after_submit',
  }
  const id = randomUUID()
  const { sources } = await sourcesOf(items)
  const frozen = await freezeFigures(sources, me.userId, id)
  await services().classes.assign({ id, classId: classroom.id, examId: exam.id, title: clean(input.title) || exam.title || '未命名作業', settings, sources: frozen, opensAt, closesAt })
  revalidatePath(`/classes/${classroom.id}`)
  redirect(`/classes/${classroom.id}/a/${id}`)
}

/** Changes when an assignment opens or closes, and when its answers show. Applies to attempts already made, too. */
export async function updateAssignment(assignmentId: string, patch: { opensAt?: string | null; closesAt?: string | null; answers?: AssignmentAnswers; title?: string }): Promise<void> {
  const found = await inAssignment(assignmentId)
  if (!found?.teaches) throw new Error('找不到這份作業')
  await services().classes.updateAssignment(found.assignment.id, {
    ...(patch.opensAt !== undefined && { opensAt: when(patch.opensAt) }),
    ...(patch.closesAt !== undefined && { closesAt: when(patch.closesAt) }),
    ...(patch.answers && ANSWERS.includes(patch.answers) && found.assignment.settings.mode !== 'practice' && { answers: patch.answers }),
    ...(patch.title && { title: clean(patch.title) }),
  })
  revalidatePath(`/classes/${found.classroom.id}/a/${found.assignment.id}`)
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  const found = await inAssignment(assignmentId)
  if (!found?.teaches) return
  await services().classes.deleteAssignment(found.assignment.id)
  revalidatePath(`/classes/${found.classroom.id}`)
}

/**
 * Starts the assignment for the person. Students may start while it is open and they
 * have tries left; a teacher's own start is a preview that is not counted.
 */
export async function startAssignment(assignmentId: string): Promise<{ error: string } | undefined> {
  const found = await inAssignment(assignmentId)
  if (!found) return { error: '找不到這份作業' }
  const { assignment, me, teaches } = found
  const { classes } = services()
  if (!teaches) {
    if (!isOpen(assignment)) return { error: assignment.opensAt && new Date() < new Date(assignment.opensAt) ? '作業還沒開始' : '作業已經截止了' }
    const tries = (await classes.attempts(assignment.id, me.userId)).filter((a) => !a.preview).length
    if (assignment.settings.maxAttempts !== null && tries >= assignment.settings.maxAttempts) return { error: '已經用完可以作答的次數' }
  }
  const { mode, shuffleQuestions, shuffleOptions, timeLimitMinutes } = assignment.settings
  const attempt = await startFromSources({
    ownerId: me.userId,
    title: assignment.title,
    examIds: [],
    sources: assignment.sources,
    settings: { mode, shuffleQuestions, shuffleOptions, timeLimitMinutes },
    assignment: { classId: assignment.classId, assignmentId: assignment.id, ...(teaches && { preview: true }) },
    endsBy: teaches ? null : assignment.closesAt,
  })
  await classes.recordAttempt({ attemptId: attempt.id, assignmentId: assignment.id, userId: me.userId, preview: teaches })
  revalidatePath(`/classes/${assignment.classId}/a/${assignment.id}`)
  redirect(`/quiz/${attempt.id}`)
}

/**
 * The teacher marks an open answer of a student's handed-in attempt: credit from 0 to 1
 * (null takes the teacher's mark off) and a comment. Changing an AI mark is remembered.
 */
export async function teacherMark(attemptId: string, index: number, credit: number | null, feedback: string): Promise<void> {
  const found = await taughtAttempt(attemptId)
  if (!found?.attempt.finishedAt) throw new Error('交卷後才能批改')
  await services().quizzes.update(attemptId, (a) => {
    if (index < 0 || index >= a.items.length) return null
    const before = a.markings[index] ?? null
    const replaced = before?.by === 'teacher' ? before.replaced : before ? { by: before.by, credit: before.credit } : undefined
    const comment = feedback.trim().slice(0, 2000) || null
    const next: Marking | null =
      credit === null ? (before?.by === 'teacher' ? null : before) : { credit: Math.min(1, Math.max(0, credit)), by: 'teacher', feedback: comment, ...(replaced && { replaced }) }
    const markings = [...a.markings]
    markings[index] = next
    return { ...a, markings }
  })
  revalidatePath(`/classes/${found.assignment.classId}/a/${found.assignment.id}`)
  revalidatePath(`/classes/${found.assignment.classId}/a/${found.assignment.id}/r/${attemptId}`)
}
