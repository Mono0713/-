// Scene 2 pointer: glides between waypoints on a slight bow and leaves a ripple on each click.
import view from './view.html';
import './style.css';
import { $, put } from '../../core/dom.js';
import { E, ease, lerp, prog, pulse } from '../../core/math.js';
import { CUE } from '../../shared/timeline.js';

// [time, x, y] of the pointer tip on stage
const PATH = [[3.75, 1560, 1040], [4.25, 1500, 420], [4.95, 1470, 640], [5.9, 1520, 700]];
const CLICKS = [{ t: CUE.clickModel - .04, x: 1500, y: 420 }, { t: CUE.clickStart[0] + .02, x: 1470, y: 640 }];

export function cursorAt(t) {
  if (t <= PATH[0][0]) return [PATH[0][1], PATH[0][2]];
  for (let i = 0; i < PATH.length - 1; i++) {
    const [t0, x0, y0] = PATH[i], [t1, x1, y1] = PATH[i + 1];
    if (t <= t1) { const p = E.inOut(prog(t, t0, t1)), bow = Math.sin(Math.PI * p) * 40; return [lerp(x0, x1, p) + bow, lerp(y0, y1, p)]; }
  }
  const last = PATH[PATH.length - 1];
  return [last[1], last[2]];
}

let cursor, rip;
export default {
  id: 'cursor', layer: 'app', view,
  mount() {
    cursor = $('cursor'); rip = $('rip');
    rip.style.width = rip.style.height = '80px';
  },
  seek(t) {
    const [x, y] = cursorAt(t);
    const on = ease(t, 3.75, 4.0) * (1 - ease(t, 5.6, 5.9));
    const click = Math.max(pulse(t, 4.22, 4.38), pulse(t, 5.08, 5.26));
    put(cursor, { x, y, s: 1 - .14 * click, o: on });
    const c = t >= CUE.clickStart[0] ? CLICKS[1] : CLICKS[0];
    const rt = t - c.t, p = prog(rt, 0, .55);
    rip.style.left = (c.x + 6 - 40) + 'px'; rip.style.top = (c.y + 6 - 40) + 'px';
    put(rip, { s: lerp(.2, 1.2, E.out(p)), o: rt > 0 && p < 1 ? (1 - p) * .9 * on : 0 });
  },
};
