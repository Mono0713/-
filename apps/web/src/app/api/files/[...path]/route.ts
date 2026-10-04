import { checkKey, contentTypeOf } from '@exam/files'
import { authEnabled, currentUser } from '@/server/auth'
import { services } from '@/server/context'
import { classFile } from '@/server/classes'
import { sharedFile } from '@/server/shared'

const IMAGES = new Set(['image/png', 'image/jpeg', 'image/webp'])

/**
 * Serves page images and cropped figures. With accounts, file keys start with "u/<owner>/"
 * and only that owner gets them, anyone signed in while the exam is shared by link, or the
 * members of a class for its assignments' figures. From R2 the browser is sent to a short-lived signed link;
 * from the local folder the file is sent directly.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const notFound = () => new Response('Not found', { status: 404 })
  const { path } = await ctx.params
  let key: string
  try {
    key = checkKey(path.join('/'))
  } catch {
    return notFound()
  }
  const type = contentTypeOf(key)
  if (!IMAGES.has(type)) return notFound()
  if (authEnabled()) {
    const user = await currentUser()
    if (!user || (!key.startsWith(`u/${user.id}/`) && !(await sharedFile(key)) && !(await classFile(key, user.id)))) return notFound()
  }
  const { files } = services()
  const signed = await files.signedUrl(key, 300)
  if (signed) return Response.redirect(signed, 302)
  const data = await files.read(key)
  if (!data) return notFound()
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': type, 'Cache-Control': 'private, no-cache' } })
}
