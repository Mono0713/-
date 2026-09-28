// FFmpeg side: a lossless per-chunk segment writer with motion blur, and the final encode.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { blurFilter } from './plan.mjs';

function ffmpeg(args) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, fail) => p.on('close', c => (c === 0 ? ok() : fail(new Error('ffmpeg exited ' + c)))));
  return { stdin: p.stdin, done };
}

/** Open a segment: write PNG subframes in order, then close() it. */
export function segmentWriter(file, { fps, sub }) {
  const ff = ffmpeg(['-f', 'image2pipe', '-framerate', String(fps * sub), '-c:v', 'png', '-i', '-',
    '-vf', blurFilter({ fps, sub }), '-r', String(fps), '-c:v', 'libx264rgb', '-crf', '0', '-preset', 'ultrafast', file]);
  return {
    write: buf => new Promise(ok => (ff.stdin.write(buf) ? ok() : ff.stdin.once('drain', ok))),
    close: () => { ff.stdin.end(); return ff.done; },
  };
}

/** Concatenate segments and encode the deliverable H.264 MP4 (BT.709, yuv420p). */
export async function encodeFinal(segments, out, { fps, crf, listFile }) {
  writeFileSync(listFile, segments.map(s => `file '${s}'`).join('\n'));
  const ff = ffmpeg(['-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-r', String(fps),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-tune', 'animation',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', out]);
  ff.stdin.end();
  await ff.done;
}
