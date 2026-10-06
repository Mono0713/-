import { randomUUID } from 'node:crypto'
import { isUuid, type Sql } from '@exam/db'
import { toAnnouncement, toAssignment, toAttempt, toClass, toMember, withPatch } from './rows.ts'
import { newJoinCode, normalizeCode, type Announcement, type Assignment, type AssignmentPatch, type ClassAttempt, type Classroom, type ClassPatch, type ClassRole, type ClassStore, type Member, type NewAssignment } from './types.ts'

export class PostgresClassStore implements ClassStore {
  constructor(private readonly sql: Sql) {}

  async create(ownerId: string, ownerName: string, name: string): Promise<Classroom> {
    const id = randomUUID()
    for (;;) {
      const [row] = await this.sql`insert into classes (id, owner_id, name, join_code) values (${id}, ${ownerId}, ${name}, ${newJoinCode()})
        on conflict (join_code) do nothing returning id`
      if (row) break
    }
    await this.sql`insert into class_members (class_id, user_id, role, name) values (${id}, ${ownerId}, 'teacher', ${ownerName})`
    return (await this.get(id))!
  }

  async get(id: string): Promise<Classroom | null> {
    if (!isUuid(id)) return null
    const [row] = await this.sql`select * from classes where id = ${id}`
    return row ? toClass(row) : null
  }

  async byCode(code: string): Promise<Classroom | null> {
    const [row] = await this.sql`select * from classes where join_code = ${normalizeCode(code)}`
    return row ? toClass(row) : null
  }

  async update(id: string, patch: ClassPatch): Promise<void> {
    if (!isUuid(id)) return
    const cols: Record<string, unknown> = {}
    if (patch.name !== undefined) cols.name = patch.name
    if (patch.joinOpen !== undefined) cols.join_open = patch.joinOpen
    if (patch.aiPayer !== undefined) cols.ai_payer = patch.aiPayer
    if (patch.aiMonthlyCapUsd !== undefined) cols.ai_monthly_cap_usd = patch.aiMonthlyCapUsd
    if (!Object.keys(cols).length) return
    await this.sql`update classes set ${this.sql(cols as never)} where id = ${id}`
  }

  async newCode(id: string): Promise<string> {
    for (;;) {
      const code = newJoinCode()
      const [taken] = await this.sql`select 1 from classes where join_code = ${code}`
      if (taken) continue
      await this.sql`update classes set join_code = ${code} where id = ${id}`
      return code
    }
  }

  async delete(id: string): Promise<void> {
    if (isUuid(id)) await this.sql`delete from classes where id = ${id}`
  }

  async of(userId: string): Promise<{ classroom: Classroom; role: ClassRole }[]> {
    const rows = await this.sql`select c.*, m.role as member_role from class_members m join classes c on c.id = m.class_id
      where m.user_id = ${userId} order by c.created_at desc`
    return rows.map((r) => ({ classroom: toClass(r), role: String(r.member_role) as ClassRole }))
  }

  async members(classId: string): Promise<Member[]> {
    if (!isUuid(classId)) return []
    const rows = await this.sql`select * from class_members where class_id = ${classId} order by joined_at, user_id`
    return rows.map(toMember)
  }

  async member(classId: string, userId: string): Promise<Member | null> {
    if (!isUuid(classId)) return null
    const [row] = await this.sql`select * from class_members where class_id = ${classId} and user_id = ${userId}`
    return row ? toMember(row) : null
  }

  async join(classId: string, userId: string, name: string): Promise<Member> {
    await this.sql`insert into class_members (class_id, user_id, role, name) values (${classId}, ${userId}, 'student', ${name})
      on conflict (class_id, user_id) do nothing`
    return (await this.member(classId, userId))!
  }

  async setRole(classId: string, userId: string, role: ClassRole): Promise<void> {
    if (isUuid(classId)) await this.sql`update class_members set role = ${role} where class_id = ${classId} and user_id = ${userId}`
  }

  async leave(classId: string, userId: string): Promise<void> {
    if (isUuid(classId)) await this.sql`delete from class_members where class_id = ${classId} and user_id = ${userId}`
  }

  async assign(input: NewAssignment): Promise<Assignment> {
    const id = input.id ?? randomUUID()
    await this.sql`insert into class_assignments (id, class_id, exam_id, title, settings, sources, opens_at, closes_at)
      values (${id}, ${input.classId}, ${input.examId}, ${input.title}, ${this.sql.json(input.settings as never)}, ${this.sql.json(input.sources as never)}, ${input.opensAt}, ${input.closesAt})`
    return (await this.assignment(id))!
  }

  async assignments(classId: string): Promise<Assignment[]> {
    if (!isUuid(classId)) return []
    const rows = await this.sql`select * from class_assignments where class_id = ${classId} order by created_at desc, id`
    return rows.map(toAssignment)
  }

  async assignment(id: string): Promise<Assignment | null> {
    if (!isUuid(id)) return null
    const [row] = await this.sql`select * from class_assignments where id = ${id}`
    return row ? toAssignment(row) : null
  }

  async updateAssignment(id: string, patch: AssignmentPatch): Promise<void> {
    const current = await this.assignment(id)
    if (!current) return
    const next = withPatch(current, patch)
    await this.sql`update class_assignments set title = ${next.title}, opens_at = ${next.opensAt}, closes_at = ${next.closesAt},
      settings = ${this.sql.json(next.settings as never)} where id = ${id}`
  }

  async deleteAssignment(id: string): Promise<void> {
    if (isUuid(id)) await this.sql`delete from class_assignments where id = ${id}`
  }

  async announcements(classId: string): Promise<Announcement[]> {
    if (!isUuid(classId)) return []
    const rows = await this.sql`select * from class_announcements where class_id = ${classId} order by created_at desc, id`
    return rows.map(toAnnouncement)
  }

  async announce(classId: string, authorId: string, text: string): Promise<Announcement> {
    const [row] = await this.sql`insert into class_announcements (id, class_id, author_id, text) values (${randomUUID()}, ${classId}, ${authorId}, ${text}) returning *`
    return toAnnouncement(row!)
  }

  async deleteAnnouncement(id: string): Promise<void> {
    if (isUuid(id)) await this.sql`delete from class_announcements where id = ${id}`
  }

  async recordAttempt(a: Omit<ClassAttempt, 'startedAt'>): Promise<void> {
    await this.sql`insert into class_attempts (attempt_id, assignment_id, user_id, preview) values (${a.attemptId}, ${a.assignmentId}, ${a.userId}, ${a.preview})`
  }

  async attempts(assignmentId: string, userId?: string): Promise<ClassAttempt[]> {
    if (!isUuid(assignmentId)) return []
    const rows =
      userId === undefined
        ? await this.sql`select * from class_attempts where assignment_id = ${assignmentId} order by started_at, attempt_id`
        : await this.sql`select * from class_attempts where assignment_id = ${assignmentId} and user_id = ${userId} order by started_at, attempt_id`
    return rows.map(toAttempt)
  }
}
