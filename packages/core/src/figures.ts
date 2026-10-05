/** What a cleared figure blank shows when its printed text is unknown: its label, e.g. "7.". */
export function defaultPrintedText(label: string): string {
  return /^[\p{L}\p{N}]+$/u.test(label) ? `${label}.` : label
}

type WithFigures<F> = { figures: F[]; options: { label: string }[] }

/** Figures shown with the question itself: all but the pictures of its options. A picture whose option is gone stays here. */
export function questionFigures<F extends { option?: string | null }>(q: WithFigures<F>): F[] {
  return q.figures.filter((f) => !f.option || !q.options.some((o) => o.label === f.option))
}

/** The pictures that make up option `label`, e.g. one graph per choice. */
export function optionFigures<F extends { option?: string | null }>(q: WithFigures<F>, label: string): F[] {
  return q.figures.filter((f) => f.option === label)
}
