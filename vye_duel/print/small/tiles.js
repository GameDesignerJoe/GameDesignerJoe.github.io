// Vye Duel small tiles (0.7 in, Scrabble size): simple icons that still read when tiny.
// Each tile is an SVG on a 100×100 box. Shape tells the tile type, background tells the owner:
//   circle   = Land (circle colour + icon = which Land)
//   square   = Family (dots show what it captures, centre mark shows its house)
//   hexagon  = Special
//   blue moon background = Midnight owns it, red rose background = Roses owns it, grey = nobody.
const OWNER = { b: '#2C5AA5', r: '#B13939', n: '#7D8288' };
const INK = '#1D2329', PAPER = '#FBF8F1';

const LANDS = [
  { name: 'Birchwood', color: '#7CC08A', icon: 'tree' },
  { name: 'Wolf Hollow', color: '#B9C0CC', icon: 'paw' },
  { name: 'Violet Peaks', color: '#B79BE0', icon: 'mountain' },
  { name: 'Golden Fields', color: '#EDC25C', icon: 'sun' },
  { name: 'Ice Cliffs', color: '#9CDCF5', icon: 'snow' },
  { name: 'Spire Isle', color: '#5CC6BC', icon: 'tower' },
  { name: 'Night Thicket', color: '#3B3F7A', icon: 'star', light: true },
  // the other nine Land types, used when a build has more than 7
  { name: 'High Peaks', color: '#C89B6D', icon: 'peaks2' },
  { name: 'Whale Sea', color: '#5E8FD6', icon: 'wave', light: true },
  { name: 'Stag Forest', color: '#A3B86C', icon: 'antler' },
  { name: 'Green Hills', color: '#C6E07A', icon: 'hills' },
  { name: 'Dragon Keep', color: '#E8836A', icon: 'wing' },
  { name: 'Raven Moor', color: '#8E7FA8', icon: 'bird', light: true },
  { name: 'Owl Marsh', color: '#8FBFA6', icon: 'owl' },
  { name: 'Longship', color: '#D8B98A', icon: 'sail' },
  { name: 'Firelands', color: '#F2994A', icon: 'flame' }
];

