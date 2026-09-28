import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteBank } from '@exam/bank'
import { registerProvider } from '@exam/extraction'
import { Importer } from '../src/index.ts'
import { page, question } from '../../core/test/fixtures.ts'

let dataDir: string
let bank: SqliteBank
let importer: Importer

registerProvider('fake', () => ({
  id: 'fake',
  model: 'fake-1',
  complete: async () => ({ text: JSON.stringify(page([question()])), model: 'fake-1', usage: { inputTokens: 10, outputTokens: 5 } }),
}))

const png = () => sharp({ create: { width: 200, height: 300, channels: 3, background: '#fff' } }).png().toBuffer()

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'importer-'))
  bank = new SqliteBank(':memory:')
  importer = new Importer({ bank, dataDir })
})
afterEach(async () => {
  bank.close()
  await rm(dataDir, { recursive: true, force: true })
})

describe('Importer', () => {
  it('turns several photos into one draft ready for review, then into bank questions', async () => {
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'p1.png', data: await png() }, { name: 'p2.png', data: await png() }], provider: 'fake' })
    expect(imp.pageCount).toBe(2)
    await importer.settled(imp.id)

    expect(bank.getImport(imp.id)).toMatchObject({ status: 'review', progress: { done: 2, total: 2 } })
    const draft = bank.getDraft(imp.id)!
    expect(draft.questions).toHaveLength(2)
    expect(draft.questions[0]!.locations[0]!.pageNumber).toBe(1)

    importer.publish(imp.id, draft)
    expect(bank.getImport(imp.id)).toMatchObject({ status: 'saved', questionCount: 2 })
  })

  it('waits for pasted chat replies in manual mode', async () => {
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'a.png', data: await png() }, { name: 'b.png', data: await png() }], provider: 'manual' })
    await importer.settled(imp.id)
    expect(bank.getImport(imp.id)?.status).toBe('waiting')

    const state = await importer.manualState(imp.id)
    expect(state.pages.map((p) => [p.pageNumber, p.done, Boolean(p.prompt)])).toEqual([[1, false, true], [2, false, true]])
    expect(state.batch?.pages).toEqual([1, 2])
    expect(state.pages[0]!.image).toBe(`imports/${imp.id}/pages/page-1.png`)
    await expect(readFile(join(dataDir, state.pages[0]!.image))).resolves.toBeInstanceOf(Buffer)

    await importer.submitManualReply(imp.id, 1, '```json\n' + JSON.stringify(page([question()])) + '\n```')
    await importer.settled(imp.id)
    expect(bank.getImport(imp.id)?.status).toBe('waiting')
    expect((await importer.manualState(imp.id)).pages.map((p) => p.done)).toEqual([true, false])

    await importer.submitManualReply(imp.id, 'batch', JSON.stringify({ pages: [{ pageNumber: 2, result: page([question({ number: '2' })]) }] }))
    await importer.settled(imp.id)
    expect(bank.getImport(imp.id)?.status).toBe('review')
    expect(bank.getDraft(imp.id)!.questions.map((q) => q.number)).toEqual(['1', '2'])
  })

  it('marks an import failed when no page can be read', async () => {
    registerProvider('broken', () => ({ id: 'broken', model: 'x', complete: async () => ({ text: 'not json', model: 'x', usage: { inputTokens: null, outputTokens: null } }) }))
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'a.png', data: await png() }], provider: 'broken' })
    await importer.settled(imp.id)
    expect(bank.getImport(imp.id)).toMatchObject({ status: 'failed' })
    expect(bank.getImport(imp.id)?.error).toBeTruthy()
  })
})
