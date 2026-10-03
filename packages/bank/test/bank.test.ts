import { DatabaseSync } from 'node:sqlite'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { testDatabase } from '@exam/db'
import type { DraftExam, DraftQuestion } from '@exam/core'
import { PostgresBank, SqliteBank, type Bank } from '../src/index.ts'

function draftQuestion(overrides: Partial<DraftQuestion> = {}): DraftQuestion {
  return {
    number: '1', section: null, groupId: null, type: 'single_choice', stem: 'What is $1+1$?', translation: null,
    options: [{ label: 'A', content: '2' }, { label: 'B', content: '3' }], answer: { values: ['A'], source: 'printed' },
    explanation: null, points: 5, figures: [], confidence: 'high', issues: [], locations: [{ pageNumber: 1, bbox: { x: 0, y: 0, width: 1, height: 0.1 } }],
    ...overrides,
  }
}

const meta = { title: '期中考', subject: '數學', institution: null, term: null, language: 'zh-Hant' }
const draft = (questions: DraftQuestion[], extra: Partial<DraftExam> = {}): DraftExam => ({ fileName: 'exam.pdf', meta, groups: [], questions, pages: [], ...extra })

const pg = await testDatabase()
afterAll(() => pg?.drop())

/** The same behaviour is expected of every Bank. Postgres runs when TEST_DATABASE_URL is set. */
const banks: [string, () => Promise<Bank>][] = [['SqliteBank', async () => new SqliteBank(':memory:')]]
if (pg) banks.push(['PostgresBank', async () => {
  await pg.sql`truncate imports, exams, questions cascade`
  return new PostgresBank(pg.sql)
}])

describe.each(banks)('%s', (_name, open) => {
  it('tracks an import from upload to a saved exam', async () => {
    const bank = await open()
    const imp = await bank.createImport({ ownerId: 'local', fileName: 'exam.pdf', pageCount: 2, provider: 'manual', model: null })
    expect(imp.status).toBe('processing')

    await bank.updateImport(imp.id, { status: 'review', progress: { done: 2, total: 2 } })
    const d = draft([draftQuestion(), draftQuestion({ number: '2', type: 'essay', stem: 'Explain gravity.', groupId: 'g1' })], {
      groups: [{ id: 'g1', stem: 'Read the passage.', figures: [], pageNumber: 1 }],
    })
    await bank.saveDraft(imp.id, d)
    expect((await bank.getDraft(imp.id))?.questions).toHaveLength(2)
    expect(await bank.getImport(imp.id)).toMatchObject({ status: 'review', title: '期中考', subject: '數學', progress: { done: 2, total: 2 } })

    const exam = await bank.saveExam(imp.id, d)
    expect(exam).toMatchObject({ title: '期中考', subject: '數學', importId: imp.id, questionCount: 2, groups: [{ id: 'g1' }] })
    const saved = (await bank.listQuestions({ ownerId: 'local', examId: exam.id })).items
    expect(saved.map((q) => q.number)).toEqual(['1', '2'])
    expect(saved[0]).toMatchObject({ subject: '數學', examTitle: '期中考', examId: exam.id, position: 0 })
    expect(await bank.getImport(imp.id)).toMatchObject({ status: 'saved', questionCount: 2 })

    // Saving the same import again replaces the exam's questions instead of making a second exam.
    const again = await bank.saveExam(imp.id, draft(d.questions.slice(0, 1), { meta: { ...meta, title: '期中考（修正）' } }))
    expect(again.id).toBe(exam.id)
    expect(await bank.listExams({ ownerId: 'local' })).toMatchObject([{ title: '期中考（修正）', questionCount: 1 }])

    // Deleting the import keeps the exam.
    await bank.deleteImport(imp.id)
    expect(await bank.getExam(exam.id)).toMatchObject({ importId: null, questionCount: 1 })
    await bank.deleteExam(exam.id)
    expect((await bank.listQuestions({ ownerId: 'local' })).total).toBe(0)
  })

  it('searches exams and questions, and edits them', async () => {
    const bank = await open()
    const imp = await bank.createImport({ ownerId: 'local', fileName: 'exam.pdf', pageCount: 1, provider: 'claude', model: null })
    const exam = await bank.saveExam(imp.id, draft([draftQuestion(), draftQuestion({ number: '2', type: 'essay', stem: 'Explain Gravity.' })]))
    const other = await bank.createImport({ ownerId: 'someone-else', fileName: 'x.pdf', pageCount: 1, provider: 'claude', model: null })
    await bank.saveExam(other.id, draft([draftQuestion({ stem: 'gravity again' })]))

    expect((await bank.listQuestions({ ownerId: 'local', search: 'gravity' })).items.map((q) => q.number)).toEqual(['2'])
    expect((await bank.listQuestions({ ownerId: 'local', type: 'single_choice' })).total).toBe(1)
    expect(await bank.listExams({ ownerId: 'local', search: 'gravity' })).toHaveLength(1)
    expect(await bank.listExams({ ownerId: 'local', search: '期中' })).toHaveLength(1)
    expect(await bank.listExams({ ownerId: 'local', search: 'nothing' })).toHaveLength(0)
    expect(await bank.subjects('local')).toEqual(['數學'])

    await bank.updateExam(exam.id, { subject: '物理', term: '113-1' })
    expect(await bank.getExam(exam.id)).toMatchObject({ subject: '物理', term: '113-1', title: '期中考' })
    expect((await bank.listQuestions({ ownerId: 'local', subject: '物理' })).total).toBe(2)

    const q = (await bank.listQuestions({ ownerId: 'local', type: 'essay' })).items[0]!
    const updated = await bank.updateQuestion(q.id, { ...q, stem: 'Explain magnetism.' })
    expect(updated).toMatchObject({ stem: 'Explain magnetism.', id: q.id, examId: exam.id })
    expect((await bank.listQuestions({ ownerId: 'local', search: 'magnetism' })).total).toBe(1)
    expect(await bank.getQuestions([q.id, 'missing'])).toHaveLength(1)

    await bank.deleteQuestion(q.id)
    expect(await bank.getQuestion(q.id)).toBeNull()
  })

  it('finds saved imports whose uploaded files are due to go', async () => {
    const bank = await open()
    const make = async (keep: boolean) => {
      const imp = await bank.createImport({ ownerId: 'local', fileName: 'x.pdf', pageCount: 1, provider: 'claude', model: null })
      if (keep) await bank.updateImport(imp.id, { keepOriginal: true })
      return imp
    }
    const saved = await make(false)
    const kept = await make(true)
    const unsaved = await make(false)
    for (const imp of [saved, kept]) await bank.saveExam(imp.id, draft([draftQuestion()]))
    const ids = async (before: Date) => (await bank.originalsToExpire(before)).map((i) => i.id).filter((id) => [saved.id, kept.id, unsaved.id].includes(id))

    expect(await ids(new Date(Date.now() - 60_000))).toEqual([])
    expect(await ids(new Date(Date.now() + 60_000))).toEqual([saved.id])
    expect(await bank.getImport(kept.id)).toMatchObject({ keepOriginal: true, originalDeletedAt: null })

    const at = new Date().toISOString()
    await bank.updateImport(saved.id, { originalDeletedAt: at })
    expect(await bank.getImport(saved.id)).toMatchObject({ originalDeletedAt: at })
    expect(await ids(new Date(Date.now() + 60_000))).toEqual([])
  })
})

