import { z } from 'zod'

type JsonSchema = { [key: string]: unknown }

/**
 * Converts a zod schema to a JSON Schema every provider's strict structured
 * output accepts: every object is closed and lists all its keys as required,
 * and draft metadata keywords and defaults (kept only to read older replies) are dropped.
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
  for (const [key, value] of Object.entries(node)) {
    if (key === 'properties' && value && typeof value === 'object') {
      out[key] = Object.fromEntries(Object.entries(value).map(([name, prop]) => [name, tighten(prop)]))
    } else if (key !== 'default') {
      out[key] = tighten(value)
    }
  }
  if (out.type === 'object' && out.properties && typeof out.properties === 'object') {
    out.additionalProperties = false
    out.required = Object.keys(out.properties)
  }
  return out
}

/**
 * The value a strict schema node can be left out for: null when it is nullable, false for
 * a boolean, an empty list for an array. Anything else must always be written.
 */
function emptyValue(node: JsonSchema): { value: unknown } | null {
  const types = Array.isArray(node.type) ? node.type : [node.type]
  const anyOf = Array.isArray(node.anyOf) ? (node.anyOf as JsonSchema[]) : []
  if (types.includes('null') || anyOf.some((n) => n.type === 'null') || (Array.isArray(node.enum) && node.enum.includes(null))) return { value: null }
  if (node.type === 'boolean') return { value: false }
  if (node.type === 'array') return { value: [] }
  return null
}

/**
 * A strict schema where fields that are null, false or an empty list may be left out, for
 * models that read the schema in the prompt: they write noticeably less. `fillLeftOut` puts
 * those fields back before the reply is checked against the strict schema.
 */
export function withOptionalEmpties(schema: JsonSchema): JsonSchema {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (node === null || typeof node !== 'object') return node
    const out: JsonSchema = {}
    for (const [key, value] of Object.entries(node)) out[key] = key === 'properties' ? Object.fromEntries(Object.entries(value as JsonSchema).map(([k, v]) => [k, walk(v)])) : walk(value)
    if (out.type === 'object' && out.properties && Array.isArray(out.required)) {
      const props = out.properties as Record<string, JsonSchema>
      out.required = (out.required as string[]).filter((name) => !emptyValue(props[name]!))
    }
    return out
  }
  return walk(schema) as JsonSchema
}

/** Adds back the fields a reply left out because they were null, false or an empty list. */
export function fillLeftOut(value: unknown, schema: JsonSchema): unknown {
  if (Array.isArray(value)) return schema.items ? value.map((item) => fillLeftOut(item, schema.items as JsonSchema)) : value
  if (value === null || typeof value !== 'object' || !schema.properties) return value
  const props = schema.properties as Record<string, JsonSchema>
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) }
  for (const [name, prop] of Object.entries(props)) {
    if (out[name] === undefined) {
      const empty = emptyValue(prop)
      if (empty) out[name] = empty.value
    } else {
      out[name] = fillLeftOut(out[name], prop)
    }
  }
  return out
}
