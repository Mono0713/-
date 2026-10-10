import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { repoRoot } from './env'
import { PostgresBank, SqliteBank, type Bank } from '@exam/bank'
import { PostgresClassStore, SqliteClassStore, type ClassStore } from '@exam/classes'
import { connect, postgresAccountDb, sqliteAccountDb, type AccountDb } from '@exam/db'
import { DedupFileStore, fileStoreFromEnv, PostgresFileIndex, SqliteFileIndex, type FileIndex } from '@exam/files'
import { Importer } from '@exam/importer'
import { PostgresGradingCache, PostgresTranslationCache, SqliteGradingCache, SqliteTranslationCache, type GradingCache, type TranslationCache } from '@exam/grading'
import { PostgresQuizStore, SqliteQuizStore, type QuizStore } from '@exam/quiz'
import { DEFAULT_LOCALE, FileSettingsStore, keysOf, PostgresSettingsStore, type SettingsStore } from '@exam/settings'
import { PostgresShareStore, SqliteShareStore, type ShareStore } from '@exam/sharing'
import { PostgresUsageStore, SqliteUsageStore, type UsageStore } from '@exam/usage'
import { routeFor, serviceUrlOf } from './ai'
import { authEnabled } from './auth'

export { currentOwner, currentUser, authEnabled } from './auth'

/**
 * The one place the web app wires its modules together. Each part is picked from the
 * environment on its own (see docs/HOSTING.md):
 *   DATABASE_URL                  Postgres (Supabase) instead of data/bank.sqlite
 *   R2_*                          Cloudflare R2 instead of the data folder for files
 *   NEXT_PUBLIC_SUPABASE_*        Google sign-in instead of one local user
 * Which AI model each task uses lives in ./ai.ts; storage limits in ./storage.ts.
 */

export const dataDir = resolve(process.env.EXAM_DATA_DIR ?? join(repoRoot, 'data'))

interface Services {
  bank: Bank
  importer: Importer
  quizzes: QuizStore
  settings: SettingsStore
  gradingCache: GradingCache
  /** Translated questions, shared by everyone who reads them in the same language. */
  translationCache: TranslationCache
  usage: UsageStore
  shares: ShareStore
  classes: ClassStore
  /** Each distinct file is kept once, whatever key it is written under. */
  files: DedupFileStore
  /** The database seen as whole accounts, for 下載我的資料 and 刪除帳號. */
  accounts: AccountDb
}

// Kept on globalThis so hot reloads in development reuse one database connection
// and background extraction runs keep going.
const globals = globalThis as typeof globalThis & { __examServices?: Services }

export function services(): Services {
  if (!globals.__examServices) {
    mkdirSync(dataDir, { recursive: true })
    const stores = process.env.DATABASE_URL ? postgresStores(process.env.DATABASE_URL) : sqliteStores()
    const { fileIndex, ...rest } = stores
    const files = new DedupFileStore(fileStoreFromEnv(dataDir), fileIndex)
    globals.__examServices = {
      ...rest,
      files,
      importer: new Importer({
        bank: stores.bank,
        files,
        // With accounts, every file key starts with its owner, so a link can be checked against the person asking.
        keyPrefix: authEnabled() ? keyPrefixOf : undefined,
        reviewLanguage: localeOf,
        providerConfig: async (providerId, ownerId) => {
          const s = await stores.settings.get(ownerId)
          const custom = s.customProviders.find((c) => c.id === providerId)
          return { apiKeys: keysOf(s.apiKeys, providerId), model: s.models[providerId] || custom?.models[0]?.id, baseUrl: await serviceUrlOf(s, providerId) }
        },
        plan: async (ownerId) => {
          const r = await routeFor(ownerId, 'recognition')
          return r && { primary: r.primary, fallbacks: r.fallbacks, escalate: r.escalate }
        },
        onPage: (imp, r) =>
          void stores.usage.record({ ownerId: imp.ownerId, task: 'recognition', provider: r.provider, model: r.model, inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens }).catch(() => {}),
      }),
    }
    const { importer } = globals.__examServices
    void importer.recoverInterrupted().catch((err) => console.error('Marking interrupted imports failed:', err))
    sweepOriginals(importer)
  }
  return globals.__examServices
}

// How often uploaded files past their 30 days are looked for.
const SWEEP_EVERY = 6 * 3_600_000

/** Deletes expired uploaded files now and then while the server runs. */
function sweepOriginals(importer: Importer) {
  const sweep = () => void importer.expireOriginals().catch((err) => console.error('Deleting expired uploads failed:', err))
  setTimeout(sweep, 10_000).unref()
  setInterval(sweep, SWEEP_EVERY).unref()
}

/** Start of every file key of an owner when there are accounts, so a file link can be checked against the person asking. */
export function keyPrefixOf(ownerId: string): string {
  return authEnabled() ? `u/${ownerId}/` : ''
}

type Stores = Pick<Services, 'bank' | 'quizzes' | 'settings' | 'gradingCache' | 'translationCache' | 'usage' | 'shares' | 'classes' | 'accounts'> & { fileIndex: FileIndex }

function sqliteStores(): Stores {
  const dbFile = join(dataDir, 'bank.sqlite')
  return {
    bank: new SqliteBank(dbFile),
    quizzes: new SqliteQuizStore(dbFile),
    settings: new FileSettingsStore(join(dataDir, 'settings.json')),
    gradingCache: new SqliteGradingCache(dbFile),
    translationCache: new SqliteTranslationCache(dbFile),
    usage: new SqliteUsageStore(dbFile),
    shares: new SqliteShareStore(dbFile),
    classes: new SqliteClassStore(dbFile),
    fileIndex: new SqliteFileIndex(dbFile),
    accounts: sqliteAccountDb(dbFile),
  }
}

function postgresStores(url: string): Stores {
  const secret = process.env.SETTINGS_SECRET
  if (!secret) throw new Error('SETTINGS_SECRET is required with DATABASE_URL: it encrypts the API keys people save.')
  const sql = connect(url)
  return { bank: new PostgresBank(sql), quizzes: new PostgresQuizStore(sql), settings: new PostgresSettingsStore(sql, secret), gradingCache: new PostgresGradingCache(sql), translationCache: new PostgresTranslationCache(sql), usage: new PostgresUsageStore(sql), shares: new PostgresShareStore(sql), classes: new PostgresClassStore(sql), fileIndex: new PostgresFileIndex(sql), accounts: postgresAccountDb(sql) }
}

/**
 * Interface language of a user, as a language tag: their choice on the settings page,
 * else EXAM_LOCALE, else zh-Hant. The model writes its review notes (⚠ issues) in this language.
 */
export async function localeOf(ownerId: string): Promise<string> {
  return (await services().settings.get(ownerId)).locale ?? (process.env.EXAM_LOCALE || DEFAULT_LOCALE)
}

