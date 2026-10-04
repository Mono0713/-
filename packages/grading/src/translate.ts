import { z } from 'zod'
import type { TextModel } from './model.ts'
import { LANGUAGE_NAMES } from './teacher.ts'

/** A question's stem and option texts in the reader's language, options in their original order. */
export interface Translation {
  stem: string
  options: string[]
}

const Reply = z.object({ stem: z.string(), options: z.array(z.string()).default([]) })

/** Translates one question for a reader who does not read its language well, keeping maths and blanks as they are. */
export class AiTranslator {
  constructor(private readonly model: TextModel) {}

  async translate(q: { stem: string; options: { label: string; content: string }[] }, language: string): Promise<Translation> {
    const lines = [`Stem:\n${q.stem}`, ...q.options.map((o, i) => `Option ${i + 1} (${o.label}):\n${o.content}`)]
    const text = await this.model.complete(systemPrompt(LANGUAGE_NAMES[language] ?? language), lines.join('\n\n'))
    return parseTranslation(text, q.options.length)
  }
}

/** The translation from the JSON asked for; one option text per option, empty where the model left one out. */
export function parseTranslation(text: string, optionCount: number): Translation {
  const start = text.indexOf('{')
  if (start < 0) throw new Error('The translation was not JSON')
  const reply = Reply.parse(JSON.parse(text.slice(start, text.lastIndexOf('}') + 1)))
  if (!reply.stem.trim()) throw new Error('The translation was empty')
  return { stem: reply.stem.trim(), options: Array.from({ length: optionCount }, (_, i) => reply.options[i]?.trim() ?? '') }
}

function systemPrompt(language: string): string {
  return `Translate one exam question into ${language} for a student who reads ${language} better than the question's language.

- Translate the stem and every option faithfully. Do not answer, hint at or explain the question.
- Keep maths ($...$, $$...$$), code, chemical formulas, units, numbers and blanks (____) exactly as they are.
- Keep technical terms accurate; when a term is usually left untranslated, add the original in brackets once.
- Keep Markdown such as line breaks, lists and tables.

Reply with JSON only: {"stem":"...","options":["...", "..."]} with one entry per option, in the order given (an empty list when there are no options).`
}

/** Reader languages as the free services name them. */
const FREE_CODES: Record<string, string> = { 'zh-Hant': 'zh-TW', 'zh-Hans': 'zh-CN', en: 'en', ja: 'ja', ko: 'ko' }

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

/**
 * Translates with free services that need no key: Google Translate's public endpoint first,
 * MyMemory when Google refuses. Maths and code are swapped for placeholders so they come back as written.
 */
export class FreeTranslator {
  constructor(private readonly fetcher: Fetch = fetch as unknown as Fetch) {}

  async translate(q: { stem: string; options: { label: string; content: string }[] }, language: string): Promise<Translation> {
    const target = FREE_CODES[language] ?? language
    const [stem = '', ...options] = await Promise.all([q.stem, ...q.options.map((o) => o.content)].map((text) => this.one(text, target)))
    if (!stem.trim()) throw new Error('The translation was empty')
    return { stem, options }
  }

  private async one(text: string, target: string): Promise<string> {
    if (!text.trim()) return ''
    const { masked, kept } = protect(text)
    // nothing left to translate once maths and code are set aside
    if (!/\p{L}{2,}/u.test(masked.replace(/\{\d+\}/g, ''))) return text
    let out: string
    try {
      out = await this.google(masked, target)
    } catch {
      out = await this.myMemory(masked, target)
    }
    return restore(out, kept)
  }

  private async get(url: string): Promise<unknown> {
    const res = await this.fetcher(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`Translation service answered ${res.status}`)
    return res.json()
  }

  private async google(text: string, target: string): Promise<string> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`
    return parseGoogle(await this.get(url))
  }

  private async myMemory(text: string, target: string): Promise<string> {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceOf(text)}|${encodeURIComponent(target)}`
    return parseMyMemory(await this.get(url))
  }
}

/** Google's reply: sentence pieces as [translated, original, …] in its first list. */
export function parseGoogle(body: unknown): string {
  const pieces = Array.isArray(body) && Array.isArray(body[0]) ? (body[0] as unknown[]) : []
  const text = pieces.map((p) => (Array.isArray(p) && typeof p[0] === 'string' ? p[0] : '')).join('')
  if (!text.trim()) throw new Error('Google returned no translation')
  return text
}

export function parseMyMemory(body: unknown): string {
  const reply = body as { responseStatus?: number | string; responseData?: { translatedText?: string } }
  const text = reply?.responseData?.translatedText
  if (Number(reply?.responseStatus) !== 200 || !text?.trim()) throw new Error('MyMemory returned no translation')
  return text
}

/** MyMemory needs the source language; guessed from the script. */
function sourceOf(text: string): string {
  if (/[぀-ヿ]/.test(text)) return 'ja'
  if (/[가-힯]/.test(text)) return 'ko'
  if (/\p{Script=Han}/u.test(text)) return 'zh-TW'
  return 'en'
}

const KEEP = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|`[^`\n]+`|_{3,}/g

/** Swaps maths, inline code and blanks for {0}, {1}, … */
export function protect(text: string): { masked: string; kept: string[] } {
  const kept: string[] = []
  const masked = text.replace(KEEP, (m) => `{${kept.push(m) - 1}}`)
  return { masked, kept }
}

export function restore(text: string, kept: string[]): string {
  return text.replace(/\{\s*(\d+)\s*\}/g, (m, i: string) => kept[Number(i)] ?? m)
}
