// Builds the Vye Duel print-and-play PDF: 2 rules pages, then 3 double-sided tile sheets.
//
// Windows, from the vye_duel\print folder:
//   npm i playwright   (once)
//   npx playwright install chromium   (once)
//   node build_pdf.js          (2.5 in tiles)
//   node build_pdf.js 67mm     (tiles for 70 mm square sleeves)
//   node build_pdf.js single   (one-sided: fronts then backs, packed together, for sticker sheets; works with 67mm too)
//
// Tiles are 2.5 in (playing-card width), 3 × 4 per US Letter sheet.
// Every even page is the back of the page before it, mirrored left-to-right
// so it lines up when printed double-sided with "flip on long edge".
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const HERE = __dirname;
const url = p => pathToFileURL(path.join(HERE, p)).href;

// ---------- the tiles ----------
// owner: [front, back]  b = Midnight (blue), r = Roses (red), n = nobody
const OWNED = ['b', 'r'], NEUTRAL = ['n', 'n'];
const T = require('./small/tiles.js');
const LANDS = [
  ['Dragon Keep', 'dragon-keep'], ['Longship', 'longship'], ['Owl Marsh', 'owl-marsh'], ['Raven Moor', 'raven-moor'],
  ['Firelands', 'firelands'], ['Violet Peaks', 'violet-peaks'], ['Green Hills', 'green-hills']
];
const FAMILY_RULE = {
  king: 'Flips the 4 tiles beside it.',
  knave: 'Slips past a tile beside it and flips the tile behind.',
  queen: 'Flips the 4 diagonal tiles.',
  heir: 'Flips 1 surrounding tile you choose.'
};
const tiles = [];
for (const [name, art] of LANDS) for (let i = 0; i < 3; i++) tiles.push({ kind: 'land', name, art: `art/${art}.jpg`, own: OWNED });
for (const house of ['Midnight', 'Roses']) for (const m of ['king', 'knave'])
  tiles.push({ kind: 'family', member: m, name: `${cap(m)} of ${house}`, house, rule: FAMILY_RULE[m], art: `art/${house === 'Midnight' ? 'blue' : 'red'}-${m}.jpg`, own: OWNED });
tiles.push({ kind: 'special', name: 'Usurp', glyph: 'usurp', rule: 'Swap a Land on the table for one from your hand. It matches. The old Land goes back in the bag.', own: OWNED });
tiles.push({ kind: 'special', name: 'Lost City', art: 'art/lostcity.jpg', rule: 'Cover a Land you own. Worth 2 in your kingdom.', own: OWNED });
tiles.push({ kind: 'special', name: 'Sinkhole', art: 'art/sinkhole.jpg', rule: 'Cover any tile but the Crossroads. No one owns it.', own: NEUTRAL });
tiles.push({ kind: 'start', name: 'Crossroads', glyph: 'crossroads', rule: 'Start tile. Can’t be covered. A Family capture takes it: swap in the captured Crossroads.', own: NEUTRAL });
tiles.push({ kind: 'start', name: 'Crossroads', glyph: 'crossroads', rule: 'Captured. Swap this in when a Family capture takes the Crossroads.', own: OWNED, captured: true });
function cap(s) { return s[0].toUpperCase() + s.slice(1); }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ---------- drawing ----------
const MOON = T.sigilSvg('b'), ROSE = T.sigilSvg('r');   // names kept from the old moon/rose badges: Midnight owl, Roses rose
const CROWN = '<svg viewBox="0 0 24 18"><path d="M3 16 1.5 5l6 4.5L12 2l4.5 7.5 6-4.5L21 16Z" fill="#fff"/><circle cx="1.5" cy="4.6" r="1.6" fill="#fff"/><circle cx="12" cy="2" r="1.6" fill="#fff"/><circle cx="22.5" cy="4.6" r="1.6" fill="#fff"/></svg>';
const GLYPH = {
  usurp: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="#8E6610" stroke-width="5"/><path d="M36 74V28M36 28 24 41M36 28 48 41M64 26v46M64 72 52 59M64 72 76 59" stroke="#8E6610" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  crossroads: '<svg viewBox="0 0 100 100"><g fill="#5A6470"><rect x="44" y="10" width="12" height="80" rx="3"/><rect x="10" y="44" width="80" height="12" rx="3"/><path d="M50 2 60 16H40Z"/><path d="M50 98 40 84H60Z"/><path d="M2 50 16 40V60Z"/><path d="M98 50 84 60V40Z"/><circle cx="50" cy="50" r="13" fill="#EDE5D0" stroke="#5A6470" stroke-width="5"/></g></svg>'
};
function pattern(member) {
  if (member === 'knave') return grid(5, i => i === 12 ? 'me' : [2, 10, 14, 22].includes(i) ? 'opt' : [7, 11, 13, 17].includes(i) ? 'skip' : '');
  const on = { king: [1, 3, 5, 7], queen: [0, 2, 6, 8], heir: [0, 1, 2, 3, 5, 6, 7, 8], advisor: [0, 1, 2, 3, 5, 6, 7, 8] }[member];
  return grid(3, i => i === 4 ? 'me' : on.includes(i) ? (member === 'heir' ? 'opt' : 'on') : '');
}
function grid(n, cls) { return `<span class="pat n${n}">` + Array.from({ length: n * n }, (_, i) => `<i class="${cls(i)}"></i>`).join('') + '</span>'; }

