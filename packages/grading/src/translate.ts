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
