import { existsSync } from 'node:fs'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PageImage } from '@exam/core'
import { createProvider, extractJson, extractPage, ManualProvider } from '../src/index.ts'
import { page, question } from '../../core/test/fixtures.ts'

const image: PageImage = { pageNumber: 2, mimeType: 'image/png', data: Buffer.from('png'), width: 1, height: 1, textLayer: null }

describe('manual provider', () => {
  it('writes the prompt and waits when no reply is saved yet', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'manual-'))
    const provider = createProvider('manual', { workDir })
    const result = await extractPage(provider, image, 'quiz.pdf')
    expect(result.page).toBeNull()
    expect(result.error).toMatch(/^waiting for a reply/)
    const prompt = await readFile(join(workDir, 'page-2.prompt.md'), 'utf8')
    expect(prompt).toContain('Extract every question on this page.')
    expect(prompt).toContain('type Page = {')
    expect(prompt).toContain('type Box = {')
    expect(prompt).not.toContain('additionalProperties')
  })

  it('validates a pasted reply, even inside a code fence', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'manual-'))
    await writeFile(join(workDir, 'page-2.reply.json'), 'Here you go:\n```json\n' + JSON.stringify(page([question()])) + '\n```')
    const provider = createProvider('manual', { workDir, model: 'claude-web' })
    const result = await extractPage(provider, image, 'quiz.pdf')
    expect(result.error).toBeNull()
    expect(result.model).toBe('claude-web')
    expect(result.page?.questions).toHaveLength(1)
    expect(existsSync(join(workDir, 'page-2.prompt.md'))).toBe(false)
  })

  it('needs a work folder', () => {
    expect(() => createProvider('manual')).toThrow(/workDir/)
  })
})

describe('extractJson', () => {
  it('returns null when there is no object', () => {
    expect(extractJson('sorry, I cannot read this')).toBeNull()
  })
})

describe('manual provider batches', () => {
  const pageImage = (n: number, textLayer: string | null = null): PageImage => ({ ...image, pageNumber: n, textLayer })

  it('writes one prompt for every waiting page', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'manual-'))
    const provider = new ManualProvider({ workDir })
    await extractPage(provider, pageImage(2), 'quiz.pdf')
    await extractPage(provider, pageImage(1, 'Rosalind Franklin'), 'quiz.pdf')
    expect(await provider.writeBatchPrompt()).toEqual([1, 2])
    const prompt = await readFile(join(workDir, 'batch.prompt.md'), 'utf8')
    expect(prompt).toContain('attached in this order: page 1, page 2')
    expect(prompt).toContain('Embedded PDF text layer of page 1')
    expect(prompt).toContain('{ "pages": [{ "pageNumber": 1, "result": Page }, ...] }')
  })

  it('skips the batch prompt for a single page', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'manual-'))
    const provider = new ManualProvider({ workDir })
    await extractPage(provider, pageImage(1), 'quiz.pdf')
    expect(await provider.writeBatchPrompt()).toEqual([])
    expect(existsSync(join(workDir, 'batch.prompt.md'))).toBe(false)
  })

  it('reads each page from batch.reply.json', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'manual-'))
    const reply = { pages: [{ pageNumber: 1, result: page([question()]) }, { pageNumber: 2, result: page([question(), question({ number: '2' })]) }] }
    await writeFile(join(workDir, 'batch.reply.json'), '```json\n' + JSON.stringify(reply) + '\n```')
    const provider = new ManualProvider({ workDir })
    const [one, two, three] = await Promise.all([1, 2, 3].map((n) => extractPage(provider, pageImage(n), 'quiz.pdf')))
    expect(one!.page?.questions).toHaveLength(1)
    expect(two!.page?.questions).toHaveLength(2)
    expect(three!.error).toMatch(/^waiting for a reply/)
  })

  it('reports a batch reply that is not JSON', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'manual-'))
    await writeFile(join(workDir, 'batch.reply.json'), '{ pages: [ oops')
    const result = await extractPage(new ManualProvider({ workDir }), pageImage(1), 'quiz.pdf')
    expect(result.error).toMatch(/not valid JSON/)
  })
})
