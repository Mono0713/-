/** URL of a file stored in the data folder (page images, figures). */
export function fileUrl(path: string): string {
  return `/api/files/${path.split('/').map(encodeURIComponent).join('/')}`
}
