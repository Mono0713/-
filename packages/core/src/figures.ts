/** What a cleared figure blank shows when its printed text is unknown: its label, e.g. "7.". */
export function defaultPrintedText(label: string): string {
  return /^[\p{L}\p{N}]+$/u.test(label) ? `${label}.` : label
}
