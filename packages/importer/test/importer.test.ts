import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteBank } from '@exam/bank'
import { LocalFileStore } from '@exam/files'
import { registerProvider } from '@exam/extraction'
import { AUTO, BLANK, Importer, INTERRUPTED, type ReadingPlan } from '../src/index.ts'
import { page, question } from '../../core/test/fixtures.ts'

let dataDir: string
let bank: SqliteBank
let importer: Importer

registerProvider('fake', () => ({
  id: 'fake',
  model: 'fake-1',
  complete: async () => ({ text: JSON.stringify(page([question()])), model: 'fake-1', usage: { inputTokens: 10, outputTokens: 5 } }),
}))

// For automatic reading: a provider that is down, one unsure of what it read, and a sure one.
const reply = (confidence: 'high' | 'low', model: string) => async () => ({ text: JSON.stringify(page([question({ confidence })])), model, usage: { inputTokens: 100, outputTokens: 50 } })
registerProvider('down', () => ({ id: 'down', model: 'down-1', complete: async () => Promise.reject(Object.assign(new Error('invalid key'), { status: 401 })) }))
registerProvider('unsure', (c) => ({ id: 'unsure', model: c.model ?? 'unsure-1', complete: reply(c.model === 'unsure-best' ? 'high' : 'low', c.model ?? 'unsure-1') }))

const png = () => sharp({ create: { width: 200, height: 300, channels: 3, background: '#fff' } }).png().toBuffer()

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'importer-'))
  bank = new SqliteBank(':memory:')
  importer = new Importer({ bank, files: new LocalFileStore(dataDir) })
})
afterEach(async () => {
  await bank.close()
  await rm(dataDir, { recursive: true, force: true })
})

describe('automatic reading', () => {
  const auto = (plan: ReadingPlan | null) => {
    const seen: string[] = []
    const importer = new Importer({ bank, files: new LocalFileStore(dataDir), plan: async () => plan, onPage: (_imp, r) => seen.push(`${r.pageNumber}:${r.model}:${r.page ? 'ok' : 'failed'}`) })
    return { importer, seen }
  }

  it('hands pages the first provider cannot read to the next one', async () => {
    const { importer, seen } = auto({ primary: { provider: 'down' }, fallbacks: [{ provider: 'fake' }], escalate: null })
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'p1.png', data: await png() }], provider: AUTO })
    await importer.settled(imp.id)
    expect(await bank.getImport(imp.id)).toMatchObject({ status: 'review', provider: AUTO })
    expect((await importer.pageResults(imp.id))[0]).toMatchObject({ provider: 'fake', model: 'fake-1' })
    expect(seen).toEqual(['1:down-1:failed', '1:fake-1:ok'])
  })

  it('reads doubtful pages again with the stronger model', async () => {
    const { importer, seen } = auto({ primary: { provider: 'unsure', model: 'unsure-1' }, fallbacks: [], escalate: { provider: 'unsure', model: 'unsure-best' } })
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'p1.png', data: await png() }], provider: AUTO })
    await importer.settled(imp.id)
    expect((await importer.pageResults(imp.id))[0]).toMatchObject({ model: 'unsure-best' })
    expect(seen).toEqual(['1:unsure-1:ok', '1:unsure-best:ok'])
  })

  it('fails with a clear message when no provider has a key', async () => {
    const { importer } = auto(null)
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'p1.png', data: await png() }], provider: AUTO })
    await importer.settled(imp.id)
    expect(await bank.getImport(imp.id)).toMatchObject({ status: 'failed', error: expect.stringMatching(/API key/) })
  })
})

describe('uploaded files', () => {
  it('deletes them 30 days after saving unless kept, and reads again from the page images', async () => {
    const imp = await importer.create({ ownerId: 'local', files: [{ name: '小考.png', data: await png() }], provider: 'fake' })
    await importer.settled(imp.id)
    await importer.publish(imp.id, (await bank.getDraft(imp.id))!)
    const kept = await importer.create({ ownerId: 'local', files: [{ name: 'kept.png', data: await png() }], provider: 'fake' })
    await importer.settled(kept.id)
    await importer.publish(kept.id, (await bank.getDraft(kept.id))!)
    await bank.updateImport(kept.id, { keepOriginal: true })
    expect(await importer.originals(imp.id)).toEqual([{ name: '小考.png', key: expect.stringMatching(/sources\/1\.png$/) }])

    expect(await importer.expireOriginals()).toBe(0)
    const later = new Date(Date.now() + 31 * 86_400_000)
    expect(await importer.expireOriginals(later)).toBe(1)
    expect(await importer.originals(imp.id)).toEqual([])
    expect(await importer.originals(kept.id)).toHaveLength(1)
    expect(await bank.getImport(imp.id)).toMatchObject({ originalDeletedAt: later.toISOString() })
    expect(existsSync(join(dataDir, importer.pageImage(imp, 1)))).toBe(true)

    await importer.rerun(imp.id)
    await importer.settled(imp.id)
    expect(await bank.getImport(imp.id)).toMatchObject({ status: 'review', error: null })
    expect(await importer.expireOriginals(later)).toBe(0)
  })
})

