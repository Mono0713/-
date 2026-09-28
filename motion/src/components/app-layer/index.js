// The app layer (window, papers, cards, panel, cursor) as one group: it steps back
// and fades when the phone takes over in scene 5.
import { $, put } from '../../core/dom.js';
import { E, ease, lerp } from '../../core/math.js';
import { CUE } from '../../shared/timeline.js';

let app;
export default {
  id: 'app-layer', layer: 'stage', view: '',
  mount() { app = $('app'); },
  seek(t) {
    const p = ease(t, ...CUE.appOut, E.inOut);
    put(app, { x: -260 * p, s: lerp(1, .9, p), o: 1 - p });
  },
};
