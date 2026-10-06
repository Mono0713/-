import sharp from 'sharp'

/** Widest a picture someone puts in a question is kept; larger ones are scaled down. */
const MAX_WIDTH = 1600

/**
 * A picture uploaded to replace or add a figure: turned the right way up (phone photos carry
 * their rotation separately), scaled down when very large, saved as PNG like cropped figures.
 * Throws when the data is not an image.
 */
export async function figureFromUpload(data: Buffer): Promise<{ png: Buffer; width: number; height: number }> {
  const { data: png, info } = await sharp(data, { limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer({ resolveWithObject: true })
  return { png, width: info.width, height: info.height }
}