describe('Importer', () => {
  it('turns several photos into one draft ready for review, then into bank questions', async () => {
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'p1.png', data: await png() }, { name: 'p2.png', data: await png() }], provider: 'fake' })
    expect(imp.pageCount).toBe(2)
    await importer.settled(imp.id)

    expect(await bank.getImport(imp.id)).toMatchObject({ status: 'review', progress: { done: 2, total: 2 } })
    const draft = (await bank.getDraft(imp.id))!
    expect(draft.questions).toHaveLength(2)
    expect(draft.questions[0]!.locations[0]!.pageNumber).toBe(1)

    await importer.publish(imp.id, draft)
    expect(await bank.getImport(imp.id)).toMatchObject({ status: 'saved', questionCount: 2 })
  })

  it('crops a figure again with its blanks switched to pencil mode', async () => {
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'p1.png', data: await png() }], provider: 'fake' })
    await importer.settled(imp.id)
    const figure = {
      description: 'diagram',
      pageNumber: 1,
      bbox: { x: 0.1, y: 0.1, width: 0.8, height: 0.5 },
      blanks: [{ label: '1', bbox: { x: 0.2, y: 0.2, width: 0.3, height: 0.1 }, ink: 'dark' as const, printedText: '1. ___' }],
      image: null,
    }
    const first = await importer.recropFigure(imp.id, figure)
    expect(first.image).toMatchObject({ width: 162, blanks: [{ label: '1', ink: 'dark', printedText: '1. ___' }] })
    expect(existsSync(join(dataDir, first.image!.file))).toBe(true)
    const second = await importer.recropFigure(imp.id, first)
    expect(second.image!.file).not.toBe(first.image!.file)
    expect(second.image!.file).toMatch(/^imports\/[\w-]+\/figures\/figure-r\d+\.png$/)
  })

  it('keeps the draft and figure images of a saved exam when its files are deleted', async () => {
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'p1.png', data: await png() }], provider: 'fake' })
    await importer.settled(imp.id)
    const figure = await importer.recropFigure(imp.id, { description: 'd', pageNumber: 1, bbox: { x: 0, y: 0, width: 1, height: 1 }, blanks: [], image: null })
    await importer.publish(imp.id, (await bank.getDraft(imp.id))!)
    await importer.remove(imp.id)
    // still editable, on the A4 sheet like an exam written from scratch
    expect(await bank.getImport(imp.id)).toMatchObject({ pageCount: 0, originalDeletedAt: expect.any(String) })
    expect(await bank.getDraft(imp.id)).not.toBeNull()
    expect(await importer.originals(imp.id)).toEqual([])
    expect(existsSync(join(dataDir, figure.image!.file))).toBe(true)
    expect(existsSync(join(dataDir, importer.pageImage(imp, 1)))).toBe(false)
    expect(existsSync(join(dataDir, 'imports', imp.id, 'results.json'))).toBe(false)
  })

  it('waits for pasted chat replies in manual mode', async () => {
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'a.png', data: await png() }, { name: 'b.png', data: await png() }], provider: 'manual' })
    await importer.settled(imp.id)
    expect((await bank.getImport(imp.id))?.status).toBe('waiting')

    const state = await importer.manualState(imp.id)
    expect(state.pages.map((p) => [p.pageNumber, p.done, Boolean(p.prompt)])).toEqual([[1, false, true], [2, false, true]])
    expect(state.batch?.pages).toEqual([1, 2])
    expect(state.pages[0]!.image).toBe(`imports/${imp.id}/pages/page-1.webp`)
    await expect(readFile(join(dataDir, state.pages[0]!.image))).resolves.toBeInstanceOf(Buffer)

    await importer.submitManualReply(imp.id, 1, '```json\n' + JSON.stringify(page([question()])) + '\n```')
    await importer.settled(imp.id)
    expect((await bank.getImport(imp.id))?.status).toBe('waiting')
    expect((await importer.manualState(imp.id)).pages.map((p) => p.done)).toEqual([true, false])

    await importer.submitManualReply(imp.id, 'batch', JSON.stringify({ pages: [{ pageNumber: 2, result: page([question({ number: '2' })]) }] }))
    await importer.settled(imp.id)
    expect((await bank.getImport(imp.id))?.status).toBe('review')
    expect((await bank.getDraft(imp.id))!.questions.map((q) => q.number)).toEqual(['1', '2'])
  })

  it('keeps each owner\'s files under their own prefix', async () => {
    const shared = new Importer({ bank, files: new LocalFileStore(dataDir), keyPrefix: (owner) => `u/${owner}/` })
    const imp = await shared.create({ ownerId: 'alice', files: [{ name: 'a.png', data: await png() }], provider: 'fake' })
    await shared.settled(imp.id)
    expect(shared.pageImage(imp, 1)).toBe(`u/alice/imports/${imp.id}/pages/page-1.webp`)
    // kept compressed; imports made before keep their PNG pages
    expect(readFileSync(join(dataDir, 'u', 'alice', 'imports', imp.id, 'pages', 'page-1.webp')).subarray(8, 12).toString()).toBe('WEBP')
    expect(shared.pageImage({ ...imp, pageFormat: 'png' }, 1)).toBe(`u/alice/imports/${imp.id}/pages/page-1.png`)
    const figure = await shared.recropFigure(imp.id, { description: 'd', pageNumber: 1, bbox: { x: 0, y: 0, width: 1, height: 1 }, blanks: [], image: null })
    expect(figure.image!.file.startsWith(`u/alice/imports/${imp.id}/figures/`)).toBe(true)
    expect(existsSync(join(dataDir, 'u', 'alice', 'imports', imp.id, 'results.json'))).toBe(true)
  })

  it('marks an import failed when no page can be read', async () => {
    registerProvider('broken', () => ({ id: 'broken', model: 'x', complete: async () => ({ text: 'not json', model: 'x', usage: { inputTokens: null, outputTokens: null } }) }))
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'a.png', data: await png() }], provider: 'broken' })
    await importer.settled(imp.id)
    expect(await bank.getImport(imp.id)).toMatchObject({ status: 'failed' })
    expect((await bank.getImport(imp.id))?.error).toBeTruthy()
  })
})