describe('SqliteBank', () => {
  it('files questions saved before exams existed under one exam per import', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'bank-')), 'old.sqlite')
    const old = new DatabaseSync(path)
    old.exec(`
      CREATE TABLE imports (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, file_name TEXT NOT NULL, page_count INTEGER NOT NULL, provider TEXT NOT NULL, model TEXT, status TEXT NOT NULL, progress_done INTEGER NOT NULL DEFAULT 0, progress_total INTEGER NOT NULL DEFAULT 0, error TEXT, title TEXT, subject TEXT, draft TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE questions (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, import_id TEXT REFERENCES imports (id) ON DELETE SET NULL, position INTEGER NOT NULL, type TEXT NOT NULL, subject TEXT, exam_title TEXT, search_text TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    `)
    const d = draft([draftQuestion()], { groups: [{ id: 'g', stem: 'shared', figures: [], pageNumber: 1 }] })
    old.prepare(`INSERT INTO imports VALUES ('i1', 'local', 'a.pdf', 1, 'manual', NULL, 'saved', 1, 1, NULL, '期中考', '數學', ?, 't0', 't0')`).run(JSON.stringify(d))
    const insert = old.prepare(`INSERT INTO questions VALUES (?, 'local', ?, ?, 'single_choice', ?, ?, 'x', ?, 't1', 't1')`)
    insert.run('q1', 'i1', 0, '數學', '期中考', JSON.stringify(draftQuestion({ number: '1' })))
    insert.run('q2', 'i1', 1, '數學', '期中考', JSON.stringify(draftQuestion({ number: '2' })))
    insert.run('q3', null, 0, null, '小考', JSON.stringify(draftQuestion({ number: '9' })))
    old.close()

    const bank = new SqliteBank(path)
    const exams = await bank.listExams({ ownerId: 'local' })
    expect(exams.map((e) => [e.title, e.questionCount, e.importId]).sort()).toEqual([['小考', 1, null], ['期中考', 2, 'i1']])
    const midterm = exams.find((e) => e.title === '期中考')!
    expect(midterm.groups).toEqual([{ id: 'g', stem: 'shared', figures: [], pageNumber: 1 }])
    expect((await bank.listQuestions({ ownerId: 'local', examId: midterm.id })).items.map((q) => q.number)).toEqual(['1', '2'])
    await bank.close()
    // A second open does not migrate again.
    expect(await new SqliteBank(path).listExams({ ownerId: 'local' })).toHaveLength(2)
  })
})
