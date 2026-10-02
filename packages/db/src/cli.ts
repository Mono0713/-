import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { connect, migrate, MIGRATIONS_DIR } from './index.ts'

// `pnpm db:migrate`: applies supabase/migrations to DATABASE_URL (from the environment or the repo-root .env).
const envFile = join(MIGRATIONS_DIR, '../../.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)
const url = process.env.DATABASE_URL
if (!url) {
  console.error('Set DATABASE_URL (Supabase: Project Settings → Database → Connection string) in .env first.')
  process.exit(1)
}
const sql = connect(url, { max: 1 })
try {
  const applied = await migrate(sql)
  console.log(applied.length ? `Applied ${applied.join(', ')}` : 'The database is up to date.')
} finally {
  await sql.end()
}