function face(t, side) {
  const o = t.own[side];
  const sig = o === 'b' ? MOON : o === 'r' ? ROSE : '';
  let body;
  if (t.kind === 'land' || t.kind === 'family') {
    // Lands and Family: the whole picture, nothing else on the tile (the rules page explains each one)
    body = `<div class="art whole ${t.kind}"><img src="${url(t.art)}" alt="${esc(t.name)}"></div>`;
  } else {
    const pic = t.art ? `<img src="${url(t.art)}">` : t.glyph ? `<div class="glyph">${GLYPH[t.glyph]}</div>` : `<div class="glyph big">${pattern(t.member)}</div>`;
    body = `<div class="art part">${pic}</div>
      <div class="label"><b>${esc(t.name)}</b><span>${esc(t.rule)}</span></div>`;
  }
  // Tiles that never go in the bag (Family and the Crossroads) get a crown badge top-left, matching the house badge.
  const crown = t.kind === 'family' || t.kind === 'start' ? `<div class="crownb">${CROWN}</div>` : '';
  return `<div class="tile own-${o}">${body}${crown}${sig ? `<div class="sig">${sig}</div>` : ''}${t.optional ? '<div class="opt-tag">Optional</div>' : ''}</div>`;
}

// ---------- pages ----------
// Tile size: default 2.5 in (playing-card width). `node build_pdf.js 67mm` makes tiles for 70 mm square sleeves.
// Add `single` for a one-sided version (fronts, then backs, packed together: good for sticker sheets).
const ARGS = process.argv.slice(2), SINGLE = ARGS.includes('single');
const arg = ARGS.find(a => /(mm|in)$/.test(a)) || '';
const SIZE = /mm$/.test(arg) ? parseFloat(arg) / 25.4 : /in$/.test(arg) ? parseFloat(arg) : 2.5;
const K = SIZE / 2.5;                                 // tiles are drawn at 2.5 in and scaled
const COLS = Math.floor(8.0 / SIZE), ROWS = Math.floor(10.3 / SIZE), PER = COLS * ROWS;
const X0 = (8.5 - COLS * SIZE) / 2, Y0 = Math.min(0.5, (11 - ROWS * SIZE) / 2);
const OUT = 'vye-duel-print-and-play' + (SIZE === 2.5 ? '' : `-${Math.round(SIZE * 25.4)}mm`) + (SINGLE ? '-single-sided' : '') + '.pdf';
const sheets = [];
for (let i = 0; i < tiles.length; i += PER) sheets.push(tiles.slice(i, i + PER));
// single-sided: every front in order, then every back in the same order, filling each page
const faces = tiles.map((t, i) => ({ t, side: 0, n: i + 1 })).concat(tiles.map((t, i) => ({ t, side: 1, n: i + 1 })));
const singlePages = [];
for (let i = 0; i < faces.length; i += PER) singlePages.push(faces.slice(i, i + PER));
const PAGES = 2 + (SINGLE ? singlePages.length : sheets.length * 2);
function singleSheet(list) {
  const cells = list.map((f, slot) => `<div class="cellbox" style="left:${X0 + (slot % COLS) * SIZE}in;top:${Y0 + Math.floor(slot / COLS) * SIZE}in;width:${SIZE}in;height:${SIZE}in"><div class="slot" style="left:0;top:0;transform:scale(${K});transform-origin:0 0">${face(f.t, f.side)}</div></div>`);
  const marks = [], rows = Math.ceil(list.length / COLS);
  for (let c = 0; c <= COLS; c++) marks.push(`<div class="mk v" style="left:${X0 + c * SIZE}in;top:${Y0 - 0.36}in"></div><div class="mk v" style="left:${X0 + c * SIZE}in;top:${Y0 + rows * SIZE + 0.08}in"></div>`);
  for (let r = 0; r <= rows; r++) marks.push(`<div class="mk h" style="top:${Y0 + r * SIZE}in;left:${X0 - 0.36}in"></div><div class="mk h" style="top:${Y0 + r * SIZE}in;left:${X0 + COLS * SIZE + 0.08}in"></div>`);
  return `<section class="page sheet front">${cells.join('')}${marks.join('')}
    <div class="cutgrid" style="left:${X0}in;top:${Y0}in;width:${COLS * SIZE}in;height:${rows * SIZE}in;background-size:${SIZE}in ${SIZE}in"></div>
    <div class="foot">${pageWhat(list)} · cut on the lines</div></section>`;
}
function pageWhat(list) {
  const part = s => { const f = list.filter(x => x.side === s); return f.length ? `${s ? 'backs' : 'fronts'} ${f[0].n}&ndash;${f[f.length - 1].n}` : ''; };
  const t = [part(0), part(1)].filter(Boolean).join(', then ');
  return t[0].toUpperCase() + t.slice(1);
}
function sheet(list, side) {
  const cells = [];
  for (let slot = 0; slot < PER; slot++) {
    const r = Math.floor(slot / COLS), c = slot % COLS;
    const t = list[slot]; if (!t) continue;
    const col = side === 0 ? c : COLS - 1 - c; // backs are mirrored for long-edge flip
    cells.push(`<div class="cellbox" style="left:${X0 + col * SIZE}in;top:${Y0 + r * SIZE}in;width:${SIZE}in;height:${SIZE}in"><div class="slot" style="left:0;top:0;transform:scale(${K});transform-origin:0 0">${face(t, side)}</div></div>`);
  }
  const marks = [], rows = Math.ceil(list.length / COLS);
  if (side === 0) {
    for (let c = 0; c <= COLS; c++) marks.push(`<div class="mk v" style="left:${X0 + c * SIZE}in;top:${Y0 - 0.36}in"></div><div class="mk v" style="left:${X0 + c * SIZE}in;top:${Y0 + rows * SIZE + 0.08}in"></div>`);
    for (let r = 0; r <= rows; r++) marks.push(`<div class="mk h" style="top:${Y0 + r * SIZE}in;left:${X0 - 0.36}in"></div><div class="mk h" style="top:${Y0 + r * SIZE}in;left:${X0 + COLS * SIZE + 0.08}in"></div>`);
  }
  return `<section class="page sheet ${side ? 'back' : 'front'}">${cells.join('')}${marks.join('')}
    ${side === 0 ? `<div class="cutgrid" style="left:${X0}in;top:${Y0}in;width:${COLS * SIZE}in;height:${rows * SIZE}in;background-size:${SIZE}in ${SIZE}in"></div>` : ''}
    <div class="foot">${side === 0 ? 'Front · cut on the lines' : 'Back of the previous page'}</div></section>`;
}
// what is on each sheet, for the printing box in the rules
function sheetSummary(list) {
  const n = k => list.filter(t => t.kind === k).length, parts = [];
  if (n('land')) parts.push(`${n('land')} Lands`);
  if (n('family')) parts.push(`${n('family')} Family`);
  list.filter(t => t.kind === 'special').forEach(t => parts.push(t.name));
  if (n('start')) parts.push(`${n('start')} Crossroads`);
  return parts.join(', ');
}
const sizeText = SIZE === 2.5 ? 'Tiles are 2.5 inches, the width of a playing card.' : `Tiles are ${Math.round(SIZE * 25.4)} mm (${SIZE.toFixed(2)} in), sized for 70 mm square card sleeves.`;

