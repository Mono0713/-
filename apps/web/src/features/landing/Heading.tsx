/** A section's heading: its number and name in small type, the title, and an optional line under it. */
export function Heading({ n, kicker, title, lead }: { n: number; kicker: string; title: string; lead?: string }) {
  return (
    <div className="m-reveal max-w-2xl">
      <p className="text-sm font-medium text-muted">
        <span className="num mr-2 text-ink">{String(n).padStart(2, '0')}</span>
        {kicker}
      </p>
      <h2 className="mt-3 font-display text-[30px] font-extrabold leading-[1.15] tracking-[-0.02em] [text-wrap:balance] sm:text-[38px]">{title}</h2>
      {lead && <p className="mt-3 text-base leading-relaxed text-muted">{lead}</p>}
    </div>
  )
}
