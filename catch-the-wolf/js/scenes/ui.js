// DOM helpers shared by scenes.

import { peltURL } from '../art/icons.js';

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function hudPelts(n) {
  return `<div class="chip" title="Wolf pelts"><img src="${peltURL()}" alt="Pelts"><span data-pelts>${n}</span></div>`;
}

export function bumpPelts(root, n) {
  const span = root.querySelector('[data-pelts]');
  if (!span) return;
  span.textContent = n;
  const chip = span.closest('.chip');
  chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop');
}

export function banner(root, text, sub = '', kind = '') {
  root.querySelectorAll('.banner').forEach((b) => b.remove());
  const b = el(`<div class="banner ${kind}">${text}${sub ? `<small>${sub}</small>` : ''}</div>`);
  root.append(b);
  setTimeout(() => b.remove(), 1700);
}

// A pelt icon arcs from a world point to a HUD element, then calls done().
export function flyPelt(root, x, y, target, done) {
  const img = el(`<img src="${peltURL()}" alt="" style="position:absolute;width:56px;height:56px;left:0;top:0;pointer-events:none;z-index:5">`);
  root.append(img);
  const r = target.getBoundingClientRect();
  const tx = r.left + 22, ty = r.top + r.height / 2;
  const t0 = performance.now(), dur = 650;
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    const e = t * t * (3 - 2 * t);
    const px = x + (tx - x) * e, py = y + (ty - y) * e - Math.sin(t * Math.PI) * 120;
    const s = 1.3 - 0.7 * t;
    img.style.transform = `translate(${px - 28}px, ${py - 28}px) scale(${s}) rotate(${t * 360}deg)`;
    if (t < 1) requestAnimationFrame(step);
    else { img.remove(); done?.(); }
  };
  requestAnimationFrame(step);
}
