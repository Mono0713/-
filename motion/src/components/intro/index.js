// Scene 1: wordmark rises letter by letter under the logo, tagline fades up, both leave upward.
import view from './view.html';
import './style.css';
import { $, put, letters } from '../../core/dom.js';
import { E, ease, lerp } from '../../core/math.js';
import { BRAND } from '../../shared/brand.js';

let chars, tag;
export default {
  id: 'intro', layer: 'stage', view,
  mount() {
    chars = letters($('introWord'), BRAND.name);
    tag = $('introTag');
    tag.innerHTML = `<span class="local">${BRAND.local}</span>${BRAND.tagline}`;
  },
  seek(t) {
    const out = ease(t, 2.25, 2.75, E.in);
    chars.forEach((c, i) => {
      const p = ease(t, .55 + i * .07, 1.35 + i * .07);
      put(c, { y: lerp(120, 0, p) - out * 40, o: p * (1 - out) });
    });
    const p = ease(t, 1.05, 1.9);
    put(tag, { y: lerp(24, 0, p) - out * 30, o: p * (1 - out) });
  },
};
