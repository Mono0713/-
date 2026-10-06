'use server'

import type { StudentException } from '@exam/classes'
import { revalidatePath } from 'next/cache'
import { inAssignment, requireTeaching } from '@/server/classes'
import { services } from '@/server/context'
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
