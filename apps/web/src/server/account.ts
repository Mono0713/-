import './env'
import { accountFileKeys, eraseAccount, exportAccount } from '@exam/db'
import { currentUser } from './auth'
import { services } from './context'

/**
 * The person's own controls over their whole account (privacy law's rights to a copy and to
 * deletion). Only with accounts and Postgres: the local version keeps everything on the
 * person's own computer already.
 */
export const accountControls = (): boolean => Boolean(services().sql && process.env.NEXT_PUBLIC_SUPABASE_URL)

/** Everything stored for the signed-in person, as one JSON document. */
export async function accountExport(): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const user = await currentUser()
  const { sql } = services()
  if (!user || !sql) return null
  const rows = await exportAccount(sql, user.id)
  return { id: user.id, data: { exportedAt: new Date().toISOString(), account: { id: user.id, email: user.email, name: user.name }, ...rows } }
}

/**
 * Deletes the signed-in person: their files, every row, then the sign-in account itself when the
 * server holds Supabase's service key (without it a later sign-in starts an empty account).
 */
export async function deleteAccount(): Promise<boolean> {
  const user = await currentUser()
  const { sql, files } = services()
  if (!user || !sql) return false
  await files.remove(await accountFileKeys(sql, user.id))
  await eraseAccount(sql, user.id)
  await deleteSignIn(user.id)
  return true
}

async function deleteSignIn(id: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  const res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!res.ok && res.status !== 404) console.error('Deleting the sign-in account failed:', res.status, await res.text().catch(() => ''))
}
