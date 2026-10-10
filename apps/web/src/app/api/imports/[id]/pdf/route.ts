import { services } from '@/server/context'
import { ownedImport } from '@/server/owned'

/** 匯出裁切後的 PDF: the original's pages as shown in the editor (photos cut and flattened), one per page. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const imp = await ownedImport(id)
  if (!imp || !imp.pageCount) return new Response('Not found', { status: 404 })
  const pdf = await services().importer.pagesPdf(id)
  const name = `${(imp.title ?? imp.fileName).replace(/\.[a-z0-9]+$/i, '')}.pdf`
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="exam.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}