describe('reading more pages', () => {
  it('keeps the edits and moved boxes of pages already read', async () => {
    // the free quota runs out after the first page; it is back when the second page is read again
    let calls = 0
    registerProvider('quota', () => ({
      id: 'quota',
      model: 'quota-1',
      complete: async () => {
        if (calls++ === 1) throw Object.assign(new Error('quota'), { status: 401 })
        return { text: JSON.stringify(page([question({ number: String(calls) })])), model: 'quota-1', usage: { inputTokens: 1, outputTokens: 1 } }
      },
    }))
    const importer = new Importer({ bank, files: new LocalFileStore(dataDir), concurrency: 1 })
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'p1.png', data: await png() }, { name: 'p2.png', data: await png() }], provider: 'quota' })
    await importer.settled(imp.id)
    const draft = (await bank.getDraft(imp.id))!
    expect(draft.questions.map((q) => q.number)).toEqual(['1'])
    const moved = { pageNumber: 1, bbox: { x: 0.2, y: 0.3, width: 0.5, height: 0.2 }, manual: true }
    await importer.saveDraft(imp.id, { ...draft, questions: [{ ...draft.questions[0]!, stem: 'edited', locations: [moved] }] })

    await importer.rerun(imp.id, { pages: [2] })
    await importer.settled(imp.id)
    const after = (await bank.getDraft(imp.id))!
    expect(after.questions.map((q) => [q.number, q.stem])).toEqual([['1', 'edited'], ['3', question().stem]])
    expect(after.questions[0]!.locations).toEqual([moved])
  })
})

