import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createProvider, extractDocument, ManualProvider, mergePages, providerIds, type PageResult } from '@exam/extraction'
import { cropExamFigures } from '@exam/figures'
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
      --concurrency <n>  Pages in flight per provider (default: 2; use 1 on free tiers)
      --pages <list>     Only these pages, e.g. 3-5,7; other pages keep their earlier results
      --pages-only       Only render page images, do not call any model
      --lang <tag>       Language of the review notes, e.g. zh-Hant, en, ja (default: zh-Hant)
  -h, --help             Show this help

API keys come from the environment or a .env file in the repo root:
  ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY

Without an API key, use -p manual: the first run writes a prompt per page to
out/<file>/manual/; paste it with the page image into a chat app, save the
JSON reply as page-N.reply.json in the same folder, and run the command again.`

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      provider: { type: 'string', short: 'p', default: 'claude' },
      model: { type: 'string', short: 'm' },
      out: { type: 'string', short: 'o', default: 'out' },
      'max-edge': { type: 'string', default: '2000' },
      concurrency: { type: 'string', default: '2' },
      pages: { type: 'string' },
      'pages-only': { type: 'boolean', default: false },
      lang: { type: 'string' },
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
  const onlyPages = values.pages ? parsePageList(values.pages) : undefined

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
      const provider = createProvider(id, { model: values.model, workDir: join(dir, 'manual') })
      const started = Date.now()
      const fresh = await extractDocument(provider, doc, {
        concurrency,
        pages: onlyPages,
        reviewLanguage: values.lang,
        onPage: (r) => {
          const status = r.page
            ? `${r.page.questions.length} question(s)`
            : r.error?.startsWith('waiting for a reply')
              ? 'waiting for a pasted reply'
              : `FAILED (${r.error})`
          console.log(`  [${id}] page ${r.pageNumber}: ${status}`)
        },
      })
      const waiting = fresh.filter((r) => r.error?.startsWith('waiting for a reply')).map((r) => r.pageNumber)
      if (waiting.length && provider instanceof ManualProvider) {
        const batch = await provider.writeBatchPrompt()
        printManualSteps(join(dir, 'manual'), join(dir, 'pages'), waiting, batch)
      }
      const rawPath = join(dir, `${id}.raw.json`)
      const results = onlyPages ? await withEarlierPages(rawPath, fresh) : fresh
      const exam = mergePages(doc.fileName, results)
      await mkdir(join(dir, 'figures', id), { recursive: true })
      const cropFailures = await cropExamFigures(exam, doc.pages, async (name, png) => {
        const file = `figures/${id}/${name}.png`
        await writeFile(join(dir, file), png)
        return file
      })
      for (const f of cropFailures) console.log(`  could not crop figure ${f.name}: ${f.error}`)
      await writeFile(rawPath, JSON.stringify(results, null, 2))
      await writeFile(join(dir, `${id}.json`), JSON.stringify(exam, null, 2))
      await writeFile(join(dir, `${id}.md`), renderMarkdown(exam))

      const failed = results.filter((r) => !r.page && !r.error?.startsWith('waiting for a reply')).map((r) => r.pageNumber)
      if (failed.length) {
        console.log(`  [${id}] failed page(s): ${failed.join(', ')}. Re-run just those with --pages ${failed.join(',')}`)
      }
      const tokensIn = fresh.reduce((sum, r) => sum + (r.usage.inputTokens ?? 0), 0)
      const tokensOut = fresh.reduce((sum, r) => sum + (r.usage.outputTokens ?? 0), 0)
      const flagged = exam.questions.filter((q) => q.confidence !== 'high').length
      console.log(
        `  [${id}] ${exam.questions.length} question(s), ${flagged} flagged for review, ` +
          `${tokensIn} in / ${tokensOut} out tokens, ${((Date.now() - started) / 1000).toFixed(1)}s -> ${join(dir, `${id}.md`)}`,
      )
    }
  }
}

function printManualSteps(manualDir: string, pagesDir: string, pages: number[], batch: number[]) {
  if (batch.length) {
    console.log(`
  Manual mode, all pages in one message:
    1. Open a new chat in Claude, Gemini or ChatGPT.
    2. Attach ${batch.map((n) => `page-${n}.png`).join(', ')} from ${pagesDir} in that order,
       and paste the whole of ${join(manualDir, 'batch.prompt.md')}.
    3. Save the reply as ${join(manualDir, 'batch.reply.json')}.
  Or one page at a time: send page-N.png with page-N.prompt.md and save page-N.reply.json.
  Then run the same command again to validate the replies and build the result.`)
    return
  }
  console.log(`
  Manual mode: for each page ${pages.join(', ')}
    1. Open a new chat in Claude, Gemini or ChatGPT.
    2. Attach ${join(pagesDir, 'page-N.png')} and paste the whole of ${join(manualDir, 'page-N.prompt.md')}.
    3. Save the reply as ${join(manualDir, 'page-N.reply.json')}.
  Then run the same command again to validate the replies and build the result.`)
}

/** "3-5,7" -> [3, 4, 5, 7] */
function parsePageList(list: string): number[] {
  const pages = new Set<number>()
  for (const part of list.split(',')) {
    const [from, to = from] = part.split('-').map((n) => Number(n.trim()))
    if (!Number.isInteger(from) || !Number.isInteger(to) || from! < 1 || to! < from!) {
      throw new Error(`Invalid --pages value "${list}". Use e.g. 3-5,7`)
    }
    for (let n = from!; n <= to!; n++) pages.add(n)
  }
  return [...pages]
}

/** Replaces the re-run pages in an earlier run's results, keeping the rest. */
async function withEarlierPages(rawPath: string, fresh: PageResult[]): Promise<PageResult[]> {
  if (!existsSync(rawPath)) return fresh
  const earlier = JSON.parse(await readFile(rawPath, 'utf8')) as PageResult[]
  const byPage = new Map(earlier.map((r) => [r.pageNumber, r]))
  for (const r of fresh) byPage.set(r.pageNumber, r)
  return [...byPage.values()].sort((a, b) => a.pageNumber - b.pageNumber)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
