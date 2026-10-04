import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { testDatabase } from '@exam/db'
import { FileSettingsStore, PostgresSettingsStore, publicView } from '../src/index.ts'

const tempFile = () => join(mkdtempSync(join(tmpdir(), 'settings-')), 'settings.json')

describe('FileSettingsStore', () => {
  it('returns defaults for a new user', async () => {
    const s = await new FileSettingsStore(tempFile()).get('a')
    expect(s).toMatchObject({ locale: null, defaultProvider: 'auto', models: {}, apiKeys: {}, aiGrading: { enabled: true, provider: null, model: null } })
  })

  it('saves per user and keeps other fields on update', async () => {
    const file = tempFile()
    const store = new FileSettingsStore(file)
    await store.update('a', { locale: 'en' })
    await store.update('a', { models: { claude: 'm1' } })
    await store.update('b', { locale: 'ja' })
    const again = new FileSettingsStore(file)
    expect(await again.get('a')).toMatchObject({ locale: 'en', models: { claude: 'm1' } })
    expect((await again.get('b')).locale).toBe('ja')
  })

  it('keeps the file private to the owner of the process', async () => {
    const file = tempFile()
    await new FileSettingsStore(file).update('a', { apiKeys: { claude: 'sk-secret-1234' } })
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(JSON.parse(readFileSync(file, 'utf8')).a.apiKeys.claude).toBe('sk-secret-1234')
  })

  it('falls back to defaults when the file is damaged', async () => {
    const file = tempFile()
    writeFileSync(file, '{ not json')
    expect((await new FileSettingsStore(file).get('a')).defaultProvider).toBe('auto')
  })
})

describe('publicView', () => {
  it('never exposes a key, only that it is saved and its last characters', async () => {
    const view = publicView(await new FileSettingsStore(tempFile()).update('a', { apiKeys: { claude: 'sk-ant-abcdefgh1234', openai: 'short' } }))
    expect(view.apiKeys).toEqual({ claude: { saved: true, hint: '1234' }, openai: { saved: true, hint: null } })
    expect(JSON.stringify(view)).not.toContain('abcdefgh')
  })
})

const pg = await testDatabase()
afterAll(() => pg?.drop())

describe.skipIf(!pg)('PostgresSettingsStore', () => {
  it('saves per user and stores API keys encrypted', async () => {
    const store = new PostgresSettingsStore(pg!.sql, 'a-test-secret-of-some-length')
    expect(await store.get('a')).toMatchObject({ locale: null, apiKeys: {} })
    await store.update('a', { locale: 'en', apiKeys: { claude: 'sk-ant-secret-1234' } })
    await store.update('a', { models: { claude: 'm1' } })
    await store.update('b', { locale: 'ja' })
    expect(await store.get('a')).toMatchObject({ locale: 'en', models: { claude: 'm1' }, apiKeys: { claude: 'sk-ant-secret-1234' } })
    expect((await store.get('b')).locale).toBe('ja')

    const [row] = await pg!.sql`select settings, api_keys from user_settings where owner_id = 'a'`
    expect(JSON.stringify(row)).not.toContain('sk-ant-secret')
    // Another secret cannot read the keys; the rest of the settings still load.
    expect(await new PostgresSettingsStore(pg!.sql, 'a-different-secret-entirely').get('a')).toMatchObject({ locale: 'en', apiKeys: {} })
  })
})
