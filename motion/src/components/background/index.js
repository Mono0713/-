// Warm paper background with two slowly drifting light blobs and a dot grid.
import view from './view.html';
import './style.css';
import { $, put } from '../../core/dom.js';

let bg, grid;
export default {
  id: 'background', layer: 'stage', view,
  mount() { bg = $('bg'); grid = $('grid'); },
  seek(t) {
    const bx1 = 1450 + 160 * Math.sin(t * .31), by1 = 260 + 90 * Math.cos(t * .27);
    const bx2 = 380 + 140 * Math.cos(t * .23), by2 = 860 + 80 * Math.sin(t * .35);
    bg.style.background = `radial-gradient(1000px circle at ${bx1}px ${by1}px, rgba(110,140,255,.22), transparent 70%), radial-gradient(900px circle at ${bx2}px ${by2}px, rgba(255,170,120,.20), transparent 70%)`;
    put(grid, { x: -((t * 6) % 32), y: -((t * 3) % 32) });
  },
};
