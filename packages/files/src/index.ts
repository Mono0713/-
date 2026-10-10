import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { AwsClient } from 'aws4fetch'

/**
 * Where uploads, page images and figure crops are kept, by key ("imports/<id>/pages/page-1.png").
 * LocalFileStore keeps them in a folder; S3FileStore in Cloudflare R2 or any S3-compatible bucket.
 */
export interface FileStore {
  /** The file, or null when there is none. */
  read(key: string): Promise<Buffer | null>
  write(key: string, data: Buffer | string, contentType?: string): Promise<void>
  /** Keys of every file under a prefix ending in "/". */
  list(prefix: string): Promise<string[]>
  remove(keys: string[]): Promise<void>
  /** A link a browser can load the file from for a while, or null when the app has to serve it itself. */
  signedUrl(key: string, seconds?: number): Promise<string | null>
}

const SAFE_KEY = /^[\w-]+(?:[./][\w-]+)*$/

/** Rejects keys that could leave the store's folder, e.g. "../settings.json". */
export function checkKey(key: string): string {
  if (!SAFE_KEY.test(key) || key.split('/').some((part) => part === '..' || part.startsWith('.'))) throw new Error(`Invalid file key: ${key}`)
  return key
}

/** Files in a local folder (the data folder when developing). */
export class LocalFileStore implements FileStore {
  readonly root: string

  constructor(root: string) {
    this.root = resolve(root)
  }

  /** Where a key lives on disk. */
  path(key: string): string {
    const file = join(this.root, ...checkKey(key).split('/'))
    if (!file.startsWith(this.root + sep)) throw new Error(`Invalid file key: ${key}`)
    return file
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.path(key))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async write(key: string, data: Buffer | string): Promise<void> {
    const file = this.path(key)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, data)
  }

  async list(prefix: string): Promise<string[]> {
    const dir = join(this.root, ...prefix.split('/').filter(Boolean))
    try {
      const entries = await readdir(dir, { recursive: true, withFileTypes: true })
      return entries.filter((e) => e.isFile()).map((e) => relative(this.root, join(e.parentPath, e.name)).split(sep).join('/')).sort()
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw err
    }
  }

  async remove(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => rm(this.path(key), { force: true })))
  }

  async signedUrl(): Promise<string | null> {
    return null
  }
}

export interface S3Options {
  /** e.g. https://<account id>.r2.cloudflarestorage.com */
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  /** "auto" for R2. */
  region?: string
  /** How long one request may take, retries included, before it fails instead of waiting forever. */
  timeoutMs?: number
}

/** Files in Cloudflare R2, or another S3-compatible bucket, through its S3 API. */
export class S3FileStore implements FileStore {
  private readonly client: AwsClient
  private readonly base: string
  private readonly timeoutMs: number

  constructor(opts: S3Options) {
    this.timeoutMs = opts.timeoutMs ?? 60_000
    this.client = new AwsClient({ accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey, service: 's3', region: opts.region ?? 'auto' })
    this.base = `${opts.endpoint.replace(/\/+$/, '')}/${opts.bucket}`
  }

  async read(key: string): Promise<Buffer | null> {
    const res = await this.send(this.url(key), {}, 'read', key)
    if (res.status === 404) return null
    await ok(res, 'read', key)
    return Buffer.from(await res.arrayBuffer())
  }

  async write(key: string, data: Buffer | string, contentType = contentTypeOf(key)): Promise<void> {
    const res = await this.send(this.url(key), { method: 'PUT', body: typeof data === 'string' ? data : new Uint8Array(data), headers: { 'content-type': contentType } }, 'write', key)
    await ok(res, 'write', key)
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = []
    let token: string | null = null
    do {
      const query = new URLSearchParams({ 'list-type': '2', prefix })
      if (token) query.set('continuation-token', token)
      const res = await this.send(`${this.base}?${query}`, {}, 'list', prefix)
      await ok(res, 'list', prefix)
      const xml = await res.text()
      for (const m of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.push(unescapeXml(m[1]!))
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? unescapeXml(/<NextContinuationToken>([^<]*)</.exec(xml)?.[1] ?? '') || null : null
    } while (token)
    return keys.sort()
  }

  async remove(keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += 8) {
      await Promise.all(
        keys.slice(i, i + 8).map(async (key) => {
          const res = await this.send(this.url(key), { method: 'DELETE' }, 'remove', key)
          if (res.status !== 404) await ok(res, 'remove', key)
        }),
      )
    }
  }

  async signedUrl(key: string, seconds = 300): Promise<string> {
    const url = new URL(this.url(key))
    url.searchParams.set('X-Amz-Expires', String(seconds))
    const signed = await this.client.sign(url.toString(), { aws: { signQuery: true } })
    return signed.url
  }

  /** A request that gives up after timeoutMs, so a stalled connection fails instead of hanging. */
  private async send(url: string, init: RequestInit, action: string, key: string): Promise<Response> {
    try {
      // Sign, then send the plain bytes ourselves: a signed Request object carries its body as a stream, which some
      // fetch wrappers (Next.js) send chunked with no Content-Length, and R2 refuses that with 411.
      const signed = await this.client.sign(url, init)
      return await fetch(signed.url, { method: signed.method, headers: signed.headers, body: init.body, signal: AbortSignal.timeout(this.timeoutMs) })
    } catch (err) {
      if ((err as Error).name === 'TimeoutError') throw new Error(`File store could not ${action} ${key}: no answer within ${Math.round(this.timeoutMs / 1000)} s`)
      throw err
    }
  }

  private url(key: string): string {
    return `${this.base}/${checkKey(key).split('/').map(encodeURIComponent).join('/')}`
  }
}

async function ok(res: Response, action: string, key: string): Promise<void> {
  if (res.ok) return
  const body = await res.text().catch(() => '')
  throw new Error(`File store could not ${action} ${key}: ${res.status} ${body.slice(0, 200)}`)
}

const unescapeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
  json: 'application/json',
  md: 'text/markdown; charset=utf-8',
}

/** The media type of a file from its extension. */
export function contentTypeOf(key: string): string {
  return TYPES[key.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
}

/** R2 when its variables are set, else the local folder. */
export function fileStoreFromEnv(localRoot: string, env: NodeJS.ProcessEnv = process.env): FileStore {
  const { R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env
  if (R2_ENDPOINT && R2_BUCKET && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    return new S3FileStore({ endpoint: R2_ENDPOINT, bucket: R2_BUCKET, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY })
  }
  return new LocalFileStore(localRoot)
}
export * from './dedup.ts'
