import type { ReactNode } from 'react'
import type { Figure } from '../samples/types'

/** Printed figures of the sample sheets; `on` adds what the student drew on them in pencil. */
export function SheetFigure({ name, on }: { name: Figure; on: boolean }) {
  const Draw = FIGURES[name]
  return <Draw on={on} />
}

const FIGURES: Record<Figure, (p: { on: boolean }) => ReactNode> = {
  'number-line': NumberLine,
  incline: Incline,
  market: Market,
}

/** Pencil strokes: graphite grey, round ends. */
const PENCIL = { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const

/** Small enough to sit to the right of the question text on wider sheets, as figures do on a real paper. */
export const BESIDE: ReadonlySet<Figure> = new Set(['incline', 'market'])

function Svg({ box, max, beside = false, children }: { box: string; max: number; beside?: boolean; children: ReactNode }) {
  return (
    <svg viewBox={box} className={`mt-1.5 block h-auto w-full shrink-0 overflow-visible text-ink ${beside ? 'sm:mt-1 sm:w-[176px]' : ''}`} style={{ maxWidth: max }} aria-hidden>
      {children}
    </svg>
  )
}

/** −3 … 3; the student marked −1.5. */
function NumberLine({ on }: { on: boolean }) {
  const x = (n: number) => 22 + (n + 3) * 42
  return (
    <Svg box="0 0 300 52" max={300}>
      <path d="M8 30H290M284 25l6 5-6 5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      {[-3, -2, -1, 0, 1, 2, 3].map((n) => (
        <g key={n}>
          <path d={`M${x(n)} 25V35`} stroke="currentColor" strokeWidth="1.2" />
          <text x={x(n)} y="49" textAnchor="middle" fontSize="11" fill="currentColor" className="opacity-70">
            {n < 0 ? `−${-n}` : n}
          </text>
        </g>
      ))}
      {on && (
        <g className="text-muted">
          <circle cx={x(-1.5)} cy="30" r="3.6" fill="currentColor" />
          <text x={x(-1.5)} y="17" textAnchor="middle" fontSize="14" fill="currentColor" className="font-hand">
            A
          </text>
        </g>
      )}
    </Svg>
  )
}

/** A block resting on a slope; the student drew gravity, the normal force and friction. */
function Incline({ on }: { on: boolean }) {
  return (
    <Svg box="0 0 200 106" max={200} beside>
      <path d="M14 100H190L14 32Z" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M160 100A30 30 0 0 1 162 89.2" stroke="currentColor" strokeWidth="1" fill="none" className="opacity-60" />
      <text x="146" y="97" fontSize="14" fill="currentColor" className="opacity-70">
        θ
      </text>
      <g transform="translate(93.2 62.6) rotate(21.12)">
        <rect x="-17" y="-20" width="34" height="20" rx="2" fill="var(--color-surface)" stroke="currentColor" strokeWidth="1.2" />
      </g>
      {on && (
        <g className="text-muted">
          <path {...PENCIL} d="M96.8 53.3V93.3M92.8 87.8L96.8 93.3L100.8 87.8" />
          <path {...PENCIL} d="M96.8 53.3L109.1 21.6M103.2 25.8L109.1 21.6L110.6 28.6" />
          <path {...PENCIL} d="M80.9 47.1L56.7 37.8M63.7 36.2L56.7 37.8L60.9 43.7" />
          <text x="102" y="96" fontSize="16" fill="currentColor" className="font-hand">
            mg
          </text>
          <text x="113" y="22" fontSize="16" fill="currentColor" className="font-hand">
            N
          </text>
          <text x="44" y="37" fontSize="16" fill="currentColor" className="font-hand">
            f
          </text>
        </g>
      )}
    </Svg>
  )
}

/** Supply and demand; the student drew the demand curve shifted right. */
function Market({ on }: { on: boolean }) {
  return (
    <Svg box="0 0 200 122" max={200} beside>
      <path d="M24 6V104H192M20 12l4-6 4 6M186 100l6 4-6 4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <text x="8" y="17" fontSize="14" fill="currentColor" className="opacity-70">
        P
      </text>
      <text x="184" y="121" fontSize="14" fill="currentColor" className="opacity-70">
        Q
      </text>
      <path d="M44 96L150 24" stroke="currentColor" strokeWidth="1.4" />
      <text x="154" y="27" fontSize="14" fill="currentColor">
        S
      </text>
      <path d="M44 24L140 92" stroke="currentColor" strokeWidth="1.4" />
      <text x="143" y="99" fontSize="14" fill="currentColor">
        D
      </text>
      {on && (
        <g className="text-muted">
          <path {...PENCIL} d="M76 24L172 92" />
          <path {...PENCIL} d="M128 80H150M145 76L150 80L145 84" />
          <text x="174" y="99" fontSize="16" fill="currentColor" className="font-hand">
            D′
          </text>
        </g>
      )}
    </Svg>
  )
}
