import { contentTypeOf } from '@exam/files'
import { services } from '@/server/context'
import { ownedImport } from '@/server/owned'

/** Downloads one uploaded file of an import, under the name it was uploaded with, while it is still kept. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; n: string }> }) {
  const notFound = () => new Response('Not found', { status: 404 })
  const { id, n } = await ctx.params
  const imp = await ownedImport(id)
  if (!imp) return notFound()
  const { importer, files } = services()
  const file = (await importer.originals(id))[Number(n) - 1]
  const data = file && (await files.read(file.key))
  if (!file || !data) return notFound()
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': contentTypeOf(file.key),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
