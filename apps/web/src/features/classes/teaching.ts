'use server'

import { randomUUID } from 'node:crypto'
import { assignmentStats, type StudentException } from '@exam/classes'
import type { DraftFigure, DraftQuestion } from '@exam/core'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { inAssignment, requireTeaching } from '@/server/classes'
import { keyPrefixOf, services } from '@/server/context'
import { getT } from '@/shared/i18n/server'

/** The assignment when the signed-in person teaches its class, else an error. */
async function taught(assignmentId: string) {
  const found = await inAssignment(assignmentId)
  if (!found?.teaches) {
    const t = await getT()
    throw new Error(t('找不到這份作業'))
  }
  return found
}

const whole = (n: unknown, most: number): number | undefined => (typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.min(most, Math.round(n)) : undefined)

/** Gives one student their own deadline, more tries or more minutes (a make-up or an extension); null takes it away. */
export async function setException(assignmentId: string, userId: string, value: StudentException | null): Promise<void> {
  const { assignment, classroom } = await taught(assignmentId)
  if (!(await services().classes.member(classroom.id, userId))) return
  const closesAt = value?.closesAt && !Number.isNaN(Date.parse(value.closesAt)) ? new Date(value.closesAt).toISOString() : undefined
  const extraAttempts = whole(value?.extraAttempts, 99)
  const extraMinutes = whole(value?.extraMinutes, 600)
  const clean: StudentException = { ...(closesAt && { closesAt }), ...(extraAttempts && { extraAttempts }), ...(extraMinutes && { extraMinutes }) }
  await services().classes.updateAssignment(assignment.id, { exception: { userId, value: Object.keys(clean).length ? clean : null } })
  revalidatePath(`/classes/${classroom.id}/a/${assignment.id}`)
}

/**
 * Puts the questions the class did worst on (under `below` of the points) into a new exam in the
 * teacher's bank, with copies of their figures, and opens 派作業 with it.
 */
export async function createReviewExam(assignmentId: string, below = 0.6): Promise<{ error: string } | undefined> {
  const { assignment, classroom, me } = await taught(assignmentId)
  const t = await getT()
  const { classes, quizzes, bank, files } = services()
  const [members, tries] = await Promise.all([classes.members(classroom.id), classes.attempts(assignment.id)])
  const attempts = (await Promise.all(tries.filter((x) => !x.preview).map((x) => quizzes.get(x.attemptId)))).filter((x) => x !== null)
  const stats = assignmentStats(assignment.sources, members, attempts)
  const weak = new Set(stats.questions.filter((q) => q.rate !== null && q.rate < below).map((q) => q.questionId))
  const picked = assignment.sources.filter((s) => weak.has(s.questionId))
  if (!picked.length) return { error: t('沒有得分率低於 {n}% 的題目', { n: Math.round(below * 100) }) }

  const examId = randomUUID()
  const folder = `${keyPrefixOf(me.userId)}copies/${examId}`
  let n = 0
  const copy = async (f: DraftFigure): Promise<DraftFigure> => {
    if (!f.image) return f
    const data = await files.read(f.image.file)
    if (!data) return { ...f, image: null }
    const file = `${folder}/figure-${++n}.png`
    await files.write(file, data)
    return { ...f, image: { ...f.image, file } }
  }
  // Questions that shared a passage share it again.
  const groups: { id: string; stem: string; figures: DraftFigure[]; pageNumber: number }[] = []
  const groupOf = new Map<string, string>()
  const questions: DraftQuestion[] = []
  for (const s of picked) {
    let groupId: string | null = null
    if (s.group) {
      const key = JSON.stringify(s.group)
      groupId = groupOf.get(key) ?? null
      if (!groupId) {
        groupId = `g${groups.length + 1}`
        groupOf.set(key, groupId)
        groups.push({ id: groupId, stem: s.group.stem, figures: await Promise.all(s.group.figures.map(copy)), pageNumber: 1 })
      }
    }
    questions.push({ ...s.question, groupId, figures: await Promise.all(s.question.figures.map(copy)), locations: [] })
  }
  const exam = await bank.createExam(me.userId, {
    id: examId,
    meta: { title: t('{title} 錯題複習', { title: assignment.title }), subject: null, institution: null, term: null, language: null },
    groups,
    questions,
  })
  revalidatePath('/bank')
  redirect(`/classes/assign?class=${classroom.id}&exam=${exam.id}`)
}

/** Posts a short note to the class page. */
export async function postAnnouncement(classId: string, text: string): Promise<{ error: string } | undefined> {
  const { classroom, me } = await requireTeaching(classId)
  const body = text.trim().slice(0, 2000)
  if (!body) {
    const t = await getT()
    return { error: t('公告不能是空的') }
  }
  await services().classes.announce(classroom.id, me.userId, body)
  revalidatePath(`/classes/${classroom.id}`)
}

export async function deleteAnnouncement(classId: string, id: string): Promise<void> {
  const { classroom } = await requireTeaching(classId)
  const { classes } = services()
  if ((await classes.announcements(classroom.id)).some((a) => a.id === id)) await classes.deleteAnnouncement(id)
  revalidatePath(`/classes/${classroom.id}`)
}
