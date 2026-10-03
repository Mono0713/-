import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteBank } from '@exam/bank'
import { LocalFileStore } from '@exam/files'
import { registerProvider } from '@exam/extraction'
import { AUTO, Importer, type ReadingPlan } from '../src/index.ts'
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

  it('keeps figure images of saved questions when the import is deleted', async () => {
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'p1.png', data: await png() }], provider: 'fake' })
    await importer.settled(imp.id)
    const figure = await importer.recropFigure(imp.id, { description: 'd', pageNumber: 1, bbox: { x: 0, y: 0, width: 1, height: 1 }, blanks: [], image: null })
    await importer.publish(imp.id, (await bank.getDraft(imp.id))!)
    await importer.remove(imp.id)
    expect(await bank.getImport(imp.id)).toBeNull()
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
