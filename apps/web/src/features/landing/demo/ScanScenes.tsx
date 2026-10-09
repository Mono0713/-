import type { CSSProperties, ReactNode } from 'react'
import { IconCrop } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { biology } from '../samples/biology'
import { Copy, FoundCard, SampleSheet } from '../sheet/Sheet'
import { SceneLayout } from './SceneLayout'
import { easeInOut, mix, pop, ramp, rise } from './tween'

/** Where the sheet lies once it is cut out and flat; the reading scene starts from the same spot. */
const SHEET = { x: 60, y: 6, w: 320, h: 496 }
/** The sheet is laid out as on the hero (one page tall enough for every language) and drawn smaller. */
const PRINT = { w: 400, h: 620 }

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="origin-top-left" style={{ width: PRINT.w, height: PRINT.h, transform: `scale(${SHEET.w / PRINT.w})` }}>
      {children}
    </div>
  )
}

/** A phone photo of the exam on a desk: the corners are found, then the sheet is cut out and laid flat. */
export function PhotoScene({ s, tall }: { s: number; tall: boolean }) {
  const t = useT()
  const flat = ramp(s, 2.1, 0.9, easeInOut)
  const scale = mix(0.84, 1, flat)
  const turn = mix(3.5, 0, flat)
  const shift = { x: mix(10, 0, flat), y: mix(14, 0, flat) }
  const cx = SHEET.x + SHEET.w / 2 + shift.x
  const cy = SHEET.y + SHEET.h / 2 + shift.y
  const rad = (turn * Math.PI) / 180
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy], i) => {
    const dx = (sx! * SHEET.w * scale) / 2
    const dy = (sy! * SHEET.h * scale) / 2
    const found = { x: cx + dx * Math.cos(rad) - dy * Math.sin(rad), y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) }
    // the handles start in the photo's corners and slide onto the sheet's
    const start = { x: sx! < 0 ? 16 : 424, y: sy! < 0 ? 16 : 504 }
    const p = ramp(s, 0.8 + i * 0.08, 0.8, easeInOut)
    return { x: mix(start.x, found.x, p), y: mix(start.y, found.y, p) }
  })
  const handles = Math.min(ramp(s, 0.5, 0.3), 1 - ramp(s, 3.0, 0.3))
  return (
    <SceneLayout s={s} tall={tall} step={1} title={t('拍照或上傳')} text={t('手機拍照、掃描檔或 PDF 都可以。照片會自動裁成整張考卷，拍歪了也會拉正。')}>
      <div className="absolute inset-0 rounded-[20px] bg-[#5d5249]" style={{ opacity: 1 - flat, boxShadow: 'inset 0 0 60px rgb(0 0 0 / 0.35)' }} />
      <div
        className="absolute overflow-hidden rounded-md bg-surface shadow-sheet"
        style={{ left: SHEET.x, top: SHEET.y, width: SHEET.w, height: SHEET.h, transform: `translate(${shift.x}px, ${shift.y}px) rotate(${turn}deg) scale(${scale})` }}
      >
        <Page>
          <div className="flex h-full flex-col text-[13.5px] leading-relaxed">
            <Copy sample={biology} t={t} pencil />
          </div>
        </Page>
      </div>
      <svg className="pointer-events-none absolute inset-0" width="440" height="520" aria-hidden style={{ opacity: handles }}>
        <polygon points={corners.map((c) => `${c.x},${c.y}`).join(' ')} fill="color-mix(in srgb, var(--color-accent) 8%, transparent)" stroke="var(--color-accent)" strokeWidth="2" />
        {corners.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="7" fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="2.5" />
        ))}
      </svg>
      <Chip style={pop(ramp(s, 3.1, 0.4))}>
        <IconCrop size={14} aria-hidden className="text-accent" />
        {t('已裁成整張考卷')}
      </Chip>
    </SceneLayout>
  )
}

/**
 * The sample sheet's own scan (motion.css, "product page"): the pencil is wiped off, every question
 * is boxed and the answer highlighted, then the note says what was found.
 */
export function ReadScene({ s, tall }: { s: number; tall: boolean }) {
  const t = useT()
  const timing = { '--m-scan-at': '250ms', '--m-box-at': '2s', '--m-mark-at': '2.75s' } as CSSProperties
  return (
    <SceneLayout s={s} tall={tall} step={2} title={t('AI 框出每一題')} text={t('認出題型、選項、表格和答案，學生寫過的筆跡也會清掉。')}>
      <div className="absolute" style={{ left: SHEET.x, top: SHEET.y, width: SHEET.w, height: SHEET.h, ...timing }}>
        <Page>
          <SampleSheet sample={biology} t={t} />
        </Page>
      </div>
      <div className="absolute right-2 top-[440px] rotate-[2deg]" style={rise(ramp(s, 3.2, 0.5))}>
        <FoundCard sample={biology} t={t} />
      </div>
    </SceneLayout>
  )
}

function Chip({ style, children }: { style: CSSProperties; children: ReactNode }) {
  return (
    <div className="absolute inset-x-0 top-[486px] flex justify-center" style={style}>
      <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-medium shadow-sheet">{children}</span>
    </div>
  )
}
