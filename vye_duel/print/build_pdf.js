// Builds the Vye Duel print-and-play PDF: 2 rules pages, then 3 double-sided tile sheets.
//
// Windows, from the vye_duel\print folder:
//   npm i playwright   (once)
//   npx playwright install chromium   (once)
//   node build_pdf.js          (2.5 in tiles)
//   node build_pdf.js 67mm     (tiles for 70 mm square sleeves)
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
const LANDS = [
  ['Birchwood', 'birchwood'], ['Wolf Hollow', 'wolf-hollow'], ['Violet Peaks', 'violet-peaks'], ['Golden Fields', 'golden-fields'],
  ['Ice Cliffs', 'ice-cliffs'], ['Spire Isle', 'spire-isle'], ['Night Thicket', 'night-thicket']
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
const MOON = '<svg viewBox="0 0 24 24"><path d="M15.5 3.2A9 9 0 1 0 20.8 15 7.2 7.2 0 0 1 15.5 3.2Z" fill="#fff"/></svg>';
const ROSE = '<svg viewBox="0 0 24 24"><g fill="#fff">' + [0, 72, 144, 216, 288].map(a => `<ellipse cx="12" cy="6.4" rx="3.6" ry="5" transform="rotate(${a} 12 12)"/>`).join('') + '</g><circle cx="12" cy="12" r="2.8" fill="#B13939"/></svg>';
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
  if (t.kind === 'land') {
    body = `<div class="art full"><img src="${url(t.art)}"></div><div class="lname">${esc(t.name)}</div>`;
  } else {
    const pic = t.art ? `<img src="${url(t.art)}" class="${t.kind === 'family' ? 'portrait' : ''}">` : t.glyph ? `<div class="glyph">${GLYPH[t.glyph]}</div>` : `<div class="glyph big">${pattern(t.member)}</div>`;
    body = `<div class="art part">${pic}${t.kind === 'family' && t.art ? pattern(t.member) : ''}</div>
      <div class="label"><b>${esc(t.name)}</b><span>${esc(t.rule)}</span></div>`;
  }
  // Tiles that never go in the bag (Family and the Crossroads) get a crown badge top-left, matching the house badge.
  const crown = t.kind === 'family' || t.kind === 'start' ? `<div class="crownb">${CROWN}</div>` : '';
  return `<div class="tile own-${o}">${body}${crown}${sig ? `<div class="sig">${sig}</div>` : ''}${t.optional ? '<div class="opt-tag">Optional</div>' : ''}</div>`;
}

// ---------- pages ----------
// Tile size: default 2.5 in (playing-card width). `node build_pdf.js 67mm` makes tiles for 70 mm square sleeves.
const arg = process.argv[2] || '';
const SIZE = /mm$/.test(arg) ? parseFloat(arg) / 25.4 : /in$/.test(arg) ? parseFloat(arg) : 2.5;
const K = SIZE / 2.5;                                 // tiles are drawn at 2.5 in and scaled
const COLS = Math.floor(8.0 / SIZE), ROWS = Math.floor(10.3 / SIZE), PER = COLS * ROWS;
const X0 = (8.5 - COLS * SIZE) / 2, Y0 = Math.min(0.5, (11 - ROWS * SIZE) / 2);
const OUT = SIZE === 2.5 ? 'vye-duel-print-and-play.pdf' : `vye-duel-print-and-play-${Math.round(SIZE * 25.4)}mm.pdf`;
const sheets = [];
for (let i = 0; i < tiles.length; i += PER) sheets.push(tiles.slice(i, i + PER));
const PAGES = 2 + sheets.length * 2;
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
  .replace(/<table class="counts">[\s\S]*?<\/table>/, '<table class="counts">' + sheets.map((s, i) => `<tr><td>Sheet ${i + 1}</td><td>${sheetSummary(s)}</td></tr>`).join('') + '</table>');

const css = fs.readFileSync(path.join(HERE, 'print.css'), 'utf8').replace(/url\(fonts\//g, `url(${url('fonts')}/`);
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Vye Duel – Print and Play</title><style>${css}</style></head><body>
${rules}
${sheets.map(s => sheet(s, 0) + sheet(s, 1)).join('\n')}
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
  console.log(`${OUT}: ${tiles.length} tiles at ${(SIZE * 25.4).toFixed(1)} mm on ${sheets.length} double-sided sheets, ${PAGES} pages`);
})();
