// Boots the piece: exposes window.seek / window.DURATION / window.ready for the
// renderer, and in a normal browser tab runs a preview player on top of seek().
import './player.css';

export function boot({ seek, duration }) {
  const params = new URLSearchParams(location.search);
  const render = params.has('render');
  const stage = document.getElementById('stage');
  if (render) document.documentElement.classList.add('render');

  window.DURATION = duration;
  window.seek = seek;
  window.ready = document.fonts.ready.then(() => { seek(+params.get('t') || 0); return true; });
  if (render) return;

  const fit = () => {
    const k = Math.min(innerWidth / 1920, (innerHeight - 56) / 1080);
    stage.style.transform = `scale(${k})`;
    stage.style.left = ((innerWidth - 1920 * k) / 2) + 'px';
    stage.style.top = ((innerHeight - 56 - 1080 * k) / 2) + 'px';
  };
  addEventListener('resize', fit); fit();

  // wall clock -> seek(t); the frame itself still comes only from seek
  let playing = true, t0 = performance.now(), base = +params.get('t') || 0, cur = base;
  const scrub = document.getElementById('scrub'), tc = document.getElementById('tc'), btn = document.getElementById('play');
  scrub.max = duration;
  scrub.oninput = () => { cur = +scrub.value; base = cur; t0 = performance.now(); seek(cur); tc.textContent = cur.toFixed(3) + 's'; };
  btn.onclick = () => { playing = !playing; btn.textContent = playing ? '❚❚' : '▶'; base = cur; t0 = performance.now(); };
  addEventListener('keydown', e => { if (e.code === 'Space') btn.onclick(); });
  (function loop(now) {
    if (playing) { cur = (base + (now - t0) / 1000) % duration; seek(cur); scrub.value = cur; tc.textContent = cur.toFixed(3) + 's'; }
    requestAnimationFrame(loop);
  })(performance.now());
}
