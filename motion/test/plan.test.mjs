import test from 'node:test';
import assert from 'node:assert/strict';
import { blurFilter, chunks, subframeTimes } from '../render/plan.mjs';

test('subframes are centred on the frame time and span the shutter', () => {
  const ts = subframeTimes(60, { fps: 60, sub: 4, shutter: .5 });
  assert.equal(ts.length, 4);
  const mean = ts.reduce((a, b) => a + b) / 4;
  assert.ok(Math.abs(mean - 1) < 1e-12);
  assert.ok(Math.abs((ts[3] - ts[0]) - .375 / 60) < 1e-12);   // 3/4 of a half-frame shutter
  assert.deepEqual(subframeTimes(30, { fps: 30, sub: 1, shutter: .5 }), [1]);
});
test('chunks cover the range exactly once', () => {
  for (const [a, b, n] of [[0, 1200, 4], [0, 7, 4], [10, 11, 3]]) {
    const cs = chunks(a, b, n);
    assert.equal(cs[0][0], a); assert.equal(cs.at(-1)[1], b);
    for (let i = 1; i < cs.length; i++) assert.equal(cs[i][0], cs[i - 1][1]);
    assert.ok(cs.every(([x, y]) => y > x));
  }
});
test('blur filter keeps the last subframe of every group', () => {
  assert.match(blurFilter({ fps: 60, sub: 4 }), /^tmix=frames=4:weights=1 1 1 1,select=eq\(mod\(n\\,4\)\\,3\),setpts=N\/\(60\*TB\)$/);
  assert.equal(blurFilter({ fps: 30, sub: 1 }), 'setpts=N/(30*TB)');
});
