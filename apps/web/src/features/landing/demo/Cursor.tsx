import { along, ramp } from './tween'

/**
 * The pointer that works the screens in the tour. It moves along `path` ([time, x, y] in the
 * picture's coordinates) and leaves a ring where it clicks (`clicks`, in seconds).
 */
export function Cursor({ s, path, clicks = [], show = [0, Infinity] }: { s: number; path: [number, number, number][]; clicks?: number[]; show?: [number, number] }) {
  const { x, y } = along(s, path)
  const shown = Math.min(ramp(s, show[0], 0.3), 1 - ramp(s, show[1], 0.25))
  const click = clicks.filter((c) => s >= c && s < c + 0.6).pop()
  const ring = click === undefined ? 0 : ramp(s, click, 0.55)
  const pressed = click !== undefined && s < click + 0.14
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-20" style={{ transform: `translate(${x}px, ${y}px)`, opacity: shown }} aria-hidden>
      {click !== undefined && (
        <span className="absolute -left-4 -top-4 size-8 rounded-full border-2 border-accent" style={{ opacity: 1 - ring, transform: `scale(${0.4 + ring * 0.8})` }} />
      )}
      <svg width="22" height="22" viewBox="0 0 24 24" className="-ml-1 -mt-[3px] drop-shadow-[0_2px_3px_rgb(10_15_31/0.3)]" style={{ transform: pressed ? 'scale(0.88)' : undefined }}>
        <path d="M4.5 3.2 19.6 10.4c.8.4.7 1.5-.1 1.8l-6 1.9-2.9 5.6c-.4.8-1.5.7-1.8-.1L3.2 4.5c-.3-.9.5-1.6 1.3-1.3Z" fill="var(--color-ink)" stroke="var(--color-surface)" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
