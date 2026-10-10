'use client'

/** An on/off switch; `small` sits beside a row's title. */
export function Switch({ on, label, onChange, small = false }: { on: boolean; label: string; onChange: (on: boolean) => void; small?: boolean }) {
  const size = small ? 'h-5 w-9' : 'h-6 w-11'
  const knob = small ? 'h-4 w-4' : 'h-5 w-5'
  const shift = on ? (small ? 'translate-x-4.5' : 'translate-x-5.5') : 'translate-x-0.5'
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} onClick={() => onChange(!on)} className={`relative ${size} shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-ink/15'}`}>
      <span className={`absolute left-0 top-0.5 ${knob} rounded-full bg-white shadow transition-transform duration-300 [transition-timing-function:var(--m-spring)] ${shift}`} />
    </button>
  )
}
