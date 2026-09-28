// Product name, local name, tagline and logo mark. The only place the brand is spelled;
// mirrors apps/web/src/shared/brand in the app.
export const BRAND = {
  name: 'Sheetloop',
  local: '卷環',
  tagline: '紙本考卷進來，反覆練習的題庫出去',
};

// Centre of the loop arrow in the 64×64 mark, for rotating it.
export const LOOP_CENTER = [43, 43];

let uid = 0;
/** The Sheetloop mark as an SVG string (64×64 viewBox, fills its box). The loop arrow is `g.loop`. */
export function markSvg() {
  const id = 'mk' + uid++;
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" aria-hidden="true">
  <defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3D6BFF"/><stop offset="1" stop-color="#6A45F5"/></linearGradient>
    <mask id="${id}m"><rect width="64" height="64" fill="#fff"/><circle cx="43" cy="43" r="15.5" fill="#000"/></mask>
  </defs>
  <rect width="64" height="64" rx="17" fill="url(#${id}g)"/>
  <g mask="url(#${id}m)">
    <path d="M14 15a4 4 0 0 1 4-4h14.5L42 20.5V47a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z" fill="#fff"/>
    <path d="M32.5 11v6.5a3 3 0 0 0 3 3H42" fill="#C9D4FF"/>
    <path d="M20 28h14M20 35h8" stroke="#4A5CF0" stroke-width="3.6" stroke-linecap="round"/>
  </g>
  <g class="loop" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M51.61 47.01A9.5 9.5 0 1 1 50.06 36.64"/>
    <path d="M51.27 29.77L51.53 38.28L43.10 37.13"/>
  </g>
</svg>`;
}

/** Rotate a mark's loop arrow (degrees, about its own centre). */
export function spinLoop(g, deg) {
  g.setAttribute('transform', `rotate(${deg.toFixed(2)} ${LOOP_CENTER[0]} ${LOOP_CENTER[1]})`);
}
