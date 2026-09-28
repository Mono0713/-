// Scene 5: phone quiz. Phone springs up, a finger taps (B), it turns green, toast,
// explanation + translation expand, then the screen slides to the score ring.
import view from './view.html';
import './style.css';
import { $, qs, put, show } from '../../core/dom.js';
import { E, bezier, clamp, ease, lerp, mixRgb, prog, pulse, spring } from '../../core/math.js';
import { CUE } from '../../shared/timeline.js';

const RING = bezier(.3, 0, .1, 1);
const STATS = [1, .9, .75];
let r, lines, stats;
export default {
  id: 'mobile', layer: 'stage', view,
  mount() {
    r = Object.fromEntries(['mobile', 'mTxt', 'phone', 'finger', 'optB', 'mrip', 'ck', 'ckPath', 'toast', 'expl', 'explIn', 'mProg', 'mCount', 'scrA', 'scrB', 'ring', 'score']
      .map(id => [id, $(id)]));
    lines = qs('[data-m]', r.mTxt);
    stats = qs('[data-s]', r.scrB);
  },
  seek(t) {
    show(r.mobile, t > 13.5 && t < 18.1 ? 1 : 0);
    const out = ease(t, ...CUE.mobileOut, E.in);
    const ph = spring(t - 13.75, .95, .68);
    put(r.phone, { x: 1320 - 207, y: lerp(1000, 106, ph) - out * 70, r: lerp(14, 0, ph), s: 1 - .06 * out, o: (t > 13.75 ? 1 : 0) * (1 - out) });
    lines.forEach((el, i) => {
      const p = ease(t, 14.0 + i * .1, 14.9 + i * .1);
      put(el, { y: lerp(40, 0, p), x: -40 * out, o: p * (1 - out) });
    });
    put(r.mTxt, { o: 1 });

    // tap on (B)
    const fIn = ease(t, 14.35, 14.8), fOut = ease(t, 15.05, 15.35, E.in), tap = pulse(t, 14.78, 14.98);
    put(r.finger, { x: lerp(1560, 1330, fIn) - 32 + 60 * fOut, y: lerp(820, 515, fIn) - 32 + 90 * fOut, s: 1 - .18 * tap, o: fIn * (1 - fOut) });
    const ok = ease(t, 14.86, 15.1);
    r.optB.style.background = mixRgb([255, 255, 255], [229, 245, 238], ok);
    r.optB.style.borderColor = mixRgb([230, 226, 218], [31, 157, 107], ok);
    { const p = prog(t, 14.84, 15.5); put(r.mrip, { x: 200 - 20, y: 28 - 20, s: lerp(.5, 9, E.out(p)), o: p > 0 && p < 1 ? 1 - p : 0 }); }
    { const p = spring(t - 14.92, 2.2, .5); put(r.ck, { s: Math.max(p, .0001), o: clamp(p * 3) }); r.ckPath.setAttribute('stroke-dashoffset', (1 - ease(t, 15.0, 15.3)).toFixed(4)); }
    { const p = spring(t - 15.0, 1.8, .55), q = ease(t, 15.9, 16.15, E.in); put(r.toast, { y: lerp(-60, 60, p) - q * 120, s: lerp(.8, 1, clamp(p)) }); }
    { const p = ease(t, 15.1, 15.7); r.expl.style.height = (176 * p).toFixed(2) + 'px'; put(r.explIn, { y: lerp(-12, 0, p), o: ease(t, 15.25, 15.7) }); }
    put(r.mProg, { sx: lerp(3 / 14, 4 / 14, ease(t, 15.0, 15.5)) });
    r.mCount.textContent = t >= 15.0 ? '4 / 14' : '3 / 14';

    // results screen
    const sw = ease(t, 16.15, 16.75, E.inOut);
    put(r.scrA, { x: -390 * sw, o: 1 - .4 * sw }); put(r.scrB, { x: 390 * (1 - sw) });
    const ring = ease(t, 16.5, 17.4, RING);
    r.ring.setAttribute('stroke-dashoffset', (1 - .92 * ring).toFixed(4));
    r.score.textContent = Math.round(92 * ring);
    stats.forEach((el, i) => {
      const p = ease(t, 16.7 + i * .09, 17.4 + i * .09);
      put(el.querySelector('i'), { sx: Math.max(STATS[i] * p, .0001) }); put(el, { y: lerp(14, 0, p), o: clamp(p * 2) });
    });
  },
};
