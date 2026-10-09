import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteBank } from '@exam/bank'
import type { DraftExam } from '@exam/core'
import { LocalFileStore } from '@exam/files'
import { Importer, MAX_MATERIAL_PAGES, TOO_MANY_PAGES, WRITTEN, type Material } from '../src/index.ts'
import { question } from '../../core/test/fixtures.ts'

let dataDir: string
let bank: SqliteBank
let importer: Importer

const png = () => sharp({ create: { width: 400, height: 600, channels: 3, background: '#fff' } }).png().toBuffer()

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'written-'))
  bank = new SqliteBank(':memory:')
  importer = new Importer({ bank, files: new LocalFileStore(dataDir) })
})
afterEach(async () => {
  await bank.close()
  await rm(dataDir, { recursive: true, force: true })
})

const exam = (withFigure: boolean): DraftExam => ({
  fileName: 'x',
  meta: { title: 'Cells', subject: 'Biology', institution: null, term: null, language: 'en' },
  groups: [],
  questions: [
    {
      ...question(),
      locations: [],
      figures: withFigure ? [{ description: 'a cell', bbox: { x: 0.1, y: 0.1, width: 0.5, height: 0.3 }, blanks: [], option: null, pageNumber: 1, image: null }] : [],
    },
  ],
  pages: [],
})

describe('exams written from study material', () => {
  it('keeps the material, hands it to the writer, crops figures from its pages and opens as a draft', async () => {
    const imp = await importer.written.create({ ownerId: 'local', fileName: 'Cells', files: [{ name: 'notes.png', data: await png() }, { name: 'extra.md', data: Buffer.from('# Mitosis') }], text: 'pasted', request: { n: 1 }, model: 'm' })
    expect(imp).toMatchObject({ provider: WRITTEN, pageCount: 0 })
    expect(await importer.written.firstPage(imp)).toMatch(/material\/page-1\.webp$/)
    let seen: { material: Material; request: unknown } | null = null
    await importer.written.start(imp, async (material, request) => {
      seen = { material, request }
      return exam(true)
    })
    await importer.written.settled(imp.id)
    expect(seen!.request).toEqual({ n: 1 })
    expect(seen!.material.pages).toHaveLength(1)
    expect(seen!.material.text).toContain('pasted')
    expect(seen!.material.text).toContain('# Mitosis')
    expect(await bank.getImport(imp.id)).toMatchObject({ status: 'review', title: 'Cells' })
    const draft = (await bank.getDraft(imp.id))!
    expect(draft.questions[0]!.figures[0]!.image?.file).toMatch(/figures\/q1-1\.png$/)
    expect((await importer.originals(imp.id)).map((f) => f.name)).toEqual(['notes.png', 'extra.md'])
  })

  it('fails with the reason when the writer fails, and can be written again', async () => {
    const imp = await importer.written.create({ ownerId: 'local', fileName: 'x', files: [], text: 'notes', request: {}, model: null })
    await importer.written.start(imp, async () => Promise.reject(new Error('quota')))
    await importer.written.settled(imp.id)
    expect(await bank.getImport(imp.id)).toMatchObject({ status: 'failed', error: 'quota' })
    await importer.written.start(imp, async () => exam(false))
    await importer.written.settled(imp.id)
    expect(await bank.getImport(imp.id)).toMatchObject({ status: 'review', error: null })
  })

  it('refuses material longer than the page limit', async () => {
    const one = await png()
    const files = Array.from({ length: MAX_MATERIAL_PAGES + 1 }, (_, i) => ({ name: `${i}.png`, data: one }))
    await expect(importer.written.create({ ownerId: 'local', fileName: 'x', files, text: null, request: {}, model: null })).rejects.toThrow(TOO_MANY_PAGES)
    expect(await bank.listImports('local')).toEqual([])
  })
})
