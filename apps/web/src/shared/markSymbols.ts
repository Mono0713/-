const CIRCLE = /[○◯〇∘◦⭕Oo０]/
const CROSS = /[╳✕✗✘×xXＸ❌]/

/**
 * 「對的畫 ○，錯的畫 ╳」: the AI writes these marks with whatever symbol it likes, and the
 * fonts draw them at very different sizes. After 畫/打/劃 they become the full-width Ｏ and Ｘ,
 * which match the Chinese text around them.
 */
export function markSymbols(text: string): string {
  return text.replace(/([畫打劃画])\s*([^\s，,、）)])(?=[\s，,、；;）)。.]|$)/g, (all, verb: string, mark: string) =>
    CIRCLE.test(mark) ? `${verb} Ｏ` : CROSS.test(mark) ? `${verb} Ｘ` : all,
  )
}
