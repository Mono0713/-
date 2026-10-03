import sharp from 'sharp'
import type { PageImage } from '@exam/core'

export interface ImageOptions {
  /** Longest edge of the output image in pixels. */
  maxEdge: number
  /** Stretch contrast; helps faint photos and scans. */
  enhance: boolean
}

/**
 * Prepares a photo or scanned image for extraction: applies the EXIF rotation
 * phones write, caps the size, and optionally stretches contrast.
 */
export async function prepareImage(input: Buffer, pageNumber: number, opts: ImageOptions): Promise<PageImage> {
  let pipeline = sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: opts.maxEdge, height: opts.maxEdge, fit: 'inside', withoutEnlargement: true })
  if (opts.enhance) pipeline = pipeline.normalise()
  const { data, info } = await pipeline.png().toBuffer({ resolveWithObject: true })
  return {
    pageNumber,
    mimeType: 'image/png',
    data,
    width: info.width,
    height: info.height,
    textLayer: null,
  }
}

/**
 * A rendered page as it is kept: WebP at quality 80, about a tenth of the PNG (a scanned
 * A4 page is 80-200 KB). Models read the PNG while importing; the kept copy is for
 * showing the page, cropping figures again and re-reading after the upload expires.
 */
export async function storedPage(png: Buffer): Promise<Buffer> {
  return sharp(png).webp({ quality: 80 }).toBuffer()
}
