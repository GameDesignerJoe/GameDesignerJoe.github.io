// Vye Duel print and play, small-tile edition: 0.7 in (Scrabble-size) icon tiles.
// 2 rules pages + 1 double-sided sheet holding 2 full sets of 30 tiles.
//
// Windows, from vye_duel\print\small:  node build_small_pdf.js   (needs playwright, see ..\build_pdf.js)
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const T = require('./tiles.js');
const HERE = __dirname, PRINT = path.join(HERE, '..');
const url = p => pathToFileURL(p).href;

T.setCorner(4); // nearly square corners so a slightly off cut still looks clean
const SET = T.tileSet();            // 30 tiles: { label, front, back }
const tiles = SET.concat(SET);      // two sets
const S = 0.7, COLS = 10, ROWS = Math.ceil(tiles.length / COLS);
const X0 = (8.5 - COLS * S) / 2, Y0 = 0.75;

function sheet(side) {
  let cells = '';
  tiles.forEach((t, i) => {
    const r = Math.floor(i / COLS), c = i % COLS, col = side === 0 ? c : COLS - 1 - c;
    cells += `<div class="st" style="left:${X0 + col * S}in;top:${Y0 + r * S}in">${side === 0 ? t.front : t.back}</div>`;
  });
  let marks = '';
  if (side === 0) {
    for (let c = 0; c <= COLS; c++) marks += `<div class="mk v" style="left:${X0 + c * S}in;top:${Y0 - 0.38}in"></div><div class="mk v" style="left:${X0 + c * S}in;top:${Y0 + ROWS * S + 0.1}in"></div>`;
    for (let r = 0; r <= ROWS; r++) marks += `<div class="mk h" style="top:${Y0 + r * S}in;left:${X0 - 0.38}in"></div><div class="mk h" style="top:${Y0 + r * S}in;left:${X0 + COLS * S + 0.1}in"></div>`;
  }
  const grid = side === 0 ? `<div class="sgrid" style="left:${X0}in;top:${Y0}in;width:${COLS * S}in;height:${ROWS * S}in"></div>` : '';
  const note = side === 0 ? `<div class="snote" style="top:${Y0 + ROWS * S + 0.55}in">
      <h2>Two full sets</h2><p>The top three rows are one complete game (30 tiles); the bottom three rows are a spare set. Print this sheet double-sided, flip on long edge, at actual size, then cut on the lines.
      To make sturdy tiles, print on sticker paper instead and stick the front and back onto blank 0.7 inch tiles.</p></div>` : '';
  return `<section class="page sheet">${grid}${cells}${marks}${note}<div class="foot">${side === 0 ? 'Front · cut on the lines' : 'Back of the previous page'}</div></section>`;
}

// tile key for the rules page
const mini = (svg, label) => `<figure class="key"><div class="ki">${svg}</div><figcaption>${label}</figcaption></figure>`;
const L = T.LANDS.slice(0, 7);
const KEY = `<div class="box keybox">
  <div class="krow">${L.map(l => mini(T.land(l, 'b'), l.name)).join('')}</div>
  <div class="krow">${mini(T.family('king', 'b', 'b'), 'King')}${mini(T.family('knave', 'r', 'r'), 'Knave')}${mini(T.special('usurp', 'b'), 'Usurp')}${mini(T.special('lostcity', 'r'), 'Lost City')}${mini(T.special('sinkhole', 'n'), 'Sinkhole')}${mini(T.crossroads('n'), 'Crossroads')}${mini(T.crossroads('b'), 'Captured')}</div>
  <div class="caption">Circle = Land, square = Family, hexagon = Special. Blue with a moon = Midnight owns it, red with a rose = Roses, grey = nobody. On a Family tile the dark squares show what it flips, and the mark in the middle shows its house.</div>
</div>`;