describe('exams written from scratch', () => {
  it('opens an empty draft for review, saves it to the bank and deletes cleanly', async () => {
    const imp = await importer.createBlank('local')
    expect(imp).toMatchObject({ status: 'review', pageCount: 0, provider: BLANK })
    expect((await bank.getDraft(imp.id))?.questions).toEqual([])
    const exam = await importer.publish(imp.id, { ...(await bank.getDraft(imp.id))!, meta: { title: '自己出的題', subject: null, institution: null, term: null, language: null }, questions: [{ ...question(), locations: [] } as never] })
    expect(exam.title).toBe('自己出的題')
    expect(await importer.originals(imp.id)).toEqual([])
    // in the bank it stays editable; once the exam is gone it deletes cleanly
    await importer.remove(imp.id)
    expect(await bank.getDraft(imp.id)).not.toBeNull()
    await bank.deleteExam(exam.id)
    await importer.remove(imp.id)
    expect(await bank.getImport(imp.id)).toBeNull()
  })

  it('opens an exam that lost its upload in a new draft saved back to it', async () => {
    const exam = await bank.createExam('local', { meta: { title: '分享來的考卷', subject: '英文' }, groups: [], questions: [question() as never] })
    const imp = await importer.editExam(exam, [{ ...question(), locations: [] } as never])
    expect(imp).toMatchObject({ provider: BLANK, pageCount: 0, status: 'saved' })
    expect((await bank.getDraft(imp.id))?.meta.title).toBe('分享來的考卷')
    expect((await bank.examForImport(imp.id))?.id).toBe(exam.id)
    const saved = await importer.publish(imp.id, { ...(await bank.getDraft(imp.id))!, questions: [] })
    expect(saved.id).toBe(exam.id)
  })

  it('deletes an import never saved to the bank with everything in it', async () => {
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'p1.png', data: await png() }], provider: 'fake' })
    await importer.settled(imp.id)
    await importer.remove(imp.id)
    expect(await bank.getImport(imp.id)).toBeNull()
    expect(existsSync(join(dataDir, importer.pageImage(imp, 1)))).toBe(false)
  })
})

describe('a server restart', () => {
  it('marks readings that were cut off as failed, and leaves the rest alone', async () => {
    const cut = await bank.createImport({ ownerId: 'local', fileName: 'a.pdf', pageCount: 1, provider: 'fake', model: null })
    await bank.updateImport(cut.id, { status: 'processing', progress: { done: 1, total: 1 } })
    const blank = await importer.createBlank('local')
    expect(await importer.recoverInterrupted()).toBe(1)
    expect(await bank.getImport(cut.id)).toMatchObject({ status: 'failed', error: INTERRUPTED })
    expect((await bank.getImport(blank.id))?.status).toBe('review')
  })

  it('puts the questions together again from pages already read, without the model', async () => {
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'p1.png', data: await png() }], provider: 'fake' })
    await importer.settled(imp.id)
    // As if the server stopped after reading but before the draft was saved.
    await bank.updateImport(imp.id, { status: 'failed', error: INTERRUPTED })
    const calls: string[] = []
    registerProvider('fake', () => ({ id: 'fake', model: 'fake-1', complete: async () => (calls.push('read'), Promise.reject(new Error('should not read'))) }))
    try {
      expect(await importer.resume(imp.id)).toBe(true)
      await importer.settled(imp.id)
      expect(await bank.getImport(imp.id)).toMatchObject({ status: 'review', error: null })
      expect(calls).toEqual([])
      // Only once per import, so a step that keeps failing is not retried forever.
      await bank.updateImport(imp.id, { status: 'failed', error: INTERRUPTED })
      expect(await importer.resume(imp.id)).toBe(false)
    } finally {
      registerProvider('fake', () => ({ id: 'fake', model: 'fake-1', complete: async () => ({ text: JSON.stringify(page([question()])), model: 'fake-1', usage: { inputTokens: 10, outputTokens: 5 } }) }))
    }
  })

  it('marks a reading with no run going and unread pages as interrupted', async () => {
    const cut = await bank.createImport({ ownerId: 'local', fileName: 'a.pdf', pageCount: 2, provider: 'fake', model: null })
    await bank.updateImport(cut.id, { status: 'processing', progress: { done: 2, total: 2 } })
    expect(importer.isRunning(cut.id)).toBe(false)
    expect(await importer.resume(cut.id)).toBe(false)
    expect(await bank.getImport(cut.id)).toMatchObject({ status: 'failed', error: INTERRUPTED })
  })
})

