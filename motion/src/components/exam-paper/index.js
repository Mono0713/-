// The three uploaded papers (scene 2). The middle one becomes the page under review:
// it is scanned and boxed (scene 3), then the camera pushes into its figure and an
// eraser sweep removes the handwriting (scene 4).
import view from './view.html';
import './style.css';
import { $, put, show, svg } from '../../core/dom.js';
import { E, clamp, ease, lerp, prog, spring } from '../../core/math.js';
import { CUE, beamY, sweepX } from '../../shared/timeline.js';
import { PAGE, PAGE_W as W, PAGE_H as H, ZOOM, WIN, QB, BOXES, INK, HW_ORIGIN, boxT, sweepHit } from '../../shared/layout.js';
import { glyph, drawFigure } from '../../shared/exam-art.js';

// fanned landing spot of each paper: centre x, y, rotation, scale, arrival time
const FAN = [[544, 640, -9, .42, 3.2], [684, 612, 0, .42, 3.5], [824, 640, 8, .42, 3.35]];
let papers, layer, chip, dim, scan, sweep, clipRect, blanks, qEls;

function buildInk(pg) {
  const ink = svg('g', { stroke: '#D8333A', 'stroke-width': 2.6 }, pg);
  svg('path', { d: 'M84 70 C92 58 98 76 104 64 C110 54 112 74 120 66 C128 58 134 72 142 62 M100 58 L96 78', 'stroke-width': 2.2 }, ink); // name
  glyph(ink, 'B', 6, 104, .62, null, -4);
  svg('path', { d: 'M206 136 C236 124 318 126 324 139 C329 152 268 158 222 154 C200 151 196 138 214 130', 'stroke-width': 2.2 }, ink); // circled (B)
  glyph(ink, 'third', 196, 240, .72, '#2F5BE0', 0);
  glyph(ink, 'check', 238, 431, .62, null, 0);
}

export default {
  id: 'exam-paper', layer: 'app', view,
  mount() {
    papers = [$('p0'), $('p1'), $('p2')];
    layer = $('paperLayer'); chip = $('p1chip'); dim = $('pageDim'); scan = $('scan'); sweep = $('sweep');
    const pg = $('pgSvg');
    buildInk(pg);
    drawFigure(pg, false);
    // figure answers in four inks, clipped away by the eraser
    const figInk = svg('g', { 'clip-path': 'url(#eraseClip)' }, pg);
    const clip = svg('clipPath', { id: 'eraseClip' }, svg('defs', {}, pg));
    clipRect = svg('rect', { x: 0, y: 0, width: 600, height: 800 }, clip);
    BOXES.forEach(([, , a], i) => glyph(figInk, a, ...HW_ORIGIN[i], .7, INK[i], [-6, 4, -2, 5][i], i === 2 ? 2.2 : 2.8));
    blanks = BOXES.map(([x, y]) => svg('rect', { x: x + 32, y: y + 4, width: 74, height: 28, rx: 6, fill: 'rgba(47,91,224,.10)', stroke: '#2F5BE0', 'stroke-width': 2.4, pathLength: 1, 'stroke-dasharray': 1 }, pg));
    qEls = QB.map(([x, y, w, h, tag]) => {
      const d = document.createElement('div'); d.className = 'qbox';
      Object.assign(d.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      d.innerHTML = `<div class="qtag">${tag}</div>`;
      $('qboxes').appendChild(d); return d;
    });
  },
  seek(t) {
    // papers: fly in on arcs and fan out; p1 then becomes the page and later the close-up
    papers.forEach((el, i) => {
      const [fx, fy, fr, fs, t0] = FAN[i];
      const sp = spring(t - t0, 1.25, .72), ep = clamp(E.out(prog(t, t0, t0 + .9)));
      let x = lerp(1720 + i * 90, fx, sp), y = lerp(1300, fy, sp) - Math.sin(Math.PI * ep) * 160;
      let r = lerp(28 - i * 10, fr, sp), s = lerp(.62, fs, ep), o = t >= t0 ? 1 : 0;
      if (i === 1) {
        const m = ease(t, ...CUE.pageMorph, E.inOut);
        x = lerp(x, PAGE.cx, m); y = lerp(y, PAGE.cy, m); s = lerp(s, PAGE.s, m); r = lerp(r, 0, m);
        const z = ease(t, ...CUE.zoom, E.inOut);
        x = lerp(x, ZOOM.cx, z); y = lerp(y, ZOOM.cy, z); s = lerp(s, ZOOM.s, z);
        show(dim, ease(t, 10.05, 10.7, E.soft));   // hide questions 1–3 in the close-up
      } else {
        const m = ease(t, CUE.uploadOut[0], 6.6, E.soft);   // tuck behind the page and fade
        x = lerp(x, 684, m); y = lerp(y, 640, m); s = lerp(s, .3, m); r = lerp(r, 0, m); o *= 1 - m;
      }
      put(el, { x: x - W / 2, y: y - H / 2, s, r, o });
    });
    show(chip, 1 - ease(t, 5.95, 6.3));
    // unclipped while papers fly in from off-screen, clipped to the window body afterwards
    layer.style.clipPath = t < 4.2 ? 'none' : `inset(${WIN.y + 73}px ${1920 - WIN.x - WIN.w}px ${1080 - WIN.y - WIN.h}px ${WIN.x}px round 0 0 28px 28px)`;

    // scan beam and question boxes
    put(scan, { y: beamY(t), o: prog(t, CUE.beam[0], CUE.beam[0] + .2) * (1 - prog(t, CUE.beam[1] - .2, CUE.beam[1])) });
    qEls.forEach((el, i) => {
      const p = ease(t, boxT[i] - .05, boxT[i] + .4), tg = spring(t - boxT[i] - .1, 2.2, .55);
      const dimmed = 1 - .45 * ease(t, boxT[i] + .5, boxT[i] + .9);
      put(el, { s: lerp(1.04, 1, p), o: p * dimmed * (1 - ease(t, CUE.resultsOut, 10.3)) });
      put(el.firstChild, { s: Math.max(tg, .0001), o: clamp(tg * 3) });
    });

    // eraser sweep: clip the handwriting behind it, then draw the blue blanks
    const sx = sweepX(t);
    clipRect.setAttribute('x', t < CUE.sweep[0] ? 0 : sx.toFixed(2));
    put(sweep, { x: sx - 58, y: 548, o: prog(t, CUE.sweep[0], CUE.sweep[0] + .1) * (1 - prog(t, CUE.sweep[1] - .12, CUE.sweep[1])) });
    blanks.forEach((b, i) => {
      const hit = sweepHit(i);
      b.setAttribute('stroke-dashoffset', (1 - ease(t, hit + .05, hit + .55, E.soft)).toFixed(4));
      b.style.opacity = t < hit ? 0 : 1 - ease(t, 13.4, 13.8);
    });
  },
};
