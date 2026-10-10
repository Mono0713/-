/**
 * Checks the interface text: every t('…') / msg('…') key in the source, which catalogs lack
 * translations, and Chinese text left outside t() (it would not be translated).
 *
 *   pnpm i18n                 report (from the repo root)
 *   pnpm i18n missing         every key some catalog lacks, as a fill-in template:
 *                             { "中文": { "en": "", "ja": "", … } } with only the languages that lack it
 *   pnpm i18n missing en      the keys en.json lacks, as a JSON list
 *   pnpm i18n add <file>      merge a filled-in template into every catalog (checks {placeholders} and <tags>)
 *   pnpm i18n prune           drop translations the code no longer uses
 *
 * Adding interface text: write t('中文') in the code, run `pnpm i18n missing > /tmp/new.json`,
 * fill in the translations, then `pnpm i18n add /tmp/new.json`. No need to open the catalogs.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { join, relative } from 'node:path'
import ts from 'typescript'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')
export const MESSAGES = join(SRC, 'shared/i18n/messages')
export const TARGETS = ['zh-Hans', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'vi', 'th', 'id'] as const

const CJK = /[㐀-鿿豈-﫿]/
const MARKERS = new Set(['t', 'msg'])

export interface Scan {
  keys: Map<string, string[]>
  /** Chinese text not passed through t() or msg(). */
  leftovers: string[]
  /** t() given something the check cannot read, e.g. a template with ${…}. */
  problems: string[]
}

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return files(p)
    return /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts') ? [p] : []
  })
}

export function scan(dir = SRC): Scan {
  const keys = new Map<string, string[]>()
  const leftovers: string[] = []
  const problems: string[] = []
  for (const file of files(dir)) {
    const text = readFileSync(file, 'utf8')
    if (text.includes('i18n-ignore-file')) continue
    const lines = text.split('\n')
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const where = (node: ts.Node) => `${relative(ROOT, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`
    const ignored = (node: ts.Node) => {
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line
      return lines[line]?.includes('i18n-ignore') || lines[line - 1]?.trim() === '// i18n-ignore'
    }
    const isKey = (node: ts.Node) => {
      const call = node.parent
      return ts.isCallExpression(call) && call.arguments[0] === node && ts.isIdentifier(call.expression) && MARKERS.has(call.expression.text)
    }
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && MARKERS.has(node.expression.text)) {
        const arg = node.arguments[0]
        if (arg && !ts.isStringLiteral(arg) && !ts.isNoSubstitutionTemplateLiteral(arg) && ts.isTemplateExpression(arg)) problems.push(`${where(arg)} t() with \${…}: use {name} and vars`)
      }
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (isKey(node)) keys.set(node.text, [...(keys.get(node.text) ?? []), where(node)])
        else if (CJK.test(node.text) && !ignored(node)) leftovers.push(`${where(node)} ${node.text.slice(0, 40)}`)
      } else if (ts.isTemplateExpression(node)) {
        const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join('…')
        if (CJK.test(parts) && !ignored(node)) leftovers.push(`${where(node)} ${parts.slice(0, 40)}`)
      } else if (ts.isJsxText(node)) {
        if (CJK.test(node.text) && !ignored(node)) leftovers.push(`${where(node)} ${node.text.trim().slice(0, 40)}`)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return { keys, leftovers, problems }
}

export const catalog = (locale: string): Record<string, string> => JSON.parse(readFileSync(join(MESSAGES, `${locale}.json`), 'utf8'))
const save = (locale: string, messages: Record<string, string>) => writeFileSync(join(MESSAGES, `${locale}.json`), JSON.stringify(messages, null, 2) + '\n')

const names = (text: string) => [...text.matchAll(/\{(\w+)\}|<(\w+)>/g)].map((m) => m[1] ?? `<${m[2]}>`).sort().join(',')

/** Keys a catalog lacks, keys it has that the code no longer uses, and translations whose {placeholders} or <tags> differ from the key's. */
export function compare(keys: Iterable<string>, messages: Record<string, string>) {
  const wanted = new Set(keys)
  return {
    missing: [...wanted].filter((k) => !messages[k]),
    unused: Object.keys(messages).filter((k) => !wanted.has(k)),
    mismatched: Object.entries(messages).filter(([k, v]) => wanted.has(k) && names(k) !== names(v)).map(([k]) => k),
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const result = scan()
  const [command, arg] = process.argv.slice(2)
  if (command === 'missing' && arg) {
    console.log(JSON.stringify(compare(result.keys.keys(), catalog(arg)).missing, null, 2))
  } else if (command === 'missing') {
    const template: Record<string, Record<string, string>> = {}
    for (const l of TARGETS) for (const k of compare(result.keys.keys(), catalog(l)).missing) (template[k] ??= {})[l] = ''
    console.log(JSON.stringify(template, null, 2))
  } else if (command === 'add') {
    if (!arg) throw new Error('usage: pnpm i18n add <file.json>')
    const filled: Record<string, Record<string, string>> = JSON.parse(readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), arg), 'utf8'))
    const errors: string[] = []
    for (const l of TARGETS) {
      const messages = catalog(l)
      let added = 0
      for (const [key, byLocale] of Object.entries(filled)) {
        const text = byLocale[l]
        if (!text) continue
        if (names(key) !== names(text)) errors.push(`${l}: "${key}" → "${text}" has different {placeholders} or <tags>`)
        else (messages[key] = text), added++
      }
      if (added) save(l, messages)
      console.log(`${l}: ${added} added`)
    }
    if (errors.length) {
      console.error(errors.join('\n'))
      process.exitCode = 1
    }
  } else if (command === 'prune') {
    for (const l of TARGETS) {
      const messages = catalog(l)
      const { unused } = compare(result.keys.keys(), messages)
      for (const k of unused) delete messages[k]
      if (unused.length) save(l, messages)
      console.log(`${l}: ${unused.length} removed`)
    }
  } else {
    console.log(`${result.keys.size} keys`)
    for (const l of TARGETS) {
      const c = compare(result.keys.keys(), catalog(l))
      console.log(`${l}: ${c.missing.length} missing, ${c.unused.length} unused, ${c.mismatched.length} mismatched`)
    }
    console.log(`${result.leftovers.length} Chinese texts outside t():`)
    for (const l of result.leftovers.slice(0, 60)) console.log('  ' + l)
    for (const p of result.problems) console.log('  ' + p)
  }
}
