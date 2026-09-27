import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createProvider, extractDocument, mergePages, providerIds } from '@exam/extraction'
import { ingestFile } from '@exam/ingest'
import { renderMarkdown } from './markdown.ts'

const HELP = `Extract exam questions from PDFs and images.

Usage:
  pnpm extract <file...> [options]

Options:
  -p, --provider <ids>   Comma-separated providers to run: ${providerIds().join(', ')} (default: claude)
  -m, --model <id>       Model override; only valid with a single provider
  -o, --out <dir>        Output directory (default: out)
      --max-edge <px>    Longest edge of page images (default: 2000)
      --concurrency <n>  Pages in flight per provider (default: 2)
      --pages-only       Only render page images, do not call any model
  -h, --help             Show this help

API keys come from the environment or a .env file in the repo root:
  ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY`

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      provider: { type: 'string', short: 'p', default: 'claude' },
      model: { type: 'string', short: 'm' },
      out: { type: 'string', short: 'o', default: 'out' },
      'max-edge': { type: 'string', default: '2000' },
      concurrency: { type: 'string', default: '2' },
      'pages-only': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  if (values.help || positionals.length === 0) {
    console.log(HELP)
    process.exit(values.help ? 0 : 1)
  }

  const envFile = resolve(import.meta.dirname, '../../../.env')
  if (existsSync(envFile)) process.loadEnvFile(envFile)

  const providers = values.provider.split(',').map((id) => id.trim()).filter(Boolean)
  if (values.model && providers.length > 1) throw new Error('--model can only be used with a single --provider')
  const outDir = resolve(process.env.INIT_CWD ?? process.cwd(), values.out)
  const maxEdge = Number(values['max-edge'])
  const concurrency = Number(values.concurrency)

  for (const input of positionals) {
    const path = resolve(process.env.INIT_CWD ?? process.cwd(), input)
    const stem = basename(path, extname(path))
    const dir = join(outDir, stem)
    await mkdir(join(dir, 'pages'), { recursive: true })

    console.log(`\n${basename(path)}`)
    const doc = await ingestFile(path, { maxEdge })
    for (const page of doc.pages) {
      await writeFile(join(dir, 'pages', `page-${page.pageNumber}.png`), page.data)
    }
    console.log(`  ${doc.pages.length} page(s) rendered to ${join(dir, 'pages')}`)
    if (values['pages-only']) continue

    for (const id of providers) {
      const provider = createProvider(id, { model: values.model })
      const started = Date.now()
      const results = await extractDocument(provider, doc, {
        concurrency,
        onPage: (r) =>
          console.log(
            `  [${id}] page ${r.pageNumber}: ${r.page ? `${r.page.questions.length} question(s)` : `FAILED (${r.error})`}`,
          ),
      })
      const exam = mergePages(doc.fileName, results)
      await writeFile(join(dir, `${id}.raw.json`), JSON.stringify(results, null, 2))
      await writeFile(join(dir, `${id}.json`), JSON.stringify(exam, null, 2))
      await writeFile(join(dir, `${id}.md`), renderMarkdown(exam))

      const tokensIn = results.reduce((sum, r) => sum + (r.usage.inputTokens ?? 0), 0)
      const tokensOut = results.reduce((sum, r) => sum + (r.usage.outputTokens ?? 0), 0)
      const flagged = exam.questions.filter((q) => q.confidence !== 'high').length
      console.log(
        `  [${id}] ${exam.questions.length} question(s), ${flagged} flagged for review, ` +
          `${tokensIn} in / ${tokensOut} out tokens, ${((Date.now() - started) / 1000).toFixed(1)}s -> ${join(dir, `${id}.md`)}`,
      )
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