describe('page order', () => {
  // each page tells by its width which question numbers are printed on it
  const printed: Record<number, string[]> = { 200: ['11', '12'], 210: ['1', '2'], 220: ['21'] }
  registerProvider('numbered', () => ({
    id: 'numbered',
    model: 'numbered-1',
    complete: async ({ page: p }) => ({ text: JSON.stringify(page((printed[p.width] ?? ['99']).map((number) => question({ number })))), model: 'numbered-1', usage: { inputTokens: 1, outputTokens: 1 } }),
  }))
  const sized = (width: number) => sharp({ create: { width, height: 300, channels: 3, background: '#fff' } }).png().toBuffer()
  const widths = async (imp: Parameters<Importer['pageImage']>[0], count: number) =>
    Promise.all(Array.from({ length: count }, async (_, i) => (await sharp(await readFile(join(dataDir, importer.pageImage(imp, i + 1)))).metadata()).width))
  const upload = async (sizes: number[]) => {
    const imp = await importer.create({ ownerId: 'local', files: await Promise.all(sizes.map(async (w, i) => ({ name: `p${i + 1}.png`, data: await sized(w) }))), provider: 'numbered' })
    await importer.settled(imp.id)
    return (await bank.getImport(imp.id))!
  }

  it('puts photos uploaded in any order in the order their question numbers run', async () => {
    const imp = await upload([200, 210, 220])
    expect(await widths(imp, 3)).toEqual([210, 200, 220])
    const draft = (await bank.getDraft(imp.id))!
    expect(draft.questions.map((q) => [q.number, q.locations[0]!.pageNumber])).toEqual([['1', 1], ['2', 1], ['11', 2], ['12', 2], ['21', 3]])
    expect((await importer.pageResults(imp.id)).map((r) => r.page!.questions[0]!.number)).toEqual(['1', '11', '21'])

    // reading again renders the upload in the same order
    await importer.rerun(imp.id)
    await importer.settled(imp.id)
    expect(await widths(imp, 3)).toEqual([210, 200, 220])
    expect((await bank.getDraft(imp.id))!.questions.map((q) => q.number)).toEqual(['1', '2', '11', '12', '21'])
  })

  it('moves pages by hand, with the questions and the readings following', async () => {
    const imp = await upload([210, 220])
    const draft = (await bank.getDraft(imp.id))!
    await importer.saveDraft(imp.id, { ...draft, questions: draft.questions.map((q) => ({ ...q, stem: `edited ${q.number}` })) })
    const moved = (await importer.reorderPages(imp.id, [2, 1]))!
    expect(moved.questions.map((q) => [q.number, q.stem, q.locations[0]!.pageNumber])).toEqual([['21', 'edited 21', 1], ['1', 'edited 1', 2], ['2', 'edited 2', 2]])
    expect(await widths(imp, 2)).toEqual([220, 210])
    expect((await importer.pageResults(imp.id)).map((r) => [r.pageNumber, r.page!.questions[0]!.number])).toEqual([[1, '21'], [2, '1']])
    await expect(importer.reorderPages(imp.id, [1, 1])).rejects.toThrow()
  })

  it('adds files after the last page and reads only them, keeping the edits', async () => {
    const imp = await upload([210])
    const draft = (await bank.getDraft(imp.id))!
    await importer.saveDraft(imp.id, { ...draft, questions: draft.questions.map((q) => ({ ...q, stem: 'edited' })) })
    expect(await importer.addPages(imp.id, [{ name: 'more.png', data: await sized(200) }])).toEqual([2])
    await importer.settled(imp.id)
    const after = (await bank.getImport(imp.id))!
    expect(after.pageCount).toBe(2)
    expect((await importer.originals(imp.id)).map((f) => f.name)).toEqual(['p1.png', 'more.png'])
    expect((await bank.getDraft(imp.id))!.questions.map((q) => [q.number, q.stem])).toEqual([['1', 'edited'], ['2', 'edited'], ['11', question().stem], ['12', question().stem]])
  })

  it('puts an added page where its question numbers belong', async () => {
    const imp = await upload([200])
    await importer.addPages(imp.id, [{ name: 'first.png', data: await sized(210) }])
    await importer.settled(imp.id)
    expect(await widths(imp, 2)).toEqual([210, 200])
    expect((await bank.getDraft(imp.id))!.questions.map((q) => [q.number, q.locations[0]!.pageNumber])).toEqual([['1', 1], ['2', 1], ['11', 2], ['12', 2]])
  })
})
