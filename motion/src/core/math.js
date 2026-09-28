// Pure maths for motion. No DOM access, so it also runs under node:test.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
/** Linear 0..1 progress of t through [t0, t1]. */
export const prog = (t, t0, t1) => clamp((t - t0) / (t1 - t0));

/** CSS-style cubic-bezier easing, solved numerically for x. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = s => ((ax * s + bx) * s + cx) * s, dX = s => (3 * ax * s + 2 * bx) * s + cx;
  const Y = s => ((ay * s + by) * s + cy) * s;
  return p => {
    if (p <= 0) return 0; if (p >= 1) return 1;
    let s = p;
    for (let i = 0; i < 8; i++) { const d = dX(s); if (Math.abs(d) < 1e-6) break; s -= (X(s) - p) / d; }
    s = clamp(s);
    let lo = 0, hi = 1;
    for (let i = 0; i < 20 && Math.abs(X(s) - p) > 1e-6; i++) { if (X(s) < p) lo = s; else hi = s; s = (lo + hi) / 2; }
    return Y(s);
  };
}

/** Named easings used across the piece. */
export const E = {
  out: bezier(.16, 1, .3, 1),        // expo-like decel
  inOut: bezier(.65, 0, .35, 1),
  soft: bezier(.4, 0, .2, 1),
  in: bezier(.55, 0, .9, .45),
  sine: p => .5 - .5 * Math.cos(Math.PI * clamp(p)),
};

/** Analytic damped spring from 0 to 1. dt: seconds since start, f: Hz, z: damping ratio. */
export function spring(dt, f = 1.8, z = .6) {
  if (dt <= 0) return 0;
  const w = 2 * Math.PI * f;
  if (z >= 1) return 1 - Math.exp(-w * dt) * (1 + w * dt);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + (z * w / wd) * Math.sin(wd * dt));
}

/** Eased progress of t through [t0, t1]. */
export const ease = (t, t0, t1, fn = E.out) => fn(prog(t, t0, t1));
/** Half-sine pulse over [t0, t1]: 0 -> 1 -> 0, for presses and taps. */
export const pulse = (t, t0, t1) => Math.sin(Math.PI * prog(t, t0, t1));
/** Linear blend between two [r, g, b] colours, as a CSS rgb() string. */
export const mixRgb = (a, b, p) => `rgb(${lerp(a[0], b[0], p)},${lerp(a[1], b[1], p)},${lerp(a[2], b[2], p)})`;
