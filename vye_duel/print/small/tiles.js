// Vye Duel small tiles (0.7 in, Scrabble size): simple icons that still read when tiny.
// Each tile is an SVG on a 100×100 box. Shape tells the tile type, background tells the owner:
//   circle   = Land (circle colour + icon = which Land)
//   square   = Family (dots show what it captures, centre mark shows its house)
//   hexagon  = Special
//   blue background + owl = Midnight owns it, red background + rose = Roses owns it, grey = nobody.
const OWNER = { b: '#2C5AA5', r: '#B13939', n: '#7D8288' };
const INK = '#1D2329', PAPER = '#FBF8F1';

const LANDS = [
  // same order as the engine: the first 7 are the default set and the print and play
  { name: 'Dragon Keep', color: '#EDC25C', icon: 'wing' },
  { name: 'Longship', color: '#5E8FD6', icon: 'sail', light: true },
  { name: 'Owl Marsh', color: '#5CC6BC', icon: 'reeds' },
  { name: 'Raven Moor', color: '#3B3F4A', icon: 'bird', light: true },
  { name: 'Firelands', color: '#F2994A', icon: 'flame' },
  { name: 'Violet Peaks', color: '#B79BE0', icon: 'mountain' },
  { name: 'Green Hills', color: '#C6E07A', icon: 'hills' },
  // the other nine Land types, used when a build has more than 7
  { name: 'Wolf Hollow', color: '#B9C0CC', icon: 'paw' },
  { name: 'Spire Isle', color: '#8FBFA6', icon: 'tower' },
  { name: 'Ice Cliffs', color: '#9CDCF5', icon: 'snow' },
  { name: 'Golden Fields', color: '#E8D9A0', icon: 'sun' },
  { name: 'Night Thicket', color: '#3B3F7A', icon: 'star', light: true },
  { name: 'Birchwood', color: '#7CC08A', icon: 'tree' },
  { name: 'High Peaks', color: '#C89B6D', icon: 'peaks2' },
  { name: 'Whale Sea', color: '#275B5E', icon: 'wave', light: true },
  { name: 'Stag Forest', color: '#A3B86C', icon: 'antler' }
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
  reeds: c => `<path d="M50 74V36M40 74V46M60 74V44M32 74c0-10 4-16 8-20M68 74c0-10-4-16-8-22" stroke="${c}" stroke-width="3.4" fill="none" stroke-linecap="round"/><rect x="46.5" y="26" width="7" height="16" rx="3.5" fill="${c}"/><rect x="36.5" y="38" width="7" height="13" rx="3.5" fill="${c}"/><rect x="56.5" y="35" width="7" height="14" rx="3.5" fill="${c}"/>`,
  sail: c => `<path d="M48 26v32H30Z" fill="${c}"/><path d="M52 30v28h16Z" fill="${c}"/><path d="M28 62h44l-6 8H34Z" fill="${c}"/>`,
  flame: c => `<path d="M50 26c4 10 16 16 16 30a16 16 0 0 1-32 0c0-8 5-12 8-16 1 6 4 8 6 8-2-8 0-16 2-22Z" fill="${c}"/>`
};

