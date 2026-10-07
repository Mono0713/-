import { authEnabled } from './auth'
import { keyPrefixOf, services } from './context'

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


/** One import's share of an account's storage, for the list in settings where it can be deleted. */
export interface StorageItem {
  id: string
  title: string
  /** Bytes of its pages and data, without the originals (listed apart) and without pictures that saved questions keep. */
  bytes: number
  /** Of those, the uploaded originals; 0 once deleted. */
  originals: number
}

/** The biggest imports first; up to `limit` of them. */
export async function storageItems(ownerId: string, limit = 30): Promise<StorageItem[]> {
  const { bank, files } = services()
  const [imports, sizes] = await Promise.all([bank.listImports(ownerId), files.sizes(`${authEnabled() ? keyPrefixOf(ownerId) : ''}imports/`)])
  const held = new Map<string, { all: number; figures: number; originals: number }>()
  for (const { key, size } of sizes) {
    const [, id, folder] = /(?:^|\/)imports\/([^/]+)\/([^/]+)/.exec(key) ?? []
    if (!id) continue
    const now = held.get(id) ?? { all: 0, figures: 0, originals: 0 }
    now.all += size
    if (folder === 'figures') now.figures += size
    if (folder === 'sources') now.originals += size
    held.set(id, now)
  }
  const biggest = imports
    .map((imp) => ({ imp, own: held.get(imp.id) }))
    .filter((x): x is { imp: (typeof imports)[number]; own: NonNullable<typeof x.own> } => Boolean(x.own?.all))
    .sort((a, b) => b.own.all - a.own.all)
    .slice(0, limit)
  return Promise.all(
    biggest.map(async ({ imp, own }) => {
      // pictures of questions already saved stay when the import goes
      const inBank = (await bank.examForImport(imp.id)) !== null
      return { id: imp.id, title: imp.title ?? imp.fileName, bytes: own.all - own.originals - (inBank ? own.figures : 0), originals: own.originals }
    }),
  )
}
