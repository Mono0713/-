import { createServer, type Server } from 'node:http'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { checkKey, LocalFileStore, S3FileStore, type FileStore } from '../src/index.ts'

/** Just enough of the S3 API (get, put, delete, list v2 with paging) to exercise S3FileStore. */
function fakeS3(): Promise<{ server: Server; endpoint: string; requests: string[] }> {
  const objects = new Map<string, Buffer>()
  const requests: string[] = []
  const server = createServer(async (req, res) => {
    requests.push(`${req.method} ${req.headers.authorization ? 'signed' : 'unsigned'}`)
    const url = new URL(req.url!, 'http://x')
    const [, bucket, ...rest] = url.pathname.split('/')
    const key = rest.map(decodeURIComponent).join('/')
    if (bucket !== 'exams') return void res.writeHead(404).end()
    if (req.method === 'PUT') {
      const chunks: Buffer[] = []
      for await (const c of req) chunks.push(c as Buffer)
      objects.set(key, Buffer.concat(chunks))
      return void res.writeHead(200).end()
    }
    if (req.method === 'DELETE') {
      objects.delete(key)
      return void res.writeHead(204).end()
    }
    if (!key && url.searchParams.get('list-type') === '2') {
      const all = [...objects.keys()].filter((k) => k.startsWith(url.searchParams.get('prefix') ?? '')).sort()
      const start = Number(url.searchParams.get('continuation-token') ?? 0)
      const page = all.slice(start, start + 2)
      const more = start + 2 < all.length
      const xml = `<ListBucketResult>${page.map((k) => `<Contents><Key>${k}</Key></Contents>`).join('')}<IsTruncated>${more}</IsTruncated>${more ? `<NextContinuationToken>${start + 2}</NextContinuationToken>` : ''}</ListBucketResult>`
      return void res.writeHead(200, { 'content-type': 'application/xml' }).end(xml)
    }
    const body = objects.get(key)
    if (!body) return void res.writeHead(404).end('<Error><Code>NoSuchKey</Code></Error>')
    res.writeHead(200).end(body)
  })
  return new Promise((done) => server.listen(0, () => done({ server, endpoint: `http://127.0.0.1:${(server.address() as { port: number }).port}`, requests })))
}

let s3: Awaited<ReturnType<typeof fakeS3>>
beforeAll(async () => {
  s3 = await fakeS3()
})
afterAll(() => s3.server.close())

const stores: [string, () => Promise<FileStore>][] = [
  ['LocalFileStore', async () => new LocalFileStore(await mkdtemp(join(tmpdir(), 'files-')))],
  ['S3FileStore', async () => new S3FileStore({ endpoint: s3.endpoint, bucket: 'exams', accessKeyId: 'id', secretAccessKey: 'secret' })],
]

describe.each(stores)('%s', (_name, open) => {
  it('writes, reads, lists and removes files by key', async () => {
    const store = await open()
    await store.write('u/a/imports/1/pages/page-1.png', Buffer.from([1, 2, 3]))
    await store.write('u/a/imports/1/pages/page-2.png', Buffer.from([4]))
    await store.write('u/a/imports/1/results.json', '[]')
    await store.write('u/b/imports/2/results.json', '{}')

    expect(await store.read('u/a/imports/1/pages/page-1.png')).toEqual(Buffer.from([1, 2, 3]))
    expect(await store.read('u/a/imports/1/missing.png')).toBeNull()
    expect(await store.list('u/a/imports/1/')).toEqual(['u/a/imports/1/pages/page-1.png', 'u/a/imports/1/pages/page-2.png', 'u/a/imports/1/results.json'])
    expect(await store.list('u/a/nothing/')).toEqual([])

    await store.remove(await store.list('u/a/imports/1/pages/'))
    expect(await store.list('u/a/')).toEqual(['u/a/imports/1/results.json'])
  })
})

describe('S3FileStore', () => {
  it('signs every request and hands out signed links', async () => {
    const store = new S3FileStore({ endpoint: s3.endpoint, bucket: 'exams', accessKeyId: 'id', secretAccessKey: 'secret' })
    await store.read('x.png')
    expect(s3.requests.every((r) => r.endsWith(' signed'))).toBe(true)
    const link = new URL(await store.signedUrl('u/a/page-1.png', 60))
    expect(link.pathname).toBe('/exams/u/a/page-1.png')
    expect(link.searchParams.get('X-Amz-Expires')).toBe('60')
    expect(link.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('gives up on a bucket that never answers instead of waiting forever', async () => {
    const silent = createServer(() => {})
    await new Promise<void>((done) => silent.listen(0, done))
    try {
      const store = new S3FileStore({ endpoint: `http://127.0.0.1:${(silent.address() as { port: number }).port}`, bucket: 'exams', accessKeyId: 'id', secretAccessKey: 'secret', timeoutMs: 1000 })
      await expect(store.write('u/a/figures/f1.png', Buffer.from([1]))).rejects.toThrow('could not write u/a/figures/f1.png: no answer within 1 s')
    } finally {
      silent.closeAllConnections()
      silent.close()
    }
  })
})

describe('checkKey', () => {
  it('refuses keys that could reach outside the store', () => {
    expect(checkKey('imports/abc/pages/page-1.png')).toBe('imports/abc/pages/page-1.png')
    for (const bad of ['../settings.json', 'imports/../../x', '/etc/passwd', 'a//b', '.env', 'a/.hidden', 'a\\b']) expect(() => checkKey(bad)).toThrow()
  })
})
