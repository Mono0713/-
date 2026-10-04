// Draws the app icons (home screen, Android, iOS) from the logo mark. Run after the mark changes:
//   node scripts/icons.mjs
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'

// sharp is installed for the figures package, which renders page crops.
const sharp = createRequire(new URL('../../../packages/figures/package.json', import.meta.url))('sharp')
const out = new URL('../public/icons/', import.meta.url)
mkdirSync(out, { recursive: true })

const PAPER = '#fcfcfa'
const INK = '#2F4BFF'
// The mark from src/app/icon.svg, fixed to the light colors (icons cannot follow dark mode).
const MARK = `<g transform="translate(-2 -1)"><path fill="${INK}" d="M14 8H38A6 6 0 0 1 44 14V30A20 20 0 0 0 30 50H14A6 6 0 0 1 8 44V14A6 6 0 0 1 14 8Z"/><circle cx="46" cy="47" r="8.5" stroke="${INK}" stroke-width="5" fill="none"/></g>`

/** A square icon: paper background (rounded unless full-bleed), mark taking `scale` of the side. */
function svg(size, { scale, rounded }) {
  const mark = size * scale
  const at = (size - mark) / 2
  const r = rounded ? size * 0.22 : 0
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" rx="${r}" fill="${PAPER}"/>
<g transform="translate(${at} ${at}) scale(${mark / 64})">${MARK}</g></svg>`
}

const ICONS = [
  ['icon-192.png', 192, { scale: 0.7, rounded: true }],
  ['icon-512.png', 512, { scale: 0.7, rounded: true }],
  // Android crops maskable icons to a circle or squircle; the mark stays inside the safe 80% circle.
  ['maskable-512.png', 512, { scale: 0.52, rounded: false }],
  // iOS rounds the corners itself.
  ['apple-touch-icon.png', 180, { scale: 0.66, rounded: false }],
]

for (const [name, size, opts] of ICONS) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(new URL(name, out).pathname)
  console.log('wrote', name)
}
