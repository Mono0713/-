// Copies files the browser loads at run time from node_modules into public/,
// which is not committed: the formula editor's fonts.
import { cpSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../node_modules/mathlive/fonts', import.meta.url))
const target = fileURLToPath(new URL('../public/mathlive/fonts', import.meta.url))
if (!existsSync(`${target}/KaTeX_Main-Regular.woff2`)) cpSync(source, target, { recursive: true })
