// Scene 3: recognised question cards. Each card is born at its box on the page
// (scaled to the box) and springs into the results column.
import view from './view.html';
import './style.css';
import { $, put } from '../../core/dom.js';
import { E, ease, lerp, prog, spring } from '../../core/math.js';
import { CUE } from '../../shared/timeline.js';
import { PAGE, QB, CARD, CARD_X, CARD_W, boxT, pageToStage } from '../../shared/layout.js';
import { drawFigure } from '../../shared/exam-art.js';

let head, cards, cnt, amber;
export default {
  id: 'results', layer: 'app', view,
  mount() {
    head = $('resHead'); cnt = $('cnt'); amber = $('amber');
    cards = CARD.map((_, i) => $('c' + i));
    drawFigure($('thumbSvg'), true);
  },
  seek(t) {
    const out = ease(t, CUE.resultsOut, 10.45, E.soft);
    { const p = ease(t, 6.55, 7.3); put(head, { y: lerp(16, 0, p) - out * 10, o: p * (1 - out) }); }
    let landed = 0;
    CARD.forEach(([top, h], i) => {
      const t0 = boxT[i] + .12;
      const [bx, by] = pageToStage(PAGE, QB[i][0] + QB[i][2] / 2, QB[i][1] + QB[i][3] / 2);
      const tx = CARD_X + CARD_W / 2, ty = top + h / 2, s0 = PAGE.s * QB[i][2] / CARD_W;
      const sp = spring(t - t0, 1.35, .74), lin = prog(t, t0, t0 + .25);
      if (t - t0 > .55) landed++;
      const leave = ease(t, CUE.resultsOut + i * .05, 10.5 + i * .05, E.in);
      put(cards[i], {
        x: lerp(bx - tx, 0, sp) + leave * 160, y: lerp(by - ty, 0, sp) - Math.sin(Math.PI * Math.min(1, Math.max(0, sp))) * 30,
        s: lerp(s0, 1, sp), sy: lerp(QB[i][3] * PAGE.s / h, 1, sp), o: lin * (1 - leave),
      });
    });
    cnt.textContent = landed;
    // the 待確認 badge pops when card 3 lands
    const p = spring(t - boxT[2] - .75, 2.4, .35);
    put(amber, { s: 1 + .12 * (1 - Math.min(1, p)) * (p > 0 ? 1 : 0) });
  },
};
