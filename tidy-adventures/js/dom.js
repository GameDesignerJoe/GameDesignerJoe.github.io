/* ============================================================
   DOM — the query helper and every long-lived element handle.

   These used to be `const host = ...` declarations scattered through the
   single file, which meant any function hoisted above them was a temporal
   dead zone waiting to happen. Centralising them removes that whole class
   of bug: this module is imported before anything that touches the DOM.

   Imports: none. This is a leaf.
============================================================ */
export const $  = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];

export const host      = $("#roomHost");
export const invBar    = $("#invBar");
export const handLabel = $("#handLabel");
export const ghost     = $("#dragGhost");
export const loupeEl   = $("#loupe");
export const contView  = $("#contView");
export const contGrid  = $("#contGrid");
export const contTitle = $("#contTitle");
export const tipLayer  = $("#tipLayer");
export const toastEl   = $("#toast");
export const roomName  = $("#roomName");
export const remaining = $("#remaining");
export const shopBtn   = $("#shopBtn");

export const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* `hidden` alone is not enough: any rule that sets `display` (e.g. .menubtn)
   beats the UA's [hidden]{display:none}. Always go through this. */
export function setHidden(node, on) {
  if (!node) return;
  node.hidden = !!on;
  node.classList.toggle("is-hidden", !!on);
}
