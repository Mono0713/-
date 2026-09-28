import test from 'node:test';
import assert from 'node:assert/strict';
import { CUE, DURATION, SCENES } from '../src/shared/timeline.js';
import { boxT, sweepHit, QB, BOXES } from '../src/shared/layout.js';

test('scenes and cues fit inside the piece', () => {
  for (const [k, [a, b]] of Object.entries(SCENES)) assert.ok(a >= 0 && b <= DURATION && a < b, k);
  for (const [k, v] of Object.entries(CUE)) for (const x of [].concat(v)) assert.ok(x >= 0 && x <= DURATION, k);
});
test('the beam reaches the question boxes top to bottom, inside the beam window', () => {
  assert.equal(boxT.length, QB.length);
  boxT.forEach((t, i) => { assert.ok(t >= CUE.beam[0] && t <= CUE.beam[1]); if (i) assert.ok(t > boxT[i - 1]); });
});
test('the eraser reaches every answer inside the sweep window', () => {
  BOXES.forEach((_, i) => { const t = sweepHit(i); assert.ok(t >= CUE.sweep[0] && t <= CUE.sweep[1]); });
});
