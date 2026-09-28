// DOM helpers. Components only touch the page through these and plain element refs.

export const $ = id => document.getElementById(id);
export const qs = (s, r = document) => [...r.querySelectorAll(s)];

/** Set transform + opacity in one go; fully transparent elements are also hidden. */
export function put(el, { x = 0, y = 0, s = 1, sx, sy, r = 0, o = 1, extra = '' } = {}) {
  const X = sx ?? s, Y = sy ?? s;
  el.style.transform = `translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0) rotate(${r.toFixed(3)}deg) scale(${X.toFixed(4)},${Y.toFixed(4)})${extra}`;
  show(el, o);
}
/** Set opacity only. */
export function show(el, o) {
  el.style.opacity = o.toFixed(4);
  el.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

/** Split text into per-character spans inside overflow clips (for rising letters). */
export function letters(host, text) {
  host.innerHTML = [...text].map(c => `<span class="clip"><span class="ch">${c}</span></span>`).join('');
  return qs('.ch', host);
}
