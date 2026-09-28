// The app window and its upload screen (scene 2): header chrome, drop zone,
// model picker and the 開始辨識 button.
import view from './view.html';
import './style.css';
import { $, put, show } from '../../core/dom.js';
import { E, clamp, ease, lerp, mixRgb, pulse, spring } from '../../core/math.js';
import { CUE, winMotion } from '../../shared/timeline.js';
import { BRAND, markSvg } from '../../shared/brand.js';

const GREY = [214, 209, 200], BLUE = [47, 91, 224];
let r;
export default {
  id: 'app-window', layer: 'app', view,
  mount() {
    r = Object.fromEntries(['win', 'slot', 'hdrWord', 'nav', 'navBar', 'hdrRight', 'drop', 'dropInner', 'dropCount', 'mSel', 'btn', 'btnFill', 'btnA', 'btnB']
      .map(id => [id, $(id)]));
    r.radios = [$('r0'), $('r1'), $('r2')];
    r.slot.innerHTML = markSvg();
    r.hdrWord.innerHTML = `${BRAND.name}<small>${BRAND.local}</small>`;
  },
  seek(t) {
    // chrome
    const win = winMotion(t);
    put(r.win, { y: win.y, s: win.s, o: clamp(win.p * 3) });
    show(r.slot, ease(t, ...CUE.logoFly, E.inOut) >= 1 ? 1 : 0);   // logo hand-off
    { const p = ease(t, 2.95, 3.5); put(r.hdrWord, { x: lerp(-12, 0, p), o: p }); }
    { const p = ease(t, 3.05, 3.7); put(r.nav, { y: lerp(8, 0, p), o: p }); put(r.navBar, { sx: p, o: p }); put(r.hdrRight, { o: p }); }

    // upload screen enters, leaves when recognition starts
    const out = ease(t, ...CUE.uploadOut, E.soft);
    [['s2title', 3.0], ['s2sub', 3.1], ['drop', 3.15], ['panel', 3.25]].forEach(([id, t0]) => {
      const p = ease(t, t0, t0 + .8);
      put($(id), { y: lerp(30, 0, p) + out * 18, o: p * (1 - out) });
    });
    // drop zone lights up while papers hover over it
    const hover = ease(t, 3.3, 3.6) * (1 - ease(t, 4.05, 4.4));
    r.drop.style.borderColor = mixRgb(GREY, BLUE, hover);
    r.drop.style.backgroundColor = mixRgb([247, 245, 241], [240, 244, 255], hover);
    { const p = ease(t, 3.3, 3.7), b = spring(t - 3.3, 2.2, .35); put(r.dropInner, { y: -30 * p, s: 1 + .06 * (b - p) * (1 - ease(t, 3.7, 4.1)), o: 1 - ease(t, 3.75, 4.05) }); }
    { const p = spring(t - 4.05, 2, .6); put(r.dropCount, { y: lerp(20, 0, clamp(p)), s: lerp(.8, 1, p), o: clamp(p * 2) }); }

    // model picker: selection slides Gemini -> Claude on click
    const pick = spring(t - CUE.clickModel, 2.1, .62);
    r.mSel.style.top = lerp(228, 64, pick).toFixed(2) + 'px';
    r.radios.forEach((el, i) => { const on = i === 0 ? clamp(pick) : i === 2 ? 1 - clamp(pick) : 0; put(el, { s: on, o: on }); });

    // start button: press, then progress fill
    put(r.btn, { s: 1 - pulse(t, ...CUE.clickStart) * .03 });
    const fill = ease(t, 5.25, 6.1, E.soft);
    put(r.btnFill, { sx: Math.max(fill, .0001), o: fill > 0 ? 1 : 0 });
    show(r.btnA, 1 - ease(t, 5.2, 5.35)); show(r.btnB, ease(t, 5.3, 5.45));
  },
};
