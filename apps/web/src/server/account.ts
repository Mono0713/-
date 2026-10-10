import './env'
import { accountFileKeys, eraseAccount, exportAccount } from '@exam/db'
import { authEnabled, currentUser } from './auth'
import { keyPrefixOf, services } from './context'

/**
 * The person's own controls over their whole account (privacy law's rights to a copy and to
 * deletion), with the local database or Postgres alike. Only with sign-in: without it the
 * single local user's data is already on their own computer.
 */
export const accountControls = (): boolean => authEnabled()

/** Everything stored for the signed-in person, as one JSON document. */
export async function accountExport(): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const user = await currentUser()
  if (!user) return null
  const { accounts, settings } = services()
  // saved API keys never leave the server, not even to their owner
  const { apiKeys: _keys, ...saved } = await settings.get(user.id)
  const rows = await exportAccount(accounts, user.id)
  return { id: user.id, data: { exportedAt: new Date().toISOString(), account: { id: user.id, email: user.email, name: user.name }, settings: saved, ...rows } }
}

/**
 * Deletes the signed-in person: their files, every row, then the sign-in account itself when the
 * server holds Supabase's service key (without it a later sign-in starts an empty account).
 */
export async function deleteAccount(): Promise<boolean> {
  const user = await currentUser()
  if (!user) return false
  const prefix = keyPrefixOf(user.id)
  if (!prefix) return false
  const { accounts, files, settings } = services()
  // files from before deduplication are only found by their "u/<id>/" start
  const keys = new Set([...(await accountFileKeys(accounts, user.id)), ...(await files.list(prefix))])
  await files.remove([...keys])
  await eraseAccount(accounts, user.id)
  await settings.remove(user.id)
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
