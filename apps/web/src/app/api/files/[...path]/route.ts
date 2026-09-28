import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { dataDir } from '@/server/context'

const TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

/** Serves page images and cropped figures from the data folder. */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const file = normalize(join(dataDir, ...path))
  const type = TYPES[extname(file).toLowerCase()]
  if (!file.startsWith(dataDir + sep) || !type) return new Response('Not found', { status: 404 })
  try {
    return new Response(new Uint8Array(await readFile(file)), { headers: { 'Content-Type': type, 'Cache-Control': 'no-cache' } })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