const rules = fs.readFileSync(path.join(HERE, 'rules.html'), 'utf8')
  .replace(/{{MOON}}/g, MOON).replace(/{{ROSE}}/g, ROSE)
  .replace(/{{SAMPLE}}/g, () => { const t = tiles[3]; return `<div class="sample"><figure><div class="mini"><div class="slot">${face(t, 0)}</div></div>Midnight side</figure><figure><div class="mini"><div class="slot">${face(t, 1)}</div></div>Roses side</figure></div>`; })
  .replace(/{{KING}}/g, pattern('king')).replace(/{{KNAVE}}/g, pattern('knave')).replace(/{{QUEEN}}/g, pattern('queen')).replace(/{{HEIR}}/g, pattern('heir'))
  .replace('Print pages 3&ndash;8', `Print pages 3&ndash;${PAGES}`)
  .replace('Tiles are 2.5 inches, the width of a playing card.', sizeText)
  .replace(/(\d) of 8</g, `$1 of ${PAGES}<`)
  .replace(/<table class="counts">[\s\S]*?<\/table>/, '<table class="counts">' + (SINGLE
    ? singlePages.map((p, i) => `<tr><td>Page ${i + 3}</td><td>${pageWhat(p)}</td></tr>`).join('')
    : sheets.map((s, i) => `<tr><td>Sheet ${i + 1}</td><td>${sheetSummary(s)}</td></tr>`).join('')) + '</table>');
