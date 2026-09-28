// The Sheetloop mark as a shared element: springs in (intro), flies into the window header,
// hands off to the header slot, then springs back for the outro.
import view from './view.html';
import './style.css';
import { $, put } from '../../core/dom.js';
import { E, clamp, ease, lerp, spring } from '../../core/math.js';
import { CUE, winMotion, outroFade, outroLogo } from '../../shared/timeline.js';
import { LOGO_BIG, SLOT, winToStage } from '../../shared/layout.js';
import { markSvg, spinLoop } from '../../shared/brand.js';

let el, loop;
export default {
  id: 'logo', layer: 'stage', view,
  mount() { el = $('flyLogo'); el.innerHTML = markSvg(); loop = el.querySelector('.loop'); },
  seek(t) {
    if (t < 10) {
      const win = winMotion(t);
      const ls = spring(t - CUE.logoIn, 1.4, .5), lf = ease(t, ...CUE.logoFly, E.inOut);
      const [sx, sy] = winToStage(win, SLOT.x, SLOT.y);
      put(el, {
        x: lerp(LOGO_BIG.x + 75 * (1 - ls), sx, lf), y: lerp(LOGO_BIG.y + 75 * (1 - ls), sy, lf),
        s: Math.max(lerp(ls, SLOT.s * win.s, lf), .0001), r: lerp(-16, 0, clamp(ls)) * (1 - lf),
        o: lf >= 1 ? 0 : clamp(ls * 4),
      });
      spinLoop(loop, lerp(-300, 0, ls) - 360 * lf);   // the loop winds up on entry and turns once in flight
    } else {
      const p = outroLogo(t);
      put(el, { x: 900 + 60 * (1 - p), y: 330 + 60 * (1 - p), s: Math.max(p * .8, .0001), r: lerp(14, 0, clamp(p)), o: clamp(p * 4) * (1 - outroFade(t)) });
      spinLoop(loop, lerp(-300, 0, p));
    }
  },
};
