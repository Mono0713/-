// Scene 6: wordmark and the four-step flow (上傳 · 辨識 · 校對 · 測驗), then a fade
// back to the empty background so the piece loops.
import view from './view.html';
import './style.css';
import { $, put, show, letters } from '../../core/dom.js';
import { E, clamp, ease, lerp, spring } from '../../core/math.js';
import { outroFade } from '../../shared/timeline.js';
import { BRAND } from '../../shared/brand.js';

const STEPS = [
  ['上傳', '#2F5BE0', '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'],
  ['辨識', '#7B5CF0', '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/>'],
  ['校對', '#C77A12', '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>'],
  ['測驗', '#1F9D6B', '<path d="M5 12.5l4.5 4.5L19 7.5"/>'],
];
const STEP_X = [560, 790, 1020, 1250];   // left edges; pills are ~140px wide

let root, chars, line, steps;
export default {
  id: 'outro', layer: 'stage', view,
  mount() {
    root = $('outro'); line = $('stepLine');
    root.style.transformOrigin = '960px 540px';
    chars = letters($('outWord'), BRAND.name);
    steps = STEPS.map(([name, col, icon], i) => {
      const d = document.createElement('div'); d.className = 'step abs';
      d.innerHTML = `<span class="si" style="background:${col}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></span>${name}`;
      d.style.left = STEP_X[i] + 'px';
      $('steps').appendChild(d); return d;
    });
  },
  seek(t) {
    const fade = outroFade(t);
    chars.forEach((c, i) => {
      const p = ease(t, 17.95 + i * .06, 18.7 + i * .06);
      put(c, { y: lerp(90, 0, p), o: p * (1 - fade) });
    });
    line.setAttribute('d', `M640 32H${lerp(640, 1320, ease(t, 18.25, 19.0, E.inOut)).toFixed(1)}`);
    show(line, 1 - fade);
    steps.forEach((el, i) => {
      const p = spring(t - 18.3 - i * .12, 1.9, .55);
      put(el, { y: lerp(26, 0, clamp(p)), s: Math.max(lerp(.6, 1, p), .0001), o: clamp(p * 2.5) * (1 - fade) });
    });
    put(root, { s: 1 - .02 * fade });
  },
};
