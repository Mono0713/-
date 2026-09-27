import { existsSync } from 'node:fs'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PageImage } from '@exam/core'
import { createProvider, extractJson, extractPage } from '../src/index.ts'
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
    expect(prompt).toContain('"additionalProperties":false')
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
