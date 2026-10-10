import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteBank } from '@exam/bank'
import { LocalFileStore } from '@exam/files'
import { registerProvider } from '@exam/extraction'
import { Importer } from '../src/index.ts'
import { page, question } from '../../core/test/fixtures.ts'

registerProvider('fake-crop', () => ({
  id: 'fake-crop',
  model: 'fake-1',
  complete: async () => ({ text: JSON.stringify(page([question()])), model: 'fake-1', usage: { inputTokens: 10, outputTokens: 5 } }),
}))

let dataDir: string
let bank: SqliteBank
let importer: Importer

/** A white sheet lying on a dark desk, smaller than the photo. */
const photo = async () => {
  const sheet = await sharp({ create: { width: 400, height: 560, channels: 3, background: '#f5f5f2' } }).png().toBuffer()
  return sharp({ create: { width: 700, height: 900, channels: 3, background: '#2c3442' } }).composite([{ input: sheet, left: 150, top: 170 }]).png().toBuffer()
}

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'crops-'))
  bank = new SqliteBank(':memory:')
  importer = new Importer({ bank, files: new LocalFileStore(dataDir) })
})
afterEach(async () => {
  await bank.close()
  await rm(dataDir, { recursive: true, force: true })
})

describe('page crops', () => {
  it('cuts a photographed sheet out when it is uploaded and keeps the photo', async () => {
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'photo.jpg', data: await photo() }], provider: 'fake-crop' })
    await importer.settled(imp.id)
    const crops = await importer.crops.read(imp)
    expect(crops[1]).toBeTruthy()
    const shown = await sharp((await importer.files.read(importer.pageImage(imp, 1)))!).metadata()
    expect(shown.width).toBeGreaterThan(380)
    expect(shown.width).toBeLessThan(420)
    expect(await importer.files.read(importer.crops.rawKey(imp, 1))).toBeTruthy()
  })

  it('cuts a page again and moves the page readings with it', async () => {
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'photo.jpg', data: await photo() }], provider: 'fake-crop' })
    await importer.settled(imp.id)
    const before = (await importer.pageResults(imp.id))[0]!.page!.questions[0]!.bbox
    const quad = (await importer.crops.read(imp))[1]!
    // back to the whole photo: the reading's box shrinks into the sheet's part of it
    expect(await importer.crops.set(imp, 1, null)).toEqual(quad)
    expect((await importer.crops.read(imp))[1]).toBeNull()
    const after = (await importer.pageResults(imp.id))[0]!.page!.questions[0]!.bbox
    expect(after.width).toBeLessThan(before.width)
    const shown = await sharp((await importer.files.read(importer.pageImage(imp, 1)))!).metadata()
    expect(shown.width).toBe(700)
  })

  it('exports the pages as a PDF', async () => {
    const imp = await importer.create({ ownerId: 'local', files: [{ name: 'photo.jpg', data: await photo() }], provider: 'fake-crop' })
    await importer.settled(imp.id)
    expect((await importer.pagesPdf(imp.id)).subarray(0, 8).toString('latin1')).toBe('%PDF-1.4')
  })
})
