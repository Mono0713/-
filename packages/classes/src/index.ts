import { randomInt, randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { iso, isUuid, type Sql } from '@exam/db'
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
export type AssignmentPatch = Partial<Pick<Assignment, 'title' | 'opensAt' | 'closesAt'>> & { answers?: AssignmentAnswers }

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

type Row = Record<string, unknown>

export class SqliteClassStore implements ClassStore {
  private readonly db: DatabaseSync

  /** `path` can be the bank's database file, or ":memory:". */
  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec(`PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, join_code TEXT NOT NULL UNIQUE,
        join_open INTEGER NOT NULL DEFAULT 1, ai_payer TEXT NOT NULL DEFAULT 'teacher', ai_monthly_cap_usd REAL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS class_members (
        class_id TEXT NOT NULL REFERENCES classes (id) ON DELETE CASCADE, user_id TEXT NOT NULL, role TEXT NOT NULL,
        name TEXT NOT NULL, joined_at TEXT NOT NULL, PRIMARY KEY (class_id, user_id));
      CREATE INDEX IF NOT EXISTS class_members_user ON class_members (user_id);
      CREATE TABLE IF NOT EXISTS class_assignments (
        id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES classes (id) ON DELETE CASCADE, exam_id TEXT, title TEXT NOT NULL,
        settings TEXT NOT NULL, sources TEXT NOT NULL, opens_at TEXT, closes_at TEXT, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS class_assignments_class ON class_assignments (class_id, created_at);
      CREATE TABLE IF NOT EXISTS class_attempts (
        attempt_id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES class_assignments (id) ON DELETE CASCADE,
        user_id TEXT NOT NULL, preview INTEGER NOT NULL DEFAULT 0, started_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS class_attempts_assignment ON class_attempts (assignment_id, user_id);`)
  }

  async create(ownerId: string, ownerName: string, name: string): Promise<Classroom> {
    const id = randomUUID()
    const now = new Date().toISOString()
    for (;;) {
      try {
        this.db.prepare('INSERT INTO classes (id, owner_id, name, join_code, created_at) VALUES (?, ?, ?, ?, ?)').run(id, ownerId, name, newJoinCode(), now)
        break
      } catch (err) {
        if (!String(err).includes('UNIQUE')) throw err
      }
    }
    this.db.prepare('INSERT INTO class_members (class_id, user_id, role, name, joined_at) VALUES (?, ?, ?, ?, ?)').run(id, ownerId, 'teacher', ownerName, now)
    return (await this.get(id))!
  }

  async get(id: string): Promise<Classroom | null> {
    const row = this.db.prepare('SELECT * FROM classes WHERE id = ?').get(id) as Row | undefined
    return row ? toClass(row) : null
  }

  async byCode(code: string): Promise<Classroom | null> {
    const row = this.db.prepare('SELECT * FROM classes WHERE join_code = ?').get(normalizeCode(code)) as Row | undefined
    return row ? toClass(row) : null
  }

  async update(id: string, patch: ClassPatch): Promise<void> {
    const cols: [string, string | number | null][] = []
    if (patch.name !== undefined) cols.push(['name', patch.name])
    if (patch.joinOpen !== undefined) cols.push(['join_open', patch.joinOpen ? 1 : 0])
    if (patch.aiPayer !== undefined) cols.push(['ai_payer', patch.aiPayer])
    if (patch.aiMonthlyCapUsd !== undefined) cols.push(['ai_monthly_cap_usd', patch.aiMonthlyCapUsd])
    if (!cols.length) return
    this.db.prepare(`UPDATE classes SET ${cols.map(([c]) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map(([, v]) => v), id)
  }

  async newCode(id: string): Promise<string> {
    for (;;) {
      const code = newJoinCode()
      try {
        this.db.prepare('UPDATE classes SET join_code = ? WHERE id = ?').run(code, id)
        return code
      } catch (err) {
        if (!String(err).includes('UNIQUE')) throw err
      }
    }
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM classes WHERE id = ?').run(id)
  }

  async of(userId: string): Promise<{ classroom: Classroom; role: ClassRole }[]> {
    const rows = this.db.prepare('SELECT c.*, m.role AS member_role FROM class_members m JOIN classes c ON c.id = m.class_id WHERE m.user_id = ? ORDER BY c.created_at DESC').all(userId) as Row[]
    return rows.map((r) => ({ classroom: toClass(r), role: String(r.member_role) as ClassRole }))
  }

  async members(classId: string): Promise<Member[]> {
    const rows = this.db.prepare('SELECT * FROM class_members WHERE class_id = ? ORDER BY joined_at, rowid').all(classId) as Row[]
    return rows.map(toMember)
  }

  async member(classId: string, userId: string): Promise<Member | null> {
    const row = this.db.prepare('SELECT * FROM class_members WHERE class_id = ? AND user_id = ?').get(classId, userId) as Row | undefined
    return row ? toMember(row) : null
  }

  async join(classId: string, userId: string, name: string): Promise<Member> {
    this.db
      .prepare('INSERT INTO class_members (class_id, user_id, role, name, joined_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (class_id, user_id) DO NOTHING')
      .run(classId, userId, 'student', name, new Date().toISOString())
    return (await this.member(classId, userId))!
  }

  async setRole(classId: string, userId: string, role: ClassRole): Promise<void> {
    this.db.prepare('UPDATE class_members SET role = ? WHERE class_id = ? AND user_id = ?').run(role, classId, userId)
  }

  async leave(classId: string, userId: string): Promise<void> {
    this.db.prepare('DELETE FROM class_members WHERE class_id = ? AND user_id = ?').run(classId, userId)
  }

  async assign(input: NewAssignment): Promise<Assignment> {
    const id = input.id ?? randomUUID()
    this.db
      .prepare('INSERT INTO class_assignments (id, class_id, exam_id, title, settings, sources, opens_at, closes_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, input.classId, input.examId, input.title, JSON.stringify(input.settings), JSON.stringify(input.sources), input.opensAt, input.closesAt, new Date().toISOString())
    return (await this.assignment(id))!
  }

  async assignments(classId: string): Promise<Assignment[]> {
    const rows = this.db.prepare('SELECT * FROM class_assignments WHERE class_id = ? ORDER BY created_at DESC, rowid DESC').all(classId) as Row[]
    return rows.map(toAssignment)
  }

  async assignment(id: string): Promise<Assignment | null> {
    const row = this.db.prepare('SELECT * FROM class_assignments WHERE id = ?').get(id) as Row | undefined
    return row ? toAssignment(row) : null
  }

  async updateAssignment(id: string, patch: AssignmentPatch): Promise<void> {
    const current = await this.assignment(id)
    if (!current) return
    const next = withPatch(current, patch)
    this.db.prepare('UPDATE class_assignments SET title = ?, opens_at = ?, closes_at = ?, settings = ? WHERE id = ?').run(next.title, next.opensAt, next.closesAt, JSON.stringify(next.settings), id)
  }

  async deleteAssignment(id: string): Promise<void> {
    this.db.prepare('DELETE FROM class_assignments WHERE id = ?').run(id)
  }

  async recordAttempt(a: Omit<ClassAttempt, 'startedAt'>): Promise<void> {
    this.db
      .prepare('INSERT INTO class_attempts (attempt_id, assignment_id, user_id, preview, started_at) VALUES (?, ?, ?, ?, ?)')
      .run(a.attemptId, a.assignmentId, a.userId, a.preview ? 1 : 0, new Date().toISOString())
  }

  async attempts(assignmentId: string, userId?: string): Promise<ClassAttempt[]> {
    const rows = (
      userId === undefined
        ? this.db.prepare('SELECT * FROM class_attempts WHERE assignment_id = ? ORDER BY started_at, rowid').all(assignmentId)
        : this.db.prepare('SELECT * FROM class_attempts WHERE assignment_id = ? AND user_id = ? ORDER BY started_at, rowid').all(assignmentId, userId)
    ) as Row[]
    return rows.map(toAttempt)
  }
}

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

function withPatch(a: Assignment, patch: AssignmentPatch): Assignment {
  return {
    ...a,
    title: patch.title ?? a.title,
    opensAt: patch.opensAt !== undefined ? patch.opensAt : a.opensAt,
    closesAt: patch.closesAt !== undefined ? patch.closesAt : a.closesAt,
    settings: patch.answers ? { ...a.settings, answers: patch.answers } : a.settings,
  }
}

const at = (v: unknown): string | null => (v === null || v === undefined ? null : iso(v instanceof Date ? v : String(v)))
const json = <T>(v: unknown): T => (typeof v === 'string' ? (JSON.parse(v) as T) : (v as T))

function toClass(r: Row): Classroom {
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

function toMember(r: Row): Member {
  return { classId: String(r.class_id), userId: String(r.user_id), role: String(r.role) as ClassRole, name: String(r.name), joinedAt: at(r.joined_at)! }
}

function toAssignment(r: Row): Assignment {
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

function toAttempt(r: Row): ClassAttempt {
  return { attemptId: String(r.attempt_id), assignmentId: String(r.assignment_id), userId: String(r.user_id), preview: Boolean(Number(r.preview)), startedAt: at(r.started_at)! }
}

/** Whether the assignment takes new attempts now: after it opens and before it closes. */
export function isOpen(a: Pick<Assignment, 'opensAt' | 'closesAt'>, now = new Date()): boolean {
  return (!a.opensAt || now >= new Date(a.opensAt)) && (!a.closesAt || now < new Date(a.closesAt))
}

/** Whether a member with this role runs the class: sees everyone's work and changes assignments. */
export const canTeach = (role: ClassRole | null | undefined): boolean => role === 'teacher' || role === 'assistant'
export * from './stats.ts'
