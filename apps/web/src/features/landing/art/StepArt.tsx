import type { CSSProperties } from 'react'
import { IconCamera, IconCheck, IconFile, IconFileImage, IconPointer, IconTimer } from '@/shared/icons'
import type { T } from '@/shared/i18n/format'
import { Bar, Frame, Tick } from './Frame'

/** Pictures for the four steps. Each plays once when its card scrolls into view (.m-play). */

export function UploadArt({ t }: { t: T }) {
  const files = [
    { Icon: IconFile, name: t('數學段考.pdf') },
    { Icon: IconFileImage, name: t('英文講義.jpg') },
    { Icon: IconCamera, name: t('國語習作.png') },
  ]
  return (
    <Frame>
      <div className="absolute inset-3 rounded-lg border-2 border-dashed border-line" />
      <div className="absolute inset-x-7 top-1/2 -translate-y-1/2 space-y-1.5">
        {files.map(({ Icon, name }, i) => (
          <div key={i} className="m-play m-drop flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs shadow-sheet" style={{ '--i': i } as CSSProperties}>
            <Icon size={14} className="shrink-0 text-muted" />
            <span className="min-w-0 truncate">{name}</span>
            <IconCheck size={13} className="ml-auto shrink-0 text-good" />
          </div>
        ))}
      </div>
    </Frame>
  )
}

export function ScanArt() {
  const groups = [['92%', '70%'], ['84%', '90%', '56%'], ['76%', '48%']]
  return (
    <Frame style={{ '--m-scan-at': '250ms', '--m-box-at': '1.5s' } as CSSProperties}>
      <div className="absolute inset-y-3 left-1/2 w-[64%] -translate-x-1/2 overflow-hidden rounded bg-surface px-2.5 py-3 shadow-sheet">
        {groups.map((lines, g) => (
          <div key={g} className="relative mt-1.5 space-y-1.5 px-1.5 py-1.5 first:mt-0">
            <span className="m-play m-box-in absolute inset-0 rounded border-[1.5px] border-accent/70" style={{ '--i': g } as CSSProperties} />
            {lines.map((w, k) => (
              <Bar key={k} w={w} />
            ))}
          </div>
        ))}
        <div className="m-play m-scan-once" />
      </div>
    </Frame>
  )
}

export function CheckArt({ t }: { t: T }) {
  return (
    <Frame>
      <div className="absolute inset-y-3 left-3 w-[46%] rounded bg-surface p-2.5 shadow-sheet">
        <Bar w="80%" />
        <Bar w="55%" className="mt-1.5" />
        <div className="relative mt-3 space-y-1.5 px-1.5 py-1.5">
          <span className="absolute inset-0 rounded border-2 border-accent bg-accent/5">
            {['-left-1 -top-1', '-right-1 -top-1', '-bottom-1 -left-1', '-bottom-1 -right-1'].map((at) => (
              <span key={at} className={`absolute size-2 rounded-full border-2 border-accent bg-surface ${at}`} />
            ))}
          </span>
          <Bar w="90%" />
          <Bar w="70%" />
          <Bar w="40%" />
        </div>
        <IconPointer size={16} className="absolute bottom-3 right-1 fill-surface text-ink" />
      </div>
      <div className="absolute right-3 top-1/2 w-[42%] -translate-y-1/2 rounded-lg bg-surface p-2.5 shadow-sheet">
        <span className="inline-block rounded bg-hl px-1.5 text-[10px] font-semibold leading-4 text-ink">{t('請確認')}</span>
        <Bar w="90%" className="mt-2" />
        <Bar w="65%" className="mt-1.5" />
        <div className="mt-2 grid grid-cols-2 gap-1">
          {[0, 1, 2, 3].map((k) => (
            <span key={k} className="h-3 rounded-sm border border-line" />
          ))}
        </div>
      </div>
    </Frame>
  )
}

export function PracticeArt() {
  return (
    <Frame>
      <div className="absolute inset-x-5 inset-y-3 rounded-lg bg-surface p-3 shadow-sheet">
        <div className="flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <span className="block h-full w-3/5 rounded-full bg-ink/40" />
          </span>
          <span className="num flex items-center gap-1 text-[11px] text-muted">
            <IconTimer size={11} />
            12:40
          </span>
        </div>
        <Bar w="88%" className="mt-3" />
        <Bar w="58%" className="mt-1.5" />
        <ul className="mt-3 grid grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map((k) => (
            <li key={k} className={`flex h-6 items-center gap-1.5 rounded-md border px-2 ${k === 1 ? 'border-good/60 bg-good-soft' : 'border-line'}`}>
              <span className="num text-[10px] text-muted">{'ABCD'[k]}</span>
              {k === 1 && <Tick delay={500} />}
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  )
}
