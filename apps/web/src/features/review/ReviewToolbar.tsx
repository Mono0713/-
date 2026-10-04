'use client'

import Link from 'next/link'
import { Menu, menuItem } from '@/shared/chrome/Menu'
import { IconAlert, IconBack, IconCheck, IconChevronDown, IconCloud, IconCloudCheck, IconLoader, IconOutline, IconSave } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { Button } from '@/shared/ui'
import { SAVE_LABELS, type SaveState } from './useDraftSaving'

export const iconButton = 'm-press grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/[0.05] hover:text-ink'

/**
 * The review page's one slim bar: the way back and the exam's menu, the question numbers
 * (`numbers`, with a 題目/原卷 switch on phones), then review state and saving.
 */
export function ReviewToolbar({
  barRef,
  heading,
  published,
  inSync,
  outline,
  onToggleOutline,
  hasPages,
  mobileView,
  onMobileView,
  numbers,
  flagged,
  flaggedOnly,
  onToggleFlagged,
  saveState,
  onPublish,
  publishing,
  canPublish,
}: {
  barRef: React.Ref<HTMLDivElement>
  heading: { title: string; meta?: string; menu?: React.ReactNode }
  published: { count: number; examId: string } | null
  inSync: boolean
  outline: boolean
  onToggleOutline: () => void
  hasPages: boolean
  mobileView: 'questions' | 'page'
  onMobileView: (view: 'questions' | 'page') => void
  numbers: React.ReactNode
  flagged: number
  flaggedOnly: boolean
  onToggleFlagged: () => void
  saveState: SaveState
  onPublish: () => void
  publishing: boolean
  canPublish: boolean
}) {
  const t = useT()
  return (
    <div ref={barRef} className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-1 lg:max-w-[22rem] lg:flex-none">
          <Link href="/imports" className={iconButton} aria-label={t('回到匯入列表')} title={t('回到匯入列表')}>
            <IconBack size={18} />
          </Link>
          <button
            type="button"
            onClick={onToggleOutline}
            aria-pressed={outline}
            className={`${iconButton} hidden lg:grid ${outline ? 'bg-ink/[0.06] text-ink' : ''}`}
            aria-label={outline ? t('收起題目大綱') : t('顯示題目大綱')}
            title={outline ? t('收起題目大綱') : t('顯示題目大綱')}
          >
            <IconOutline size={17} />
          </button>
          <h1 className="sr-only">{heading.title}</h1>
          <Menu
            label={t('考卷選單')}
            className="m-press flex max-w-full min-w-0 items-center gap-1 rounded-lg px-2 py-1 hover:bg-ink/[0.05]"
            button={
              <>
                <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{heading.title}</span>
                <IconChevronDown size={15} className="shrink-0 text-muted" />
              </>
            }
          >
            {(close) => (
              <>
                <div className="px-2.5 pb-2 pt-1.5">
                  <p className="font-medium leading-snug">{heading.title}</p>
                  {heading.meta && <p className="mt-0.5 text-xs text-muted">{heading.meta}</p>}
                </div>
                {published !== null && (
                  <Link href={`/bank/exams/${published.examId}`} role="menuitem" className={menuItem} onClick={close}>
                    <IconSave size={15} className="text-good" />
                    <span className="flex-1">{t('在題庫查看')}</span>
                    <span className="num text-xs text-muted">{t('{n} 題', { n: published.count })}</span>
                  </Link>
                )}
                <button type="button" role="menuitem" className={`${menuItem} hidden lg:flex`} onClick={() => (onToggleOutline(), close())}>
                  <IconOutline size={15} className="text-muted" />
                  {outline ? t('收起題目大綱') : t('題目大綱與考卷資訊')}
                </button>
                {heading.menu && <div className="mt-1 border-t border-line/70 pt-1">{heading.menu}</div>}
              </>
            )}
          </Menu>
        </div>

        {/* Question numbers: sub-questions sit together under their number. Below lg they get a row of their own. */}
        <div className="order-last flex min-w-0 basis-full items-center gap-2 lg:order-none lg:flex-1 lg:basis-0">
          <div className={`flex shrink-0 rounded-lg bg-ink/[0.06] p-0.5 text-sm lg:hidden ${hasPages ? '' : 'hidden'}`}>
            {(
              [
                ['questions', t('題目')],
                ['page', t('原卷')],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onMobileView(value)}
                className={`rounded-md px-2.5 py-1 transition-colors ${mobileView === value ? 'bg-surface font-medium shadow-sm' : 'text-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {numbers}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {flagged > 0 && (
            <button
              type="button"
              onClick={onToggleFlagged}
              aria-pressed={flaggedOnly}
              aria-label={t('{n} 題待確認', { n: flagged })}
              title={flaggedOnly ? t('顯示全部題目') : t('{n} 題待確認：點一下只看這些', { n: flagged })}
              className={`m-press flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ${flaggedOnly ? 'bg-hl text-night' : 'bg-warn-soft text-warn hover:bg-hl/40'}`}
            >
              <IconAlert size={14} strokeWidth={2.4} />
              <span className="num">{flagged}</span>
            </button>
          )}
          <span
            className={`grid h-8 w-8 place-items-center ${saveState === 'saved' ? 'text-muted/70' : 'text-accent'}`}
            title={t(SAVE_LABELS[saveState])}
            aria-label={t(SAVE_LABELS[saveState])}
            role="status"
          >
            {saveState === 'saved' ? <IconCloudCheck size={17} /> : saveState === 'saving' ? <IconLoader size={16} className="m-spin" /> : <IconCloud size={17} />}
          </span>
          {published !== null && inSync ? (
            <Link
              href={`/bank/exams/${published.examId}`}
              className="m-press flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-good hover:bg-good-soft max-sm:px-2"
              title={t('{n} 題已存入題庫，點一下查看', { n: published.count })}
            >
              <IconCheck size={15} strokeWidth={2.6} />
              <span className="max-sm:hidden">{t('已存入')}</span>
            </Link>
          ) : (
            <Button
              variant="primary"
              className="h-8 px-3 py-0 max-sm:px-2"
              onClick={onPublish}
              disabled={publishing || !canPublish}
              loading={publishing}
              icon={<IconSave size={16} />}
              aria-label={published !== null ? t('更新題庫') : t('存入題庫')}
            >
              <span className="max-sm:hidden">{publishing ? t('存入中…') : published !== null ? t('更新題庫') : t('存入題庫')}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
