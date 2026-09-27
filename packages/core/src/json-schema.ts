import { z } from 'zod'

type JsonSchema = { [key: string]: unknown }

/**
 * Converts a zod schema to a JSON Schema every provider's strict structured
 * output accepts: every object is closed and lists all its keys as required,
 * and draft metadata keywords are dropped.
 */
export function toStrictJsonSchema(schema: z.ZodType): JsonSchema {
  const raw = z.toJSONSchema(schema, { target: 'draft-7', io: 'output' }) as JsonSchema
  delete raw.$schema
  return tighten(raw) as JsonSchema
}

function tighten(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(tighten)
  if (node === null || typeof node !== 'object') return node
  const out: JsonSchema = {}
  for (const [key, value] of Object.entries(node)) out[key] = tighten(value)
  if (out.type === 'object' && out.properties && typeof out.properties === 'object') {
    out.additionalProperties = false
    out.required = Object.keys(out.properties)
  }
  return out
}
