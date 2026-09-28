// Pure planning: which subframe times to shoot and how to split the work.

/**
 * Times of the subframes that make up output frame f. They are centred on the
 * frame time and spread evenly over `shutter` of a frame (0.5 = 180° shutter).
 */
export function subframeTimes(f, { fps, sub, shutter }) {
  return Array.from({ length: sub }, (_, i) => (f + ((i + 0.5) / sub - 0.5) * shutter) / fps);
}

/** Split frames [first, last) into up to n contiguous, non-empty chunks. */
export function chunks(first, last, n) {
  const per = Math.ceil((last - first) / n);
  return Array.from({ length: n }, (_, k) => [first + k * per, Math.min(last, first + (k + 1) * per)]).filter(([a, b]) => b > a);
}

/** FFmpeg filter chain: average each group of `sub` subframes, keep one frame per group. */
export function blurFilter({ fps, sub }) {
  const retime = `setpts=N/(${fps}*TB)`;
  if (sub <= 1) return retime;
  return [`tmix=frames=${sub}:weights=${Array(sub).fill(1).join(' ')}`, `select=eq(mod(n\\,${sub})\\,${sub - 1})`, retime].join(',');
}
