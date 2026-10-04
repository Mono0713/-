import { authEnabled } from './auth'
import { services } from './context'

/**
 * Most an account may keep, in bytes: STORAGE_QUOTA_MB (1 GB by default). Only with accounts;
 * the single local user keeps what fits on the computer.
 */
export function storageQuota(): number | null {
  if (!authEnabled()) return null
  return (Number(process.env.STORAGE_QUOTA_MB) || 1024) * 1024 * 1024
}

/** What an account keeps, and how much it may. */
export async function storageOf(ownerId: string): Promise<{ used: number; quota: number | null }> {
  // Without accounts, file keys carry no owner.
  return { used: await services().files.usage(authEnabled() ? ownerId : null), quota: storageQuota() }
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)

/** Why `bytes` more would not fit in the account, or null when it fits. */
export async function noRoomFor(ownerId: string, bytes: number): Promise<string | null> {
  const { used, quota } = await storageOf(ownerId)
  if (quota === null || used + bytes <= quota) return null
  const { getT } = await import('@/shared/i18n/server')
  const t = await getT()
  return t('空間不夠：已用 {used} MB，上限 {quota} MB。可以刪掉用不到的匯入或考卷，或取消「永久保留原檔」，再試一次。', { used: mb(used), quota: mb(quota) })
}

