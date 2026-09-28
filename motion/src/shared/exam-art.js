// Drawing of the sample exam: handwritten glyphs and the printed cell diagram.
// Used by the exam page and by the thumbnail in the results card.
import { svg } from '../core/dom.js';
import { BOXES } from './layout.js';

/** Handwritten glyph paths in a 32x40 box. */
export const HW = {
  A: 'M4 37 C8 26 12 14 16.5 3.5 C20 14 24 26 29 37 M9 25 C14 24.2 19 23.6 24 24',
  B: 'M7 4 C7 15 6.5 26 7 37 M7.5 5 C24 1 27 17 9 19.5 C28 18 30 36 7 36.5',
  C: 'M28 9 C22 1 5 3 4.5 20 C4 37 21 41 29 31',
  D: 'M7 4 C7.5 16 6.5 27 7 37 M7 4.5 C33 3 33 38 7.5 36.5',
  check: 'M2 18 C6 22 9 27 11 31 C16 20 23 10 32 2',
  third: 'M4 8 L9 4 L9 21 M22 2 C17 14 13 26 8 40 M18 22 C22 18 29 20 25 27 C31 29 29 40 19 38',
};

export function glyph(parent, g, x, y, k = 1, color, rot = 0, w = 2.6) {
  return svg('path', { d: HW[g], transform: `translate(${x} ${y}) rotate(${rot}) scale(${k})`, stroke: color, 'stroke-width': w / k }, parent);
}

/** Printed cell diagram with four numbered label boxes. `clean` adds blue blank highlights. */
export function drawFigure(parent, clean) {
  const g = svg('g', { stroke: '#2E2E2E', 'stroke-width': 1.8, fill: 'none' }, parent);
  svg('ellipse', { cx: 283, cy: 652, rx: 124, ry: 90, fill: '#F3F0E8' }, g);
  svg('ellipse', { cx: 283, cy: 652, rx: 116, ry: 82, 'stroke-width': .9, 'stroke-dasharray': '3 4' }, g);
  svg('circle', { cx: 256, cy: 646, r: 38, fill: '#DCD6C8' }, g);
  svg('circle', { cx: 266, cy: 640, r: 11, fill: '#8C8677' }, g);
  svg('path', { d: 'M300 612 C312 606 318 620 330 614 M302 626 C314 620 320 634 334 628 M200 690 C212 684 218 698 230 692', 'stroke-width': 1.2 }, g);
  const m = svg('g', { transform: 'translate(346 676) rotate(-22)' }, g);
  svg('rect', { x: -34, y: -14, width: 68, height: 28, rx: 14, fill: '#E9E1D0' }, m);
  svg('path', { d: 'M-26 0 C-22 -10 -18 10 -12 0 C-8 -10 -4 10 2 0 C6 -10 10 10 16 0 C20 -10 24 10 27 0', 'stroke-width': 1.1 }, m);
  BOXES.forEach(([x, y, , [ex, ey]], i) => {
    svg('rect', { x, y, width: 112, height: 36, fill: '#FFFEFB', 'stroke-width': 1.4 }, g);
    const lx = x < 283 ? x + 112 : x, ly = y + 18;
    svg('path', { d: `M${lx} ${ly} L${ex} ${ey}`, 'stroke-width': 1.2 }, g);
    svg('circle', { cx: ex, cy: ey, r: 2.2, fill: '#2E2E2E' }, g);
    const tx = svg('text', { x: x + 10, y: y + 24, fill: '#222', stroke: 'none', 'font-size': 15, 'font-family': 'Times New Roman, serif' }, g);
    tx.textContent = `${i + 1}.`;
  });
  if (clean) BOXES.forEach(([x, y]) => svg('rect', { x: x + 32, y: y + 5, width: 72, height: 26, rx: 5, fill: 'rgba(47,91,224,.10)', stroke: '#2F5BE0', 'stroke-width': 2 }, g));
  return g;
}
