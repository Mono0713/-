// The master timeline. Scene windows and every cue that more than one component
// reacts to live here, so retiming a hand-off means editing one number.
// Cues used by a single component stay inside that component.
import { E, ease, lerp, prog, spring } from '../core/math.js';

export const DURATION = 20;

/** Scene windows in seconds (they overlap during transitions). */
export const SCENES = {
  intro:     [0, 2.8],
  upload:    [2.3, 6.4],
  recognize: [5.95, 10.5],
  figure:    [10.0, 13.95],
  mobile:    [13.45, 18.1],
  outro:     [17.45, 20],
};

export const CUE = {
  logoIn: .2,                 // logo tile springs in
  logoFly: [2.3, 3.2],        // logo flies into the window header
  winIn: [2.45, 3.35],        // app window rises in
  clickModel: 4.3,            // cursor picks Claude
  clickStart: [5.1, 5.35],    // cursor presses 開始辨識 (press window)
  uploadOut: [5.95, 6.4],     // upload UI fades, paper becomes the page
  pageMorph: [5.95, 6.9],
  beam: [6.85, 8.55],         // scan beam sweeps the page
  resultsOut: 10.0,           // result cards leave
  zoom: [10.1, 11.1],         // camera pushes into the figure
  sweep: [11.3, 12.15],       // handwriting eraser sweep
  appOut: [13.45, 14.25],     // whole app layer leaves for the phone
  mobileOut: [17.45, 17.95],
  outroLogo: 17.75,
  outroFade: [19.35, 19.95],  // everything fades back to the empty background (loop point)
};

/** Window entrance: scale and y offset about the window centre. */
export function winMotion(t) {
  const p = ease(t, ...CUE.winIn);
  return { p, s: lerp(.9, 1, p), y: lerp(140, 0, p) };
}

export const outroFade = t => ease(t, ...CUE.outroFade, E.soft);
export const outroLogo = t => spring(t - CUE.outroLogo, 1.4, .55);

/** Scan beam top edge in page-local px. */
export const beamY = t => lerp(-150, 810, E.sine(prog(t, ...CUE.beam)));
/** Eraser x in page-local px. */
export const sweepX = t => lerp(10, 560, E.sine(prog(t, ...CUE.sweep)));
