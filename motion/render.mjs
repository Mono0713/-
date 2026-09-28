#!/usr/bin/env node
// Frame-by-frame renderer CLI. Builds dist/index.html from src/, then:
//
//   node render.mjs                     full render: 60fps, 4 subframes, motion blur
//   node render.mjs --draft             fast check: 30fps, no subframes, half size
//   node render.mjs --stills 1,3.5,7    single PNGs at the given seconds
//
// Pipeline: plan (render/plan.mjs) -> capture seek(t) screenshots (render/capture.mjs)
// -> FFmpeg tmix motion blur per chunk + final encode (render/encode.mjs).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHtml } from './build.mjs';
import { launch, openPage } from './render/capture.mjs';
import { segmentWriter, encodeFinal } from './render/encode.mjs';
import { chunks, subframeTimes } from './render/plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name, def) => { const i = argv.indexOf('--' + name); if (i < 0) return def; const v = argv[i + 1]; return v === undefined || v.startsWith('--') ? true : v; };

const draft = flag('draft', false) === true;
const opt = {
  fps: +flag('fps', draft ? 30 : 60),
  sub: +flag('sub', draft ? 1 : 4),
  shutter: +flag('shutter', 0.5),          // fraction of a frame the shutter is open (0.5 = 180°)
  scale: +flag('scale', draft ? 0.5 : 1),  // device pixel ratio; 2 = 3840x2160
  workers: +flag('workers', Math.max(1, Math.min(4, cpus().length))),
  from: +flag('from', 0),
  to: flag('to', null),
  crf: +flag('crf', 14),
  out: resolve(flag('out', join(here, 'out', draft ? 'draft.mp4' : 'motion.mp4'))),
};
const stills = flag('stills', null);

async function renderStills(html, list) {
  const browser = await launch();
  const { shot } = await openPage(browser, html, opt);
  const dir = join(here, 'out', 'stills');
  mkdirSync(dir, { recursive: true });
  for (const t of list) {
    const f = join(dir, `t${t.toFixed(2).padStart(5, '0')}.png`);
    writeFileSync(f, await shot(t));
    console.log(f);
  }
  await browser.close();
}

async function renderVideo(html) {
  const browser = await launch();
  const probe = await openPage(browser, html, opt);
  const end = opt.to === null ? probe.duration : +opt.to;
  await probe.page.close();
  const first = Math.round(opt.from * opt.fps), last = Math.round(end * opt.fps);
  const total = last - first;
  const tmp = join(dirname(opt.out), '.segments');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });

  let done = 0;
  const started = Date.now();
  const tick = () => {
    const rate = done / ((Date.now() - started) / 1000);
    process.stdout.write(`\r  frame ${done}/${total}  ${rate.toFixed(1)} fps  eta ${((total - done) / Math.max(rate, 1e-6)).toFixed(0)}s   `);
  };
  console.log(`rendering ${total} frames × ${opt.sub} subframes at ${1920 * opt.scale}x${1080 * opt.scale}, ${opt.workers} workers`);

  const segments = await Promise.all(chunks(first, last, opt.workers).map(async ([a, b], k) => {
    const { shot, page } = await openPage(browser, html, opt);
    const file = join(tmp, `seg${k}.mkv`);
    const seg = segmentWriter(file, opt);
    for (let f = a; f < b; f++) {
      for (const t of subframeTimes(f, opt)) await seg.write(await shot(t));
      done++; if (done % 10 === 0) tick();
    }
    await seg.close();
    await page.close();
    return file;
  }));
  await browser.close();
  tick(); console.log();

  await encodeFinal(segments, opt.out, { ...opt, listFile: join(tmp, 'list.txt') });
  rmSync(tmp, { recursive: true, force: true });
  console.log(`wrote ${opt.out} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

mkdirSync(dirname(opt.out), { recursive: true });
const html = await buildHtml();
if (stills) await renderStills(html, String(stills).split(',').map(Number));
else await renderVideo(html);
