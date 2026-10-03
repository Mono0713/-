import { afterAll, describe, expect, it } from 'vitest'
import { testDatabase } from '@exam/db'
import { PostgresBank } from '@exam/bank'
import { PostgresShareStore, SqliteShareStore, TOKEN, type ShareStore } from '../src/index.ts'

const pg = await testDatabase()
afterAll(() => pg?.drop())

/** Postgres links shares to real exams, so each test gets two. */
async function exams(): Promise<[string, string]> {
  if (!pg) return ['exam-1', 'exam-2']
  const bank = new PostgresBank(pg.sql)
  const one = await bank.createExam('owner', { meta: { title: 'A' }, groups: [], questions: [] })
  const two = await bank.createExam('reader', { meta: { title: 'B' }, groups: [], questions: [] })
  return [one.id, two.id]
}

const stores: [string, () => ShareStore][] = [['SqliteShareStore', () => new SqliteShareStore(':memory:')]]
if (pg) stores.push(['PostgresShareStore', () => new PostgresShareStore(pg.sql)])

describe.each(stores)('%s', (_name, open) => {
  it('opens one link per exam, closes it, and makes a new one when shared again', async () => {
    const store = open()
    const [exam] = await exams()
    const first = await store.open(exam, 'owner', 'after_submit')
    expect(first.token).toMatch(TOKEN)
    expect(await store.open(exam, 'owner', 'never')).toMatchObject({ token: first.token, answers: 'never' })
    expect(await store.get(first.token)).toMatchObject({ examId: exam, ownerId: 'owner', answers: 'never', closedAt: null })
    expect(await store.forExam(exam)).toMatchObject({ token: first.token })

    await store.close(exam)
    expect(await store.forExam(exam)).toBeNull()
    expect((await store.get(first.token))?.closedAt).toBeTruthy()
    const again = await store.open(exam, 'owner', 'after_submit')
    expect(again.token).not.toBe(first.token)
    expect(await store.get('nope')).toBeNull()
  })

  it('lets the owner turn copying off, and keeps that choice when only the answers change', async () => {
    const store = open()
    const [exam] = await exams()
    expect(await store.open(exam, 'owner', 'after_submit')).toMatchObject({ allowCopy: true })
    const { token } = await store.open(exam, 'owner', 'after_submit', false)
    expect(await store.get(token)).toMatchObject({ allowCopy: false })
    expect(await store.open(exam, 'owner', 'never')).toMatchObject({ token, answers: 'never', allowCopy: false })
    expect(await store.get(token)).toMatchObject({ allowCopy: false })
    await store.open(exam, 'owner', 'never', true)
    expect(await store.get(token)).toMatchObject({ allowCopy: true })
  })

  it('remembers the copies each person made from a link', async () => {
    const store = open()
    const [exam, copy] = await exams()
    const { token } = await store.open(exam, 'owner', 'after_submit')
    expect(await store.copies(token, 'reader')).toEqual([])
    await store.recordCopy(token, 'reader', copy)
    expect(await store.copies(token, 'reader')).toEqual([copy])
    expect(await store.copies(token, 'someone-else')).toEqual([])
  })
})
