// Scene 4: fill-in panel. As the eraser passes each handwritten answer, a chip in
// that ink colour is born on the page and flies into its row.
import view from './view.html';
import './style.css';
import { $, qs, put, show } from '../../core/dom.js';
import { E, clamp, ease, lerp, mixRgb, spring } from '../../core/math.js';
import { BOXES, INK, HW_CENTER, ZOOM, PANEL_ROW, pageToStage, sweepHit } from '../../shared/layout.js';

let panel, sw, knob, chips, names;
export default {
  id: 'figure-panel', layer: 'app', view,
  mount() {
    panel = $('figPanel'); sw = $('sw'); knob = $('swk');
    names = qs('[data-l]', panel);
    chips = BOXES.map(([, , a], i) => {
      const d = document.createElement('div'); d.className = 'fchipFly'; d.textContent = a; d.style.background = INK[i];
      $('chips').appendChild(d); return d;
    });
  },
  seek(t) {
    const pin = spring(t - 10.55, 1.3, .8), out = ease(t, 13.4, 13.95, E.in);
    put(panel, { x: lerp(120, 0, pin), o: clamp(pin * 1.5) * (1 - out) });
    const on = ease(t, 11.05, 11.35, E.inOut);
    put(knob, { x: 22 * on });
    sw.style.background = mixRgb([214, 209, 200], [31, 157, 107], on);
    chips.forEach((chip, i) => {
      const hit = sweepHit(i);
      const [hx, hy] = pageToStage(ZOOM, ...HW_CENTER[i]);
      const { x: rx, y: ry } = PANEL_ROW(i);
      const sp = spring(t - hit - .05, 1.2, .78), e = clamp(sp);
      put(chip, {
        x: lerp(hx, rx, sp) - 28, y: lerp(hy, ry, sp) - 28 - Math.sin(Math.PI * e) * 110,
        s: lerp(.55, 1, e) + .25 * Math.sin(Math.PI * e), o: (t > hit ? clamp((t - hit) * 8) : 0) * (1 - out),
      });
      show(names[i], .25 + .75 * ease(t, hit + .5, hit + .9));
    });
  },
};
