#!/usr/bin/env node
// Bundles src/ into one self-contained HTML file (dist/index.html):
// all JS, CSS, HTML fragments and fonts are inlined.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const DIST = join(here, 'dist', 'index.html');

export async function buildHtml({ out = DIST } = {}) {
  const res = await build({
    entryPoints: [join(here, 'src', 'main.js')],
    bundle: true, format: 'iife', write: false, outdir: join(here, 'dist'),
    loader: { '.html': 'text', '.woff2': 'dataurl' },
    target: 'chrome120', charset: 'utf8', logLevel: 'warning',
  });
  const pick = ext => res.outputFiles.find(f => f.path.endsWith(ext)).text;
  const html = readFileSync(join(here, 'src', 'shell.html'), 'utf8')
    .replace('/*CSS*/', () => pick('.css'))
    .replace('/*JS*/', () => pick('.js'));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await buildHtml();
  console.log(`built ${out} (${(readFileSync(out).length / 1024).toFixed(0)} KB)`);
}
