/**
 * Interface text in the reader's language. The Traditional Chinese text in the code is the key:
 * `t('匯入考卷')` looks it up in the reader's catalog (messages/<locale>.json) and falls back to the
 * key itself, so Traditional Chinese needs no catalog. `{name}` in the text is filled from `vars`.
 *
 * Only literal strings may be passed to `t` (the catalog check reads them from the source). Text kept
 * in a constant is marked with `msg('…')` and translated where it is shown, with `t(constant)`.
 */
export type Vars = Record<string, string | number>
export type T = (text: string, vars?: Vars) => string
export type Messages = Record<string, string>

export function fill(text: string, vars?: Vars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole))
}

export function makeT(messages: Messages): T {
  return (text, vars) => fill(messages[text] || text, vars)
}

/** Marks text kept in a constant for translation; returns it unchanged. */
export const msg = <S extends string>(text: S): S => text
