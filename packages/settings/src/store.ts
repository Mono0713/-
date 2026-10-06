import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { defaultSettings, Settings } from './settings.ts'

/** Where settings live: a local JSON file, or Postgres (PostgresSettingsStore) when hosted. */
export interface SettingsStore {
  get(ownerId: string): Promise<Settings>
  update(ownerId: string, patch: Partial<Settings>): Promise<Settings>
  /** Forgets everything saved for the person, API keys included (deleting the account). */
  remove(ownerId: string): Promise<void>
}

/**
 * Settings of every user in one JSON file, readable only by the account running the app
 * (it holds API keys). Written to a temporary file first so a crash never leaves half a file.
 */
export class FileSettingsStore implements SettingsStore {
  constructor(private readonly file: string) {}

  async get(ownerId: string): Promise<Settings> {
    const saved = this.readAll()[ownerId]
    const parsed = Settings.safeParse(saved ?? {})
    return parsed.success ? parsed.data : defaultSettings()
  }

  async update(ownerId: string, patch: Partial<Settings>): Promise<Settings> {
    const all = this.readAll()
    const next = Settings.parse({ ...(await this.get(ownerId)), ...patch })
    all[ownerId] = next
    this.writeAll(all)
    return next
  }

  async remove(ownerId: string): Promise<void> {
    const all = this.readAll()
    if (!(ownerId in all)) return
    delete all[ownerId]
    this.writeAll(all)
  }

  private writeAll(all: Record<string, unknown>) {
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(all, null, 2), { mode: 0o600 })
    renameSync(tmp, this.file)
    chmodSync(this.file, 0o600)
  }

  private readAll(): Record<string, unknown> {
    if (!existsSync(this.file)) return {}
    try {
      const data = JSON.parse(readFileSync(this.file, 'utf8'))
      return data && typeof data === 'object' ? data : {}
    } catch {
      return {}
    }
  }
}
