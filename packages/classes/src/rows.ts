import { iso } from '@exam/db'
import type { AiPayer, Announcement, Assignment, AssignmentPatch, AssignmentSettings, Classroom, ClassAttempt, ClassRole, Member } from './types.ts'
import type { QuizSource } from '@exam/quiz'

export type Row = Record<string, unknown>

export function withPatch(a: Assignment, patch: AssignmentPatch): Assignment {
  return {
    ...a,
    title: patch.title ?? a.title,
    opensAt: patch.opensAt !== undefined ? patch.opensAt : a.opensAt,
    closesAt: patch.closesAt !== undefined ? patch.closesAt : a.closesAt,
    settings: withException(patch.answers ? { ...a.settings, answers: patch.answers } : a.settings, patch.exception),
  }
}

const at = (v: unknown): string | null => (v === null || v === undefined ? null : iso(v instanceof Date ? v : String(v)))
const json = <T>(v: unknown): T => (typeof v === 'string' ? (JSON.parse(v) as T) : (v as T))

export function toClass(r: Row): Classroom {
  return {
    id: String(r.id),
    ownerId: String(r.owner_id),
    name: String(r.name),
    joinCode: String(r.join_code),
    // sqlite keeps 1/0, Postgres a boolean
    joinOpen: Boolean(Number(r.join_open)),
    aiPayer: String(r.ai_payer) as AiPayer,
    aiMonthlyCapUsd: r.ai_monthly_cap_usd === null || r.ai_monthly_cap_usd === undefined ? null : Number(r.ai_monthly_cap_usd),
    createdAt: at(r.created_at)!,
  }
}

export function toMember(r: Row): Member {
  return { classId: String(r.class_id), userId: String(r.user_id), role: String(r.role) as ClassRole, name: String(r.name), joinedAt: at(r.joined_at)! }
}

export function toAssignment(r: Row): Assignment {
  return {
    id: String(r.id),
    classId: String(r.class_id),
    examId: r.exam_id === null || r.exam_id === undefined ? null : String(r.exam_id),
    title: String(r.title),
    settings: json<AssignmentSettings>(r.settings),
    sources: json<QuizSource[]>(r.sources),
    opensAt: at(r.opens_at),
    closesAt: at(r.closes_at),
    createdAt: at(r.created_at)!,
  }
}

export function toAttempt(r: Row): ClassAttempt {
  return { attemptId: String(r.attempt_id), assignmentId: String(r.assignment_id), userId: String(r.user_id), preview: Boolean(Number(r.preview)), startedAt: at(r.started_at)! }
}


function withException(settings: AssignmentSettings, change: AssignmentPatch['exception']): AssignmentSettings {
  if (!change) return settings
  const exceptions = { ...settings.exceptions }
  if (change.value) exceptions[change.userId] = change.value
  else delete exceptions[change.userId]
  return { ...settings, exceptions }
}

export function toAnnouncement(r: Row): Announcement {
  return { id: String(r.id), classId: String(r.class_id), authorId: String(r.author_id), text: String(r.text), createdAt: at(r.created_at)! }
}
