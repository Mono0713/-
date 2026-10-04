/**
 * Checks the interface text: every t('…') / msg('…') key in the source, which catalogs lack
 * translations, and Chinese text left outside t() (it would not be translated).
 *
 *   npx tsx scripts/i18n.ts            report
 *   npx tsx scripts/i18n.ts missing en  print the keys en.json lacks, as JSON
 */
import { readdirSync, readFileSync } from 'node:fs'
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
  if (process.argv[2] === 'missing') {
    console.log(JSON.stringify(compare(result.keys.keys(), catalog(process.argv[3]!)).missing, null, 2))
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