const MOON = '<svg viewBox="0 0 24 24"><path d="M15.5 3.2A9 9 0 1 0 20.8 15 7.2 7.2 0 0 1 15.5 3.2Z" fill="#fff"/></svg>';
const ROSE = '<svg viewBox="0 0 24 24"><g fill="#fff">' + [0, 72, 144, 216, 288].map(a => `<ellipse cx="12" cy="6.4" rx="3.6" ry="5" transform="rotate(${a} 12 12)"/>`).join('') + '</g><circle cx="12" cy="12" r="2.8" fill="#B13939"/></svg>';
const pat = (n, cls) => `<span class="pat n${n}">` + Array.from({ length: n * n }, (_, i) => `<i class="${cls(i)}"></i>`).join('') + '</span>';
const PAT = {
  KING: pat(3, i => i === 4 ? 'me' : [1, 3, 5, 7].includes(i) ? 'on' : ''),
  KNAVE: pat(5, i => i === 12 ? 'me' : [2, 10, 14, 22].includes(i) ? 'opt' : [7, 11, 13, 17].includes(i) ? 'skip' : ''),
  QUEEN: pat(3, i => i === 4 ? 'me' : [0, 2, 6, 8].includes(i) ? 'on' : ''),
  HEIR: pat(3, i => i === 4 ? 'me' : 'opt')
};
const swap = (s, a, b) => { if (!s.includes(a)) throw new Error('rules text changed: ' + a); return s.split(a).join(b); };
let rules = fs.readFileSync(path.join(PRINT, 'rules.html'), 'utf8');
rules = swap(rules, '{{SAMPLE}}', KEY);
rules = swap(rules, '(same house name on the tile)', '(same house mark in the middle of the tile)');
rules = swap(rules, '1 of 8', '1 of 4'); rules = swap(rules, '2 of 8', '2 of 4');
rules = swap(rules, 'US Letter paper. Light cardstock works best.', 'US Letter paper. Cardstock, or sticker paper to put on blank tiles.');
rules = swap(rules, 'Print pages 3&ndash;8', 'Print pages 3&ndash;4');
rules = swap(rules, 'Cut on the lines on the front of each sheet. Tiles are 2.5 inches, the width of a playing card.', 'Cut on the lines on the front. Tiles are 0.7 inch, the size of a Scrabble tile.');
rules = rules.replace(/<table class="counts">[\s\S]*?<\/table>/, '<table class="counts"><tr><td>One sheet</td><td>2 full sets of 30 tiles</td></tr></table>');
rules = rules.replace(/{{MOON}}/g, MOON).replace(/{{ROSE}}/g, ROSE).replace(/{{(KING|KNAVE|QUEEN|HEIR)}}/g, (_, k) => PAT[k]);

const css = fs.readFileSync(path.join(PRINT, 'print.css'), 'utf8').replace(/url\(fonts\//g, `url(${url(path.join(PRINT, 'fonts'))}/`) + `
.st { position: absolute; width: ${S}in; height: ${S}in; z-index: 1; }
.st svg { width: 100%; height: 100%; display: block; }
.sgrid { position: absolute; z-index: 2; pointer-events: none;
  background-image: linear-gradient(to right, rgba(255,255,255,.55) 0.5pt, transparent 0.5pt), linear-gradient(to bottom, rgba(255,255,255,.55) 0.5pt, transparent 0.5pt);
  background-size: ${S}in ${S}in; border-right: 0.5pt solid rgba(255,255,255,.55); border-bottom: 0.5pt solid rgba(255,255,255,.55); }
.snote { position: absolute; left: 1in; right: 1in; font-size: 10.5pt; line-height: 1.4; color: #333; }
.snote h2 { font: 700 14pt/1.1 'Alegreya SC', serif; color: var(--brass); margin: 0 0 0.05in; }
.keybox { padding: 0.08in 0.08in 0.06in; }
.krow { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.04in; margin-bottom: 0.05in; }
.key { margin: 0; text-align: center; font-size: 7pt; line-height: 1.1; color: #333; }
.key .ki { width: 0.42in; height: 0.42in; margin: 0 auto 0.02in; }
.key .ki svg { width: 100%; height: 100%; display: block; }
`;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Vye Duel – Small Tiles Print and Play</title><style>${css}</style></head><body>${rules}${sheet(0)}${sheet(1)}</body></html>`;
fs.writeFileSync(path.join(HERE, 'print-small.html'), html);

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url(path.join(HERE, 'print-small.html')), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(HERE, 'vye-duel-small-tiles-print-and-play.pdf'), format: 'Letter', printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log(`PDF written: ${tiles.length} tiles (2 sets) on 1 double-sided sheet, 4 pages`);
})();
