import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { toAnnouncement, toAssignment, toAttempt, toClass, toMember, withPatch, type Row } from './rows.ts'
import { newJoinCode, normalizeCode, type Announcement, type Assignment, type AssignmentPatch, type ClassAttempt, type Classroom, type ClassPatch, type ClassRole, type ClassStore, type Member, type NewAssignment } from './types.ts'

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
      CREATE INDEX IF NOT EXISTS class_attempts_assignment ON class_attempts (assignment_id, user_id);
      CREATE TABLE IF NOT EXISTS class_announcements (
        id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES classes (id) ON DELETE CASCADE, author_id TEXT NOT NULL,
        text TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS class_announcements_class ON class_announcements (class_id, created_at);`)
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

  async announcements(classId: string): Promise<Announcement[]> {
    const rows = this.db.prepare('SELECT * FROM class_announcements WHERE class_id = ? ORDER BY created_at DESC, rowid DESC').all(classId) as Row[]
    return rows.map(toAnnouncement)
  }

  async announce(classId: string, authorId: string, text: string): Promise<Announcement> {
    const id = randomUUID()
    this.db.prepare('INSERT INTO class_announcements (id, class_id, author_id, text, created_at) VALUES (?, ?, ?, ?, ?)').run(id, classId, authorId, text, new Date().toISOString())
    return toAnnouncement(this.db.prepare('SELECT * FROM class_announcements WHERE id = ?').get(id) as Row)
  }

  async deleteAnnouncement(id: string): Promise<void> {
    this.db.prepare('DELETE FROM class_announcements WHERE id = ?').run(id)
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
