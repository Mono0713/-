import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { Sql } from '@exam/db'
import { defaultSettings, Settings } from './settings.ts'
import type { SettingsStore } from './store.ts'

/**
 * Settings in Postgres (Supabase). API keys are encrypted with AES-256-GCM before they
 * reach the database, so a leaked backup or a wrong table policy does not leak them.
 * `secret` (SETTINGS_SECRET) must stay the same, or saved keys can no longer be read.
 */
export class PostgresSettingsStore implements SettingsStore {
  private readonly key: Buffer

  constructor(
    private readonly sql: Sql,
    secret: string,
  ) {
    if (secret.length < 16) throw new Error('SETTINGS_SECRET must be at least 16 characters')
    this.key = createHash('sha256').update(secret).digest()
  }

  async get(ownerId: string): Promise<Settings> {
    const [row] = await this.sql`select settings, api_keys from user_settings where owner_id = ${ownerId}`
    if (!row) return defaultSettings()
    const apiKeys = row.api_keys ? this.open(String(row.api_keys)) : {}
    const parsed = Settings.safeParse({ ...(row.settings as object), apiKeys })
    return parsed.success ? parsed.data : defaultSettings()
  }

  async remove(ownerId: string): Promise<void> {
    await this.sql`delete from user_settings where owner_id = ${ownerId}`
  }

  async update(ownerId: string, patch: Partial<Settings>): Promise<Settings> {
    const next = Settings.parse({ ...(await this.get(ownerId)), ...patch })
    const { apiKeys, ...rest } = next
    const sealed = Object.keys(apiKeys).length ? this.seal(apiKeys) : null
    await this.sql`insert into user_settings (owner_id, settings, api_keys) values (${ownerId}, ${this.sql.json(rest as never)}, ${sealed})
      on conflict (owner_id) do update set settings = excluded.settings, api_keys = excluded.api_keys, updated_at = now()`
    return next
  }

  /** iv, tag and ciphertext, base64, joined by dots. */
  private seal(keys: Record<string, string>): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const data = Buffer.concat([cipher.update(JSON.stringify(keys), 'utf8'), cipher.final()])
    return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.')
  }

  private open(text: string): Record<string, string> {
    const [iv, tag, data] = text.split('.').map((part) => Buffer.from(part, 'base64'))
    if (!iv || !tag || !data) return {}
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv)
      decipher.setAuthTag(tag)
      return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')) as Record<string, string>
    } catch {
      // Encrypted with another secret: the keys are unreadable, so the person enters them again.
      return {}
    }
  }
}
