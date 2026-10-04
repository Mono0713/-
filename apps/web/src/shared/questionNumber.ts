/** "11(a)" → { main: "11", part: "a" }; a plain number has no part. */
export function splitNumber(number: string): { main: string; part: string | null } {
  const m = number.match(/^(.*?)\s*[(（]([^()（）]+)[)）]$/)
  return m && m[1] ? { main: m[1], part: m[2]! } : { main: number, part: null }
}