const rulesOut = !SINGLE ? rules : rules
  .replace('US Letter paper. Light cardstock works best.', 'US Letter paper or sticker sheets.')
  .replace(/<li>Print pages 3&ndash;\d+ <b>double-sided, flip on long edge<\/b>\. Each even page is the back of the page before it\.<\/li>/,
    `<li>Print pages 3&ndash;${PAGES} <b>single-sided</b>. First come the ${tiles.length} tile fronts, then the ${tiles.length} backs in the same order.</li><li>Both sides of a tile show the same picture, so match each back to its front and glue or stick them together (or stick both onto a blank tile).</li>`)
  .replace('Cut on the lines on the front of each sheet.', 'Cut on the lines.');

const css = fs.readFileSync(path.join(HERE, 'print.css'), 'utf8').replace(/url\(fonts\//g, `url(${url('fonts')}/`);
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Vye Duel – Print and Play</title><style>${css}</style></head><body>
${rulesOut}
${SINGLE ? singlePages.map(singleSheet).join('\n') : sheets.map(s => sheet(s, 0) + sheet(s, 1)).join('\n')}
</body></html>`;
fs.writeFileSync(path.join(HERE, 'print.html'), html);

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url('print.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(HERE, OUT), format: 'Letter', printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log(`${OUT}: ${tiles.length} tiles at ${(SIZE * 25.4).toFixed(1)} mm on ${SINGLE ? singlePages.length + ' single-sided' : sheets.length + ' double-sided'} sheets, ${PAGES} pages`);
})();
