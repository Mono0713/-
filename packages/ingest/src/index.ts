import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { IngestedDocument } from '@exam/core'
import { prepareImage } from './image.ts'
import { renderPdf } from './pdf.ts'

export { prepareImage, storedPage } from './image.ts'
export { renderPdf } from './pdf.ts'

export interface IngestOptions {
  /** Longest edge of each page image in pixels. Default 2000. */
  maxEdge?: number
  /** Stretch contrast on photos and image scans. Default true. */
  enhance?: boolean
}

export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.gif', '.bmp'])

/** Turns a PDF or image file into page images ready for extraction. */
export async function ingestFile(path: string, opts: IngestOptions = {}): Promise<IngestedDocument> {
  return ingestBuffer(basename(path), await readFile(path), opts)
}

/** Same as ingestFile, for a file already in memory (e.g. an upload). The extension of fileName decides the type. */
export async function ingestBuffer(fileName: string, data: Buffer, opts: IngestOptions = {}): Promise<IngestedDocument> {
  const maxEdge = opts.maxEdge ?? 2000
  const enhance = opts.enhance ?? true
  const ext = extname(fileName).toLowerCase()

  if (ext === '.pdf') {
    return { fileName, kind: 'pdf', pages: await renderPdf(data, { maxEdge }) }
  }
  if (IMAGE_EXTENSIONS.has(ext)) {
    return { fileName, kind: 'image', pages: [await prepareImage(data, 1, { maxEdge, enhance })] }
  }
  throw new Error(`Unsupported file type "${ext}". Use a PDF or an image (${[...IMAGE_EXTENSIONS].join(', ')}).`)
}
