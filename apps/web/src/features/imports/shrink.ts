const MAX_EDGE = 3000
const LIGHT = 1.5 * 1024 * 1024
const SHRINKABLE = /^image\/(jpeg|png|webp|bmp)$/

/**
 * Makes a phone photo smaller before it is uploaded: at most 3000 px on the long side, saved as JPEG at 90%.
 * That is still sharper than what reading needs, and a 6–12 MB photo becomes about 1–2 MB. PDFs, small images
 * and anything the browser cannot draw go up as they are; so does a photo that would not get smaller.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  if (!SHRINKABLE.test(file.type) || file.size < LIGHT) return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.9))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  }
}
