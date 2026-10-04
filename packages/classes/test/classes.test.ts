import { afterAll, describe, expect, it } from 'vitest'
import { testDatabase } from '@exam/db'
import { PostgresBank } from '@exam/bank'
import { PostgresQuizStore, SqliteQuizStore, type QuizAttempt } from '@exam/quiz'
import { isOpen, JOIN_CODE, normalizeCode, PostgresClassStore, SqliteClassStore, type AssignmentSettings, type ClassStore } from '../src/index.ts'

const pg = await testDatabase()
afterAll(() => pg?.drop())

const SETTINGS: AssignmentSettings = { mode: 'exam', shuffleQuestions: true, shuffleOptions: false, timeLimitMinutes: 30, maxAttempts: 2, answers: 'after_close' }

/** Postgres links assignments to real exams and attempts to real quizzes. */
async function exam(): Promise<string | null> {
  if (!pg) return null
  return (await new PostgresBank(pg.sql).createExam('teacher', { meta: { title: 'A' }, groups: [], questions: [] })).id
}

async function quiz(ownerId: string): Promise<string> {
  const store = pg ? new PostgresQuizStore(pg.sql) : new SqliteQuizStore(':memory:')
  const attempt: Omit<QuizAttempt, 'id'> = {
    ownerId,
    title: 'A',
    examIds: [],
    settings: { mode: 'exam', shuffleQuestions: false, shuffleOptions: false, timeLimitMinutes: null },
    items: [],
    responses: [],
    markings: [],
    checked: [],
    startedAt: new Date().toISOString(),
    deadline: null,
    finishedAt: null,
  }
  return (await store.create(attempt)).id
}

const stores: [string, () => ClassStore][] = [['SqliteClassStore', () => new SqliteClassStore(':memory:')]]
if (pg) stores.push(['PostgresClassStore', () => new PostgresClassStore(pg.sql)])

describe.each(stores)('%s', (_name, open) => {
  it('makes a class with its teacher, lets students join by code, and changes roles', async () => {
    const store = open()
    const c = await store.create('teacher', '王老師', '三年二班')
    expect(c.joinCode).toMatch(JOIN_CODE)
    expect(c).toMatchObject({ ownerId: 'teacher', name: '三年二班', joinOpen: true, aiPayer: 'teacher', aiMonthlyCapUsd: null })
    expect(await store.byCode(c.joinCode.toLowerCase().replace(/^(...)/, '$1-'))).toMatchObject({ id: c.id })

    await store.join(c.id, 'amy', 'Amy')
    // joining again keeps the role
    await store.setRole(c.id, 'amy', 'assistant')
    expect(await store.join(c.id, 'amy', 'Amy')).toMatchObject({ role: 'assistant' })
    await store.join(c.id, 'bo', 'Bo')
    expect((await store.members(c.id)).map((m) => [m.userId, m.role])).toEqual([
      ['teacher', 'teacher'],
      ['amy', 'assistant'],
      ['bo', 'student'],
    ])
    expect(await store.of('bo')).toMatchObject([{ classroom: { id: c.id }, role: 'student' }])

    await store.leave(c.id, 'bo')
    expect(await store.member(c.id, 'bo')).toBeNull()
    expect(await store.of('bo')).toEqual([])

    const code = await store.newCode(c.id)
    expect(code).not.toBe(c.joinCode)
    expect(await store.byCode(c.joinCode)).toBeNull()

    await store.update(c.id, { name: '三年三班', joinOpen: false, aiPayer: 'mixed', aiMonthlyCapUsd: 2.5 })
    expect(await store.get(c.id)).toMatchObject({ name: '三年三班', joinOpen: false, aiPayer: 'mixed', aiMonthlyCapUsd: 2.5 })
    await store.update(c.id, { aiMonthlyCapUsd: null })
    expect((await store.get(c.id))?.aiMonthlyCapUsd).toBeNull()
  })

  it('keeps assignments with their frozen questions, and who started them', async () => {
    const store = open()
    const c = await store.create('teacher', '王老師', '三年二班')
    const examId = await exam()
    const sources = [{ questionId: 'q1', question: { number: '1', type: 'single_choice', stem: '1+1?' } as never, group: null }]
    const a = await store.assign({ classId: c.id, examId, title: '第一次小考', settings: SETTINGS, sources, opensAt: null, closesAt: '2030-01-01T00:00:00.000Z' })
    expect(await store.assignment(a.id)).toMatchObject({ title: '第一次小考', examId, settings: SETTINGS, sources, closesAt: '2030-01-01T00:00:00.000Z' })
    expect((await store.assignments(c.id)).map((x) => x.id)).toEqual([a.id])

    await store.updateAssignment(a.id, { closesAt: null, answers: 'never', title: '小考' })
    expect(await store.assignment(a.id)).toMatchObject({ title: '小考', closesAt: null, settings: { ...SETTINGS, answers: 'never' } })

    const one = await quiz('bo')
    const two = await quiz('teacher')
    await store.recordAttempt({ attemptId: one, assignmentId: a.id, userId: 'bo', preview: false })
    await store.recordAttempt({ attemptId: two, assignmentId: a.id, userId: 'teacher', preview: true })
    expect(await store.attempts(a.id)).toMatchObject([
      { attemptId: one, userId: 'bo', preview: false },
      { attemptId: two, userId: 'teacher', preview: true },
    ])
    expect((await store.attempts(a.id, 'bo')).map((x) => x.attemptId)).toEqual([one])

    await store.deleteAssignment(a.id)
    expect(await store.assignment(a.id)).toBeNull()
    expect(await store.attempts(a.id)).toEqual([])
  })

  it('deletes a class with everything in it', async () => {
    const store = open()
    const c = await store.create('teacher', '王老師', '社團')
    await store.join(c.id, 'bo', 'Bo')
    const a = await store.assign({ classId: c.id, examId: null, title: 'x', settings: SETTINGS, sources: [], opensAt: null, closesAt: null })
    await store.delete(c.id)
    expect(await store.get(c.id)).toBeNull()
    expect(await store.of('bo')).toEqual([])
    expect(await store.assignment(a.id)).toBeNull()
  })
})

describe('join codes and windows', () => {
  it('reads codes the way people type them', () => {
    expect(normalizeCode(' ab3-k9z ')).toBe('AB3K9Z')
  })

  it('is open between its times', () => {
    const now = new Date('2026-10-03T12:00:00Z')
    expect(isOpen({ opensAt: null, closesAt: null }, now)).toBe(true)
    expect(isOpen({ opensAt: '2026-10-04T00:00:00Z', closesAt: null }, now)).toBe(false)
    expect(isOpen({ opensAt: null, closesAt: '2026-10-03T12:00:00Z' }, now)).toBe(false)
  })
})
