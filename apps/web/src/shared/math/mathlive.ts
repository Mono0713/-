import type { MathfieldElement } from 'mathlive'

let loading: Promise<typeof MathfieldElement> | null = null

/** Loads the visual formula editor (MathLive) once, in the browser only. */
export function loadMathLive(): Promise<typeof MathfieldElement> {
  loading ??= import('mathlive').then(({ MathfieldElement }) => {
    MathfieldElement.fontsDirectory = '/mathlive/fonts'
    MathfieldElement.soundsDirectory = null
    return MathfieldElement
  })
  return loading
}

/** The formula's LaTeX without its empty slots, which would otherwise show as a red \placeholder. */
export function plain(field: MathfieldElement): string {
  return field.getValue('latex-without-placeholders')
}
