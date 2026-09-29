import type { DraftFigure } from '@exam/core'
import { fileUrl } from './files'
import { Markdown } from './Markdown'

/**
 * A cropped figure. Its blanks are drawn as numbered boxes at their positions;
 * `answers` fills them in (e.g. for review), `renderBlank` lets a test put inputs there.
 */
export function FigureView({
  figure,
  answers,
  renderBlank,
}: {
  figure: DraftFigure
  answers?: string[]
  renderBlank?: (label: string, index: number) => React.ReactNode
}) {
  if (!figure.image) {
    return <Markdown className="rounded-lg bg-paper px-3 py-2 text-sm text-muted">{`圖：${figure.description}`}</Markdown>
  }
  const { image } = figure
  return (
    <figure className="my-2">
      <div className="relative inline-block max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fileUrl(image.file)} alt={figure.description.replace(/\$/g, '')} width={image.width} height={image.height} className="block h-auto max-w-full rounded-md border border-line" />
        {image.blanks.map((b, i) => (
          <div
            key={`${b.label}-${i}`}
            className="absolute flex items-center justify-center"
            style={{ left: `${b.bbox.x * 100}%`, top: `${b.bbox.y * 100}%`, width: `${b.bbox.width * 100}%`, height: `${b.bbox.height * 100}%` }}
          >
            {renderBlank ? (
              renderBlank(b.label, i)
            ) : (
              <span className="relative block h-full w-full rounded-sm ring-1 ring-accent/60">
                {answers?.[i] ? (
                  <span className="absolute -right-2 -top-2.5 rounded bg-accent px-1.5 text-xs font-semibold text-white shadow-sm">{answers[i]}</span>
                ) : null}
              </span>
            )}
          </div>
        ))}
      </div>
      <figcaption className="mt-1 text-xs text-muted">
        <Markdown>{figure.description}</Markdown>
      </figcaption>
    </figure>
  )
}
