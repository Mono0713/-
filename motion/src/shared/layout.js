// Shared geometry: where things sit on the 1920x1080 stage and on the exam page,
// plus the derived times at which the beam and the eraser reach each item.
import { CUE, beamY } from './timeline.js';

export const STAGE = { w: 1920, h: 1080 };
export const WIN = { x: 160, y: 90, w: 1600, h: 900 };
/** Exam page native size (px). */
export const PAGE_W = 566, PAGE_H = 800;

/** Paper cameras: centre on stage + scale. */
export const PAGE = { cx: 470, cy: 584, s: .95 };   // page under review
export const ZOOM = { cx: 566, cy: 200, s: 1.6 };   // close-up on the figure
export function pageToStage(cam, lx, ly) {
  return [cam.cx + cam.s * (lx - PAGE_W / 2), cam.cy + cam.s * (ly - PAGE_H / 2)];
}

/** Map a window-local point to the stage given the window's entrance motion. */
export function winToStage({ s, y }, lx, ly) {
  return [WIN.x + WIN.w / 2 + s * (lx - WIN.w / 2), WIN.y + WIN.h / 2 + s * (ly - WIN.h / 2) + y];
}
export const LOGO_BIG = { x: 885, y: 330 };      // 150px tile, top-left
export const SLOT = { x: 32, y: 18, s: 36 / 150 }; // header logo slot, window-local

/** Question blocks on the page: x, y, w, h, tag. */
export const QB = [[26, 94, 514, 146, '單選 · 2 分'], [26, 244, 514, 60, '計算 · 公式'], [26, 326, 514, 138, '表格 · 待確認'], [26, 468, 514, 300, '圖片填空 · 4 格']];
/** Result cards on stage: top, height (left 810, width 880). */
export const CARD = [[250, 196], [462, 128], [606, 160], [782, 190]];
export const CARD_X = 810, CARD_W = 880;

/** Time the scan beam passes each question block's bottom edge. */
export const boxT = QB.map(([, y, , h]) => {
  let lo = CUE.beam[0], hi = CUE.beam[1];
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (beamY(m) + 140 < y + h + 10) lo = m; else hi = m; }
  return hi;
});

/** Figure label boxes: x, y, handwritten answer, leader-line end. */
export const BOXES = [
  [60, 562, 'C', [196, 610]], [60, 708, 'A', [238, 655]], [400, 562, 'B', [344, 672]], [400, 716, 'D', [274, 638]],
];
/** Ink colours of the four answers: red, blue, pencil, black. */
export const INK = ['#D8333A', '#2F5BE0', '#6F6D72', '#1C1C21'];
/** Where each handwritten answer is drawn (glyph origin) and its visual centre. */
export const HW_ORIGIN = BOXES.map(([x, y]) => [x + 58, y + 4]);
export const HW_CENTER = HW_ORIGIN.map(([X, Y]) => [X + 11, Y + 14]);
/** Time the eraser passes each answer. */
export const sweepHit = i => {
  const [s0, s1] = CUE.sweep;
  return s0 + (s1 - s0) * (Math.acos(1 - 2 * Math.min(1, Math.max(0, (BOXES[i][0] + 70 - 10) / 550))) / Math.PI);
};
/** Answer chip landing spots in the figure panel (stage, centre). */
export const PANEL_ROW = i => ({ x: 1040 + 32 + 20 + 28, y: 196 + 268 + i * 96 + 40 });