// House sigils, traced from the 3rd-edition crests: the Midnight owl and the Roses rose. 24 × 24 box, holes cut with evenodd.
const SIGIL = {
  b: 'M7.42 2.44 L5.97 2.92 L5.26 3.25 L4.52 3.70 L4.02 4.13 L3.38 4.84 L2.98 5.48 L2.69 6.10 L2.17 8.15 L2.02 10.38 L2.00 11.98 L2.14 12.90 L2.19 13.97 L2.74 15.73 L3.00 16.26 L3.19 16.47 L3.19 16.21 L3.02 15.66 L3.05 15.42 L3.14 15.26 L3.26 15.31 L3.36 15.69 L3.66 16.19 L3.88 16.30 L4.14 16.16 L4.47 15.54 L4.62 14.50 L4.52 14.43 L4.07 14.43 L3.69 14.09 L3.52 13.81 L3.28 13.12 L3.31 12.64 L3.40 12.55 L3.52 12.64 L3.64 13.07 L3.85 13.40 L4.12 13.62 L4.33 13.59 L4.59 13.36 L4.76 12.98 L5.07 12.64 L5.14 12.83 L4.81 14.09 L5.14 14.95 L5.47 15.33 L5.78 15.45 L6.23 15.35 L6.47 15.12 L6.92 14.35 L6.99 14.33 L7.07 14.43 L7.07 14.69 L6.88 15.40 L6.33 16.28 L6.40 16.88 L6.16 17.73 L5.90 18.21 L5.69 18.42 L5.52 18.52 L5.28 18.52 L4.95 18.25 L4.76 17.97 L4.38 16.90 L3.95 17.11 L3.69 17.07 L3.45 16.88 L3.43 16.99 L3.64 17.47 L4.78 18.90 L5.57 19.61 L6.47 20.32 L8.28 21.27 L10.01 21.80 L12.23 21.99 L13.03 21.85 L14.10 21.77 L15.72 21.27 L17.48 20.35 L18.96 19.16 L20.24 17.64 L21.26 15.73 L21.76 14.14 L21.83 13.12 L22.00 12.12 L21.98 9.98 L21.83 9.03 L21.79 8.00 L21.57 7.29 L21.52 6.86 L21.26 6.05 L20.60 4.87 L20.26 4.46 L19.46 3.72 L18.50 3.15 L17.46 2.73 L16.58 2.46 L15.01 2.18 L13.13 2.13 L12.20 2.01 L10.35 2.15 L8.87 2.18 L8.09 2.37ZM20.76 15.33 L20.69 16.21 L20.41 16.83 L20.05 17.11 L19.86 17.11 L19.55 16.92 L19.41 16.95 L19.31 17.11 L19.24 17.61 L18.96 18.18 L18.58 18.52 L18.39 18.54 L18.20 18.44 L17.84 18.04 L17.55 17.35 L17.51 17.11 L17.55 16.64 L17.65 16.54 L17.79 16.61 L17.89 17.14 L18.17 17.59 L18.36 17.71 L18.58 17.68 L18.84 17.42 L18.98 16.90 L19.17 16.54 L19.17 15.88 L19.24 15.45 L19.36 15.38 L19.46 15.47 L19.53 15.88 L19.69 16.16 L19.86 16.28 L20.05 16.28 L20.29 16.07 L20.45 15.61ZM9.59 13.05 L10.56 12.90 L13.03 13.00 L13.37 13.07 L13.65 13.31 L13.68 13.55 L13.56 13.95 L13.06 14.88 L12.15 16.26 L11.63 16.80 L11.39 16.85 L11.16 16.68 L10.80 16.26 L10.23 15.31 L9.44 13.62 L9.42 13.31ZM20.53 12.55 L20.60 12.74 L20.45 13.50 L20.22 14.00 L19.81 14.40 L19.31 14.50 L19.12 15.23 L18.72 15.85 L18.46 16.11 L18.22 16.23 L17.79 16.28 L17.53 16.16 L17.10 15.64 L16.82 14.97 L16.86 14.52 L16.93 14.45 L17.08 14.52 L17.24 14.93 L17.60 15.33 L17.91 15.45 L18.39 15.33 L18.69 14.97 L18.91 14.57 L19.00 14.19 L18.93 13.64 L18.72 13.07 L18.79 12.71 L18.84 12.67 L18.96 12.71 L19.05 13.02 L19.29 13.40 L19.46 13.57 L19.69 13.62 L19.98 13.40 L20.22 12.88ZM14.72 7.79 L15.08 7.81 L15.79 8.03 L16.44 8.46 L17.01 9.24 L17.12 9.50 L17.17 9.93 L17.12 10.88 L16.63 11.74 L15.82 12.36 L14.96 12.59 L14.72 12.59 L13.94 12.38 L13.18 11.86 L12.80 11.36 L12.58 10.95 L12.49 10.26 L12.58 9.43 L13.11 8.60 L13.80 8.08ZM8.54 7.79 L8.87 7.81 L9.59 8.03 L10.25 8.48 L10.49 8.74 L10.89 9.43 L10.99 10.05 L10.89 10.95 L10.37 11.79 L9.66 12.33 L8.75 12.59 L8.52 12.59 L7.73 12.38 L6.99 11.88 L6.38 10.95 L6.30 10.45 L6.35 9.50 L6.88 8.62 L7.59 8.08Z',
  r: 'M15.34 11.33 L15.31 11.55 L15.46 12.30 L15.63 13.82 L15.65 15.27 L15.46 16.47 L15.29 17.01 L15.07 17.46 L14.89 17.73 L14.57 18.09 L14.31 18.29 L13.54 18.66 L12.49 18.93 L12.20 19.12 L12.17 19.32 L12.37 19.53 L12.95 19.81 L14.06 20.17 L15.19 20.34 L16.48 20.32 L17.27 20.15 L18.01 19.80 L18.47 19.41 L18.81 18.85 L18.94 18.31 L18.98 17.87 L18.93 17.41 L18.79 16.79 L18.47 15.88 L17.79 14.56 L16.46 12.60 L15.43 11.33ZM8.66 11.33 L8.57 11.35 L7.44 12.75 L6.24 14.53 L5.55 15.86 L5.18 16.94 L5.04 17.85 L5.04 18.11 L5.21 18.87 L5.50 19.34 L5.67 19.53 L5.95 19.76 L6.34 19.98 L6.75 20.15 L7.54 20.32 L8.08 20.35 L9.06 20.32 L10.55 20.00 L11.44 19.64 L11.75 19.46 L11.85 19.32 L11.81 19.12 L11.49 18.92 L10.48 18.66 L9.64 18.24 L9.28 17.92 L9.06 17.65 L8.69 16.94 L8.50 16.27 L8.37 15.29 L8.37 13.97 L8.47 13.31 L8.52 12.50 L8.69 11.60ZM17.59 6.21 L16.86 6.38 L16.46 6.55 L16.10 6.76 L15.68 7.13 L15.36 7.65 L15.21 8.33 L15.19 8.61 L15.29 9.41 L15.68 10.61 L16.38 11.96 L17.59 13.77 L18.64 15.08 L18.81 15.18 L18.86 15.07 L18.66 13.90 L18.62 13.19 L18.52 12.45 L18.52 11.28 L18.66 10.23 L18.84 9.58 L19.18 8.92 L19.38 8.65 L19.74 8.31 L20.58 7.87 L21.49 7.65 L21.78 7.53 L21.97 7.40 L22.00 7.19 L21.90 7.06 L21.39 6.77 L20.24 6.38 L19.35 6.21 L18.62 6.18ZM6.43 6.21 L5.73 6.18 L4.70 6.21 L3.13 6.57 L2.66 6.76 L2.08 7.08 L2.00 7.21 L2.03 7.38 L2.24 7.53 L2.52 7.65 L3.47 7.89 L4.26 8.29 L4.79 8.85 L5.16 9.54 L5.33 10.10 L5.50 11.23 L5.50 12.52 L5.33 14.12 L5.16 15.00 L5.21 15.18 L5.28 15.18 L6.43 13.77 L7.59 12.04 L8.32 10.64 L8.66 9.68 L8.79 8.93 L8.82 8.41 L8.67 7.72 L8.33 7.13 L7.96 6.79 L7.64 6.59 L7.15 6.38ZM16.10 3.88 L14.50 3.68 L12.49 3.65 L12.37 3.70 L12.32 3.78 L12.32 18.34 L12.37 18.41 L12.49 18.41 L13.32 17.95 L14.31 17.23 L14.87 16.62 L15.06 16.27 L15.21 15.76 L15.26 15.40 L15.23 14.14 L14.91 12.73 L14.28 10.71 L14.09 9.86 L14.01 8.34 L14.09 7.79 L14.25 7.36 L14.75 6.48 L15.43 5.61 L16.21 4.76 L16.51 4.32 L16.51 4.10ZM8.22 3.85 L7.88 3.97 L7.69 4.10 L7.71 4.37 L8.06 4.85 L9.13 6.05 L9.89 7.24 L10.04 7.60 L10.21 8.44 L10.16 9.39 L10.06 10.05 L9.87 10.84 L9.25 12.87 L8.96 14.24 L8.93 15.42 L9.15 16.28 L9.47 16.82 L9.85 17.21 L10.77 17.89 L11.56 18.34 L11.80 18.43 L11.88 18.31 L11.88 3.83 L11.83 3.70 L11.75 3.65 L9.69 3.68Z'
};
const sigilSvg = (o, c = '#fff') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" fill="${c}" d="${SIGIL[o]}"/></svg>`;
const sigil = (o, x, y, s, c) => o === 'n' || o === 'both' ? '' : `<g transform="translate(${x} ${y}) scale(${s / 24})"><path fill-rule="evenodd" fill="${c}" d="${SIGIL[o]}"/></g>`;

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
  rally: `<path d="M38 72V28" stroke="${INK}" stroke-width="4.6" fill="none" stroke-linecap="round"/><path d="M40 30h26l-7 9 7 9H40Z" fill="${INK}"/>`,
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

const API = { LANDS, SIGIL, sigilSvg, land, family, special, crossroads, tileSet, OWNER, setCorner: r => { RX = r; } };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else self.VyeTiles = API;