const ICON = {
  tree: c => `<path d="M50 27 34 54h9l-7 11h28l-7-11h9Z" fill="${c}"/><rect x="47" y="64" width="6" height="9" rx="1" fill="${c}"/>`,
  paw: c => `<ellipse cx="50" cy="59" rx="11" ry="9" fill="${c}"/><circle cx="36" cy="46" r="5" fill="${c}"/><circle cx="44.5" cy="37" r="5" fill="${c}"/><circle cx="55.5" cy="37" r="5" fill="${c}"/><circle cx="64" cy="46" r="5" fill="${c}"/>`,
  mountain: c => `<path d="M27 67 44 34l9 15 6-9 14 27Z" fill="${c}"/><path d="M44 34 39 44l5-3 5 3Z" fill="#fff" opacity=".85"/>`,
  sun: c => `<circle cx="50" cy="50" r="10" fill="${c}"/>` + [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<rect x="48" y="27" width="4" height="9" rx="2" fill="${c}" transform="rotate(${a} 50 50)"/>`).join(''),
  snow: c => [0, 60, 120].map(a => `<g transform="rotate(${a} 50 50)"><rect x="48" y="27" width="4" height="46" rx="2" fill="${c}"/><path d="M43 31 50 37 57 31M43 69 50 63 57 69" stroke="${c}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`).join(''),
  tower: c => `<path d="M37 71V45h5v-7h5v7h6v-7h5v7h5v26Z" fill="${c}"/><path d="M46 71v-9a4 4 0 0 1 8 0v9Z" fill="${PAPER}" opacity=".9"/><path d="M50 22v12M50 22l8 3-8 3" stroke="${c}" stroke-width="2.5" fill="${c}" stroke-linejoin="round"/>`,
  star: c => `<path d="M50 28 55 45 72 50 55 55 50 72 45 55 28 50 45 45Z" fill="${c}"/><circle cx="66" cy="34" r="2.6" fill="${c}"/><circle cx="35" cy="66" r="2" fill="${c}"/>`,
  peaks2: c => `<path d="M24 68 40 40l8 13 9-19 19 34Z" fill="${c}"/>`,
  wave: c => [40, 52, 64].map(y => `<path d="M28 ${y}q5.5-7 11 0t11 0 11 0 11 0" stroke="${c}" stroke-width="4.4" fill="none" stroke-linecap="round"/>`).join(''),
  antler: c => `<path d="M50 72V52M50 52 38 40V28M38 40l-8-6M38 34l-6-8M50 52l12-12V28M62 40l8-6M62 34l6-8" stroke="${c}" stroke-width="4.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  hills: c => `<path d="M24 68c6-16 20-16 26 0Z" fill="${c}"/><path d="M40 68c8-24 28-24 36 0Z" fill="${c}"/>`,
  wing: c => `<path d="M28 64c10-26 30-36 46-36-6 6-6 12-2 16-8 0-12 4-12 10-8-2-14 2-18 10Z" fill="${c}"/>`,
  bird: c => `<path d="M26 50c8-6 16-6 24 2 8-8 16-8 24-2-8 0-14 4-18 12l-6 6-6-6c-4-8-10-12-18-12Z" fill="${c}"/>`,
  owl: c => `<path d="M33 34l7 6h20l7-6v30c0 6-8 10-17 10s-17-4-17-10Z" fill="${c}"/><circle cx="43" cy="49" r="5.5" fill="${PAPER}"/><circle cx="57" cy="49" r="5.5" fill="${PAPER}"/><circle cx="43" cy="49" r="2.4" fill="${c}"/><circle cx="57" cy="49" r="2.4" fill="${c}"/>`,
  sail: c => `<path d="M48 26v32H30Z" fill="${c}"/><path d="M52 30v28h16Z" fill="${c}"/><path d="M28 62h44l-6 8H34Z" fill="${c}"/>`,
  flame: c => `<path d="M50 26c4 10 16 16 16 30a16 16 0 0 1-32 0c0-8 5-12 8-16 1 6 4 8 6 8-2-8 0-16 2-22Z" fill="${c}"/>`
};

const MOON = c => `<path d="M8.6 1.8A5 5 0 1 0 11.6 8.4 4 4 0 0 1 8.6 1.8Z" fill="${c}"/>`;
const ROSE = c => [0, 72, 144, 216, 288].map(a => `<ellipse cx="6.5" cy="3.6" rx="2" ry="2.8" fill="${c}" transform="rotate(${a} 6.5 6.5)"/>`).join('');
const sigil = (o, x, y, s, c) => o === 'n' ? '' : `<g transform="translate(${x} ${y}) scale(${s / 13})">${(o === 'b' ? MOON : ROSE)(c)}</g>`;

let RX = 12, CLIP = 0; // corner radius; the print version uses a small one so a slightly off cut still looks right
function frame(o, inner) {
  const id = 'vt' + (++CLIP);
  const bg = o === 'both' ? `<clipPath id="${id}"><rect x="1" y="1" width="98" height="98" rx="${RX}"/></clipPath><g clip-path="url(#${id})"><rect width="100" height="100" fill="${OWNER.r}"/><path d="M0 0H100L0 100Z" fill="${OWNER.b}"/></g>` : `<rect x="1" y="1" width="98" height="98" rx="${RX}" fill="${OWNER[o]}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg}` +
    `<rect x="5" y="5" width="90" height="90" rx="9" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.4"/>${inner}` +
    sigil(o, 79, 79, 14, '#fff') + `</svg>`;
}

function land(L, o) {
  const icon = L.light ? '#fff' : INK;
  return frame(o, `<circle cx="50" cy="50" r="33" fill="${L.color}" stroke="#fff" stroke-width="2.4"/>${ICON[L.icon](icon)}`);
}

// Family: white square, ink dots where it captures, house mark in the middle.
function family(member, house, o) {
  const n = member === 'knave' ? 5 : 3, cell = member === 'knave' ? 9.2 : 13.5, gap = member === 'knave' ? 1.6 : 2.4;
  const size = n * cell + (n - 1) * gap, x0 = 50 - size / 2;
  const hits = { king: [1, 3, 5, 7], queen: [0, 2, 6, 8], heir: [0, 1, 2, 3, 5, 6, 7, 8], advisor: [0, 1, 2, 3, 5, 6, 7, 8], knave: [2, 10, 14, 22] }[member];
  const skip = member === 'knave' ? [7, 11, 13, 17] : [];
  const mid = (n * n - 1) / 2;
  let cells = '';
  for (let i = 0; i < n * n; i++) {
    const x = x0 + (i % n) * (cell + gap), y = x0 + Math.floor(i / n) * (cell + gap);
    if (i === mid) { cells += `<rect x="${x - 1}" y="${y - 1}" width="${cell + 2}" height="${cell + 2}" rx="2.5" fill="${OWNER[house]}"/>` + sigil(house, x + 1.2, y + 1.2, cell - 0.4, '#fff'); continue; }
    const on = hits.includes(i);
    if (member === 'heir' && on) { cells += `<rect x="${x + 1}" y="${y + 1}" width="${cell - 2}" height="${cell - 2}" rx="2" fill="none" stroke="${INK}" stroke-width="2.2"/>`; continue; }
    if (!on && !skip.includes(i) && member === 'knave') continue;
    cells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${on ? INK : '#D8D2C4'}"/>`;
  }
  const pad = member === 'knave' ? 6 : 7;
  return frame(o, `<rect x="${x0 - pad}" y="${x0 - pad}" width="${size + pad * 2}" height="${size + pad * 2}" rx="7" fill="${PAPER}" stroke="#fff" stroke-width="2.4"/>${cells}`);
}

const HEX = '<path d="M50 15 81 32.5v35L50 85 19 67.5v-35Z" fill="' + PAPER + '" stroke="#fff" stroke-width="2.4"/>';
const SPECIAL = {
  usurp: `<path d="M41 66V35M41 35l-8 9M41 35l8 9M59 34v31M59 65l-8-9M59 65l8-9" stroke="${INK}" stroke-width="5.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  lostcity: `<path d="M33 63V45h5v-5h5v5h5v-9l4-6 4 6v9h5v-5h5v5h4v18Z" fill="${INK}"/><circle cx="44" cy="71" r="3.3" fill="${INK}"/><circle cx="56" cy="71" r="3.3" fill="${INK}"/>`,
  sinkhole: `<circle cx="50" cy="50" r="22" fill="none" stroke="${INK}" stroke-width="4"/><circle cx="50" cy="50" r="13.5" fill="none" stroke="${INK}" stroke-width="4"/><circle cx="50" cy="50" r="5.5" fill="${INK}"/>`,
  underminers: `<path d="M30 58h14M56 58h14M62 50l8 8-8 8" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="50" cy="58" r="4" fill="${INK}"/><path d="M38 44c5-9 19-9 24 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  earthquake: `<path d="M28 50h8l5-10 7 20 6-16 5 10 4-4h9" stroke="${INK}" stroke-width="4.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  sanctuary: `<path d="M50 28 68 35v13c0 12-8 20-18 24-10-4-18-12-18-24V35Z" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linejoin="round"/><path d="M50 40v20M41 49h18" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>`,
  waystone: `<path d="M42 70V40c0-6 4-10 8-10s8 4 8 10v30Z" fill="${INK}"/><path d="M30 44a20 20 0 0 1 8-12M70 44a20 20 0 0 0-8-12" stroke="${INK}" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M36 30l2 2-3 1M64 30l-2 2 3 1" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`
};
function special(key, o) { return frame(o, HEX + SPECIAL[key]); }

function crossroads(o) {
  const c = o === 'n' ? '#fff' : '#fff';
  return frame(o, `<g fill="${c}"><rect x="46" y="18" width="8" height="64" rx="2"/><rect x="18" y="46" width="64" height="8" rx="2"/><path d="M50 12 57 22H43Z"/><path d="M50 88 43 78H57Z"/><path d="M12 50 22 43V57Z"/><path d="M88 50 78 57V43Z"/></g><circle cx="50" cy="50" r="10" fill="${OWNER[o]}" stroke="#fff" stroke-width="4"/>`);
}

// The tile list for the default build: [label, frontSVG, backSVG]
function tileSet() {
  const out = [];
  for (const L of LANDS.slice(0, 7)) for (let i = 0; i < 3; i++) out.push({ label: L.name, front: land(L, 'b'), back: land(L, 'r') });
  for (const [house, h] of [['Midnight', 'b'], ['Roses', 'r']]) for (const m of ['king', 'knave'])
    out.push({ label: `${m[0].toUpperCase() + m.slice(1)} of ${house}`, front: family(m, h, 'b'), back: family(m, h, 'r') });
  out.push({ label: 'Usurp', front: special('usurp', 'b'), back: special('usurp', 'r') });
  out.push({ label: 'Lost City', front: special('lostcity', 'b'), back: special('lostcity', 'r') });
  out.push({ label: 'Sinkhole', front: special('sinkhole', 'n'), back: special('sinkhole', 'n') });
  out.push({ label: 'Crossroads', front: crossroads('n'), back: crossroads('n') });
  out.push({ label: 'Crossroads (captured)', front: crossroads('b'), back: crossroads('r') });
  return out;
}

const API = { LANDS, land, family, special, crossroads, tileSet, OWNER, setCorner: r => { RX = r; } };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else self.VyeTiles = API;
