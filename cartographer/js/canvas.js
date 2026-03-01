// ============================================================
// THE CARTOGRAPHER - canvas.js
// Canvas/ctx singleton. No imports.
// ============================================================

export const canvas = document.getElementById('gameCanvas');
export const ctx = canvas.getContext('2d');

export function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resize();
window.addEventListener('resize', resize);
