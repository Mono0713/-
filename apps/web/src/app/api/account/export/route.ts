import { accountExport } from '@/server/account'
import { BRAND } from '@/shared/brand/brand'

/** 下載我的資料: the signed-in person's whole account as a JSON file. */
export async function GET() {
  const out = await accountExport()
  if (!out) return new Response('Not found', { status: 404 })
  const day = new Date().toISOString().slice(0, 10)
  return new Response(JSON.stringify(out.data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${BRAND.name.toLowerCase()}-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
