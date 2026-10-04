import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { fill, type T } from '../shared/i18n/format'

// Addresses inside a network: loopback, private ranges, link-local (cloud metadata lives at
// 169.254.169.254), carrier-grade NAT, and their IPv6 counterparts.
const internal = new BlockList()
for (const [net, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16]] as const) {
  internal.addSubnet(net, bits, 'ipv4')
}
for (const [net, bits] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10]] as const) internal.addSubnet(net, bits, 'ipv6')

/** Whether an IP address points inside a network rather than at the public internet. */
export function isInternalAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (mapped) return internal.check(mapped[1]!, 'ipv4')
  const family = isIP(address)
  return family === 4 ? internal.check(address, 'ipv4') : family === 6 ? internal.check(address, 'ipv6') : true
}

/**
 * Checks the address of a service someone added, and returns it without a trailing slash.
 * Run locally, anything goes, so a model on this computer (Ollama, LM Studio) works.
 * Hosted, the server would call it with the person's key, so it must be public HTTPS:
 * never this server, its network or the cloud's metadata service.
 * Errors are in the reader's language when `t` is given, else in Traditional Chinese.
 */
export async function checkServiceUrl(raw: string, hosted: boolean, t: T = fill): Promise<string> {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Error(t('網址格式不對，例如 https://openrouter.ai/api/v1'))
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(t('網址要以 https:// 開頭。'))
  if (url.username || url.password) throw new Error(t('網址裡不能放帳號密碼，金鑰請填在金鑰欄。'))
  if (hosted) {
    if (url.protocol !== 'https:') throw new Error(t('上線版只能接 https:// 的服務。'))
    const host = url.hostname.replace(/^\[|\]$/g, '')
    const addresses = isIP(host) ? [host] : await lookup(host, { all: true }).then((list) => list.map((a) => a.address), () => [])
    if (!addresses.length) throw new Error(t('找不到這個網址的伺服器。'))
    if (host === 'localhost' || addresses.some(isInternalAddress)) throw new Error(t('上線版不能接本機或內部網路的服務；本機模型請在自己電腦上跑 Sheetloop。'))
  }
  return url.toString().replace(/\/+$/, '')
}
