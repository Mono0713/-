import test from 'node:test';
import assert from 'node:assert/strict';
import { E, bezier, clamp, prog, spring } from '../src/core/math.js';

test('prog clamps to 0..1', () => {
  assert.equal(prog(-1, 0, 2), 0); assert.equal(prog(1, 0, 2), .5); assert.equal(prog(5, 0, 2), 1);
});
test('easings hit their endpoints and stay monotonic', () => {
  for (const [name, fn] of Object.entries(E)) {
    assert.equal(fn(0), 0, name); assert.ok(Math.abs(fn(1) - 1) < 1e-9, name);
    let prev = -1;
    for (let p = 0; p <= 1.0001; p += .01) { const v = fn(clamp(p)); assert.ok(v >= prev - 1e-9, `${name} at ${p}`); prev = v; }
  }
});
test('bezier(0,0,1,1) is linear', () => {
  const lin = bezier(0, 0, 1, 1);
  for (const p of [.1, .37, .5, .9]) assert.ok(Math.abs(lin(p) - p) < 1e-5);
});
test('spring starts at 0, overshoots when underdamped, settles at 1', () => {
  assert.equal(spring(0), 0); assert.equal(spring(-1), 0);
  let max = 0; for (let t = 0; t < 2; t += .005) max = Math.max(max, spring(t, 1.8, .5));
  assert.ok(max > 1.05);
  assert.ok(Math.abs(spring(10, 1.8, .5) - 1) < 1e-6);
  assert.ok(Math.abs(spring(10, 1.8, 1) - 1) < 1e-6);
});
