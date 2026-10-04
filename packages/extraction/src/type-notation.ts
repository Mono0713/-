type Schema = { [key: string]: unknown }

/**
 * Renders a JSON Schema as short TypeScript-style type declarations for chat
 * prompts, where nothing enforces the schema and the raw JSON would be most of
 * the message. Object shapes used more than once (boxes, figures) are declared
 * once by name, and descriptions become // comments. The root is named `root`.
 */
export function typeNotation(schema: Schema, root: string): string {
  const counts = new Map<string, number>()
  const hint = new Map<string, string>()
  walk(schema, '', (node, key) => {
    if (node.type !== 'object') return
    const id = shapeId(node)
    counts.set(id, (counts.get(id) ?? 0) + 1)
    if (!hint.has(id)) hint.set(id, typeName(key))
  })

  const names = new Map<string, string>()
  const declarations: string[] = []
  const taken = new Set([root])
  const declare = (node: Schema): string => {
    const id = shapeId(node)
    const known = names.get(id)
    if (known) return known
    let name = hint.get(id) || 'Item'
    for (let n = 2; taken.has(name); n++) name = `${hint.get(id) || 'Item'}${n}`
    taken.add(name)
    names.set(id, name)
    declarations.push(`type ${name} = ${objectType(node, '')}`)
    return name
  }

  const typeOf = (node: Schema, indent: string): string => {
    if (Array.isArray(node.anyOf)) return (node.anyOf as Schema[]).map((n) => typeOf(n, indent)).join(' | ')
    if (Array.isArray(node.enum)) return (node.enum as unknown[]).map((v) => JSON.stringify(v)).join(' | ')
    if (Array.isArray(node.type)) return (node.type as string[]).map((t) => typeOf({ ...node, type: t }, indent)).join(' | ')
    switch (node.type) {
      case 'object':
        return (counts.get(shapeId(node)) ?? 0) > 1 ? declare(node) : objectType(node, indent)
      case 'array': {
        const item = typeOf(node.items as Schema, indent)
        return /^[\w"]+$/.test(item) ? `${item}[]` : `Array<${item}>`
      }
      case 'integer':
        return 'integer'
      default:
        return String(node.type)
    }
  }

  const objectType = (node: Schema, indent: string): string => {
    const props = Object.entries((node.properties ?? {}) as Record<string, Schema>)
    const inner = `${indent}  `
    const lines = props.map(([key, prop]) => {
      const note = typeof prop.description === 'string' ? ` // ${prop.description}` : ''
      return `${inner}${key}: ${typeOf(prop, inner)}${note}`
    })
    const flat = `{ ${props.map(([key, prop]) => `${key}: ${typeOf(prop, inner)}`).join('; ')} }`
    return lines.some((l) => l.includes('//') || l.includes('\n')) || flat.length > 80 ? `{\n${lines.join('\n')}\n${indent}}` : flat
  }

  const body = objectType(schema, '')
  return [...declarations, `type ${root} = ${body}`].join('\n\n')
}

function walk(node: unknown, key: string, visit: (node: Schema, key: string) => void) {
  if (!node || typeof node !== 'object') return
  const schema = node as Schema
  visit(schema, key)
  for (const [k, v] of Object.entries((schema.properties ?? {}) as Record<string, unknown>)) walk(v, k, visit)
  if (schema.items) walk(schema.items, key, visit)
  for (const v of (schema.anyOf as unknown[] | undefined) ?? []) walk(v, key, visit)
}

/** Identity of an object shape, ignoring the description attached where it is used. */
function shapeId(node: Schema): string {
  const { description: _, ...shape } = node
  return JSON.stringify(shape)
}

/** "figures" → "Figure", "bbox" → "Box". */
function typeName(key: string): string {
  if (key === 'bbox') return 'Box'
  const singular = key.endsWith('s') ? key.slice(0, -1) : key
  return singular.charAt(0).toUpperCase() + singular.slice(1)
}
