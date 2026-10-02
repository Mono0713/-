import { fileUrl } from '@/shared/files'

/**
 * The page being read, with a scan line passing down it (Apple Notes' document scan). It loops
 * while the model reads; the questions it finds are boxed one by one when the editor opens.
 */
export function Scan({ image, pageNumber }: { image: string; pageNumber: number }) {
  return (
    <div className="relative w-36 shrink-0 overflow-hidden rounded-md bg-surface shadow-sheet sm:w-44">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fileUrl(image)} alt={`第 ${pageNumber} 頁`} className="block h-auto w-full" />
      <span aria-hidden className="m-scan-bar" />
      <span className="num absolute left-1.5 top-1.5 rounded bg-night/70 px-1.5 py-0.5 text-[11px] text-white">{pageNumber}</span>
    </div>
  )
}
