'use client'

import type { DraftFigure } from '@exam/core'
import { FigureView } from '@/shared/FigureView'
import { useT } from '@/shared/i18n/client'
import { IconCrop, IconImageReplace, IconLoader, IconTrash } from '@/shared/icons'
import type { FigureTools } from './useFigureTools'

/**
 * One picture of a question with its tools on it (shown on hover, always on touch screens): frame it
 * again on the original page, replace it with an uploaded picture, delete it. While it is being
 * framed on the page it is outlined, so it is clear which picture the box is for.
 */
export function FigureTile({ figure, tools, option = false }: { figure: DraftFigure; tools: FigureTools; option?: boolean }) {
  const t = useT()
  const busy = tools.working === figure
  const framing = tools.framing === figure
  const tool = `m-press grid ${option ? 'h-7 w-7' : 'h-8 w-8'} place-items-center rounded-lg bg-surface/95 text-muted shadow-sheet ring-1 ring-ink/[0.06] hover:text-ink`
  return (
    <div className={`group/figure relative ${option ? 'inline-block max-w-full' : ''} rounded-lg ${framing ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}>
      <FigureView figure={figure} option={option} />
      <div
        className={`absolute right-1 top-1 flex gap-1 transition-opacity ${busy || framing ? '' : 'sm:opacity-0 sm:group-hover/figure:opacity-100 sm:group-focus-within/figure:opacity-100'}`}
      >
        {busy && (
          <span className={tool}>
            <IconLoader size={15} className="m-spin" />
          </span>
        )}
        {tools.canFrame && (
          <button type="button" className={`${tool} ${framing ? '!text-accent' : ''}`} onClick={() => tools.reframe(figure)} aria-label={t('在原卷上重新框選')} title={t('在原卷上重新框選')}>
            <IconCrop size={15} />
          </button>
        )}
        {tools.canUpload && (
          <button type="button" className={tool} onClick={() => tools.pick(figure)} aria-label={t('換一張圖片')} title={t('換一張圖片')}>
            <IconImageReplace size={15} />
          </button>
        )}
        <button type="button" className={`${tool} hover:!text-bad`} onClick={() => tools.remove(figure)} aria-label={t('刪除圖片')} title={t('刪除圖片')}>
          <IconTrash size={15} />
        </button>
      </div>
    </div>
  )
}
