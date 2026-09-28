// Composition root. Mounts every component into its layer (array order = paint order)
// and defines seek(t) as "every component seeks to t". Nothing else holds state.
import './theme/tokens.css';
import './theme/base.css';
import './theme/brand.css';
import './theme/ui.css';
import { clamp } from './core/math.js';
import { boot } from './core/player.js';
import { DURATION } from './shared/timeline.js';

import background from './components/background/index.js';
import intro from './components/intro/index.js';
import appLayer from './components/app-layer/index.js';
import appWindow from './components/app-window/index.js';
import examPaper from './components/exam-paper/index.js';
import results from './components/results/index.js';
import figurePanel from './components/figure-panel/index.js';
import cursor from './components/cursor/index.js';
import mobile from './components/mobile/index.js';
import outro from './components/outro/index.js';
import logo from './components/logo/index.js';

export const COMPONENTS = [background, intro, appLayer, appWindow, examPaper, results, figurePanel, cursor, mobile, outro, logo];

const layers = { stage: document.getElementById('stage'), app: document.getElementById('app') };
for (const c of COMPONENTS) if (c.view) layers[c.layer].insertAdjacentHTML('beforeend', c.view);
// #app comes from the shell; move it to its paint position, between intro and mobile
layers.stage.insertBefore(layers.app, document.getElementById('mobile'));
for (const c of COMPONENTS) c.mount?.();

function seek(t) {
  t = clamp(t, 0, DURATION);
  for (const c of COMPONENTS) c.seek(t);
}

boot({ seek, duration: DURATION });
