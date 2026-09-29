import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FileSettingsStore, publicView } from '../src/index.ts'

const tempFile = () => join(mkdtempSync(join(tmpdir(), 'settings-')), 'settings.json')

describe('FileSettingsStore', () => {
  it('returns defaults for a new user', () => {
    const s = new FileSettingsStore(tempFile()).get('a')
    expect(s).toMatchObject({ locale: null, defaultProvider: 'manual', models: {}, apiKeys: {} })
  })

  it('saves per user and keeps other fields on update', () => {
    const file = tempFile()
    const store = new FileSettingsStore(file)
    store.update('a', { locale: 'en' })
    store.update('a', { models: { claude: 'm1' } })
    store.update('b', { locale: 'ja' })
    const again = new FileSettingsStore(file)
    expect(again.get('a')).toMatchObject({ locale: 'en', models: { claude: 'm1' } })
    expect(again.get('b').locale).toBe('ja')
  })

  it('keeps the file private to the owner of the process', () => {
    const file = tempFile()
    new FileSettingsStore(file).update('a', { apiKeys: { claude: 'sk-secret-1234' } })
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(JSON.parse(readFileSync(file, 'utf8')).a.apiKeys.claude).toBe('sk-secret-1234')
  })

  it('falls back to defaults when the file is damaged', () => {
    const file = tempFile()
    writeFileSync(file, '{ not json')
    expect(new FileSettingsStore(file).get('a').defaultProvider).toBe('manual')
  })
})

describe('publicView', () => {
  it('never exposes a key, only that it is saved and its last characters', () => {
    const view = publicView(new FileSettingsStore(tempFile()).update('a', { apiKeys: { claude: 'sk-ant-abcdefgh1234', openai: 'short' } }))
    expect(view.apiKeys).toEqual({ claude: { saved: true, hint: '1234' }, openai: { saved: true, hint: null } })
    expect(JSON.stringify(view)).not.toContain('abcdefgh')
  })
})
