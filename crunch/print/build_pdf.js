// Builds the Crunch print-and-play PDF: 2 rules pages, then 4 single-sided card sheets (36 poker-size cards).
// The cards are read straight out of ../index.html, so they always match the current table build.
//
// Windows, from the crunch\print folder:
//   npm i playwright   (once)
//   npx playwright install chromium   (once)
//   node build_pdf.js
//
// Cards are 2.5 x 3.5 in (poker size), 3 x 3 per US Letter sheet, blank backs.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { pathToFileURL } = require('url');
const HERE = __dirname;

// ---------- the game, from the table build ----------
const src = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
const engine = src.slice(src.indexOf('/* Crunch (table version) — rules engine'));
const sandbox = { module: { exports: {} } };
vm.runInNewContext(engine.slice(0, engine.indexOf('</script>')), sandbox);
const C = sandbox.module.exports, S = C.DEFAULTS;
const BUILD = (src.match(/BUILD = '([^']+)'/) || [, 'table'])[1];
const TASKS = C.newGame(null, { seed: 1 }).cards.filter(c => !c.event).sort((a, b) => a.uid - b.uid);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const ROLE_OF = { prod: 'Producer', art: 'Artist', code: 'Engineer', design: 'Designer' };
const WORD_SLOT = { art: 'Title: first word', design: 'Title: second word', code: 'Title: subtitle' };

// review score <-> points
const MAX = C.newGame(null, { seed: 1 }).maxPts;
const scoreOf = pts => Math.round(100 * pts / MAX);
const ptsFor = sc => { let p = 0; while (scoreOf(p) < sc) p++; return p; };
const BANDS = [[90, 'Game of the Year'], [80, 'A hit'], [70, 'Solid'], [55, 'Mixed reviews'], [40, 'A flop'], [0, 'Studio closed']];
const WIN = ptsFor(S.target);
const bandRows = BANDS.map(([sc, name], i) => {
  const lo = ptsFor(sc), hi = i ? ptsFor(BANDS[i - 1][0]) - 1 : MAX;
  return `<tr class="${sc === S.target ? 'win' : ''}"><td>${name}${sc === S.target ? ' (you win)' : ''}</td><td>${sc ? lo + (i ? '&ndash;' + hi : '+') : 'under ' + (hi + 1)}</td></tr>`;
}).join('');

// ---------- cards ----------
const POWERS = {
  producer: ['Gets it done', 'Anything you crunch from Behind Schedule is done right, whatever its discipline.'],
  artist: ['Flow', 'The first task you crunch and do right each turn needs no roll.'],
  engineer: ['Fixer', 'You can crunch to fix anyone&rsquo;s half-assed task, not just Code.'],
  designer: ['Bang it out', 'The first task you crunch half-assed each turn needs no roll. That includes your own Design tasks.']
};
function taskCard(t) {
  const perk = t.perk ? C.PERKS[t.perk] : null, big = t.perk === 'big';
  const ex = ['prod', 'art', 'code', 'design'].filter(d => d !== t.disc).map(d => `<p class="d-${d}"><b>${ROLE_OF[d]}:</b> ${esc(t.comp[d])}</p>`).join('');
  return `<div class="card task d-${t.disc}">
    <div class="half"><span>Half-assed &middot; ${S.ptsComp} pts</span><b class="${t.bad ? '' : 'none'}">${esc(t.bad || 'x')}</b></div>
    <div class="main">
      <div class="band"><span>${C.DISC[t.disc].name}</span><span class="pts">${big ? S.ptsRight * 2 : S.ptsRight} pts</span></div>
      <div class="nm">${esc(t.name)}</div>
      <div class="right"><b>${ROLE_OF[t.disc]}</b> does it right. Anyone else half-asses it: turn it sideways.</div>
      ${perk ? `<div class="perk"><b>${perk.name}</b>${esc(perk.text)}</div>` : ''}
      <div class="ex"><h4>Half-assed excuses</h4>${ex}</div>
      <div class="word ${t.word ? '' : 'none'}">${t.word ? `<span>${WORD_SLOT[t.disc]}</span><b>${esc(t.word)}</b>` : '<span>No title word</span>'}</div>
    </div></div>`;
}
function eventCard(e) {
  return `<div class="card ev d-event"><div class="band"><span>Event</span><span class="pts">Crunch die +1</span></div>
    <div class="nm">${esc(e.name)}</div><div class="fl">${esc(e.text)}</div>
    <div class="hit">+${e.add}<span>Behind Schedule</span></div>
    <ol><li>Move ${e.add} task${e.add === 1 ? '' : 's'} from the <b>bottom</b> of the deck to Behind Schedule. Skip red cards.</li><li>Leave this card on the table.</li><li>Draw again.</li></ol></div>`;
}
function checkinCard() {
  return `<div class="card ev d-event"><div class="band"><span>Publisher</span></div>
    <div class="nm">${esc(C.CHECKIN.name)}</div><div class="fl">${esc(C.CHECKIN.text)}</div>
    <div class="hit">${S.behindLimit}<span>or more Behind Schedule: cancelled</span></div>
    <ol><li>Count the tasks Behind Schedule.</li><li><b>${S.behindLimit} or more:</b> the project is cancelled. Everyone loses.</li><li>Fewer: discard this and draw again.</li></ol></div>`;
}
function roleCard(r, i) {
  const d = C.ROLE_DISC[r], name = C.ROLES[r].name, disc = C.DISC[d].name, [pn, pt] = POWERS[r];
  return `<div class="card role d-${d}">
    <div class="fresh"><div class="band"><span>Role &middot; Fresh</span><span class="pts">Goes ${['1st', '2nd', '3rd', '4th'][i]}</span></div>
      <div class="nm">${name}<small>${disc}</small></div>
      <p>You do <b>${disc}</b> right. You half-ass everything else.</p>
      <div class="pow"><b>${pn}.</b> ${pt}</div></div>
    <div class="burn"><div class="band"><span>Burned Out</span><span class="pts">${name}</span></div>
      <div class="nm">Burned Out<small>Turn the card around to show it</small></div>
      <p>Everything you do is <b>half-assed</b>, even ${disc}. You cannot crunch.</p>
      <p>At the end of your next turn, turn the card back. You are Fresh again.</p></div></div>`;
}
const turnCard = `<div class="card ref"><div class="band"><span>Reference</span></div><h3>Your turn</h3>
  <ol><li><b>Draw</b> until you hold ${S.handSize}. Red card? Do what it says, then draw again.</li>
  <li><b>One task from your hand is free.</b> Your discipline: do it right (upright). Otherwise half-ass it (sideways).</li>
  <li><b>Anything more is a crunch:</b> another card from your hand, a task from Behind Schedule, or fixing a half-assed task of your discipline. Then roll.</li>
  <li><b>Free moves:</b> hand to Behind Schedule, or Behind Schedule to hand (never hold more than ${S.handSize}).</li>
  <li><b>Once,</b> after your free task, you may draw one more card.</li>
  <li><b>Keep ${S.handSize - 1}.</b> Extras go Behind Schedule.</li></ol>
  <div class="eg">A card you took or drew after your free task can&rsquo;t be the free task. Crunch it or hold it.</div></div>`;
const dieCard = `<div class="card ref"><div class="band"><span>Reference</span></div><h3>The crunch die</h3>
  <p>After every crunch, roll one die. The task is done either way.</p>
  <p><b>To stay Fresh, roll higher than:</b></p>
  <ul><li>the crunches you have made this turn, counting this one</li><li><b>plus 1</b> for each Event card on the table</li></ul>
  <p><b>Fail:</b> you are Burned Out and your turn ends. Turn your role card around.</p>
  <table><tr><td>1st crunch, no Events</td><td>2 or more</td></tr><tr><td>2nd crunch, no Events</td><td>3 or more</td></tr><tr><td>1st crunch, 2 Events</td><td>4 or more</td></tr><tr><td>2nd crunch, 3 Events</td><td>6 only</td></tr></table>
  <div class="eg">Keep crunching for as long as you dare.</div></div>`;
const reviewCard = `<div class="card ref"><div class="band"><span>Reference</span></div><h3>The review</h3>
  <table><tr><td>Done right (upright)</td><td>${S.ptsRight}</td></tr><tr><td>Tentpole done right</td><td>${S.ptsRight * 2}</td></tr><tr><td>Half-assed (sideways)</td><td>${S.ptsComp}</td></tr><tr><td>Each Feature</td><td>+${S.ptsFeature}</td></tr></table>
  <p>A <b>Feature</b> is four done-right tasks, one from each discipline.</p>
  <table>${bandRows}</table>
  <div class="eg">Review score out of 100 = points &divide; ${MAX} &times; 100. You need ${S.target}, which is ${WIN} points.</div></div>`;

const cards = [].concat(
  C.ROLE_ORDER.map(roleCard), [turnCard, turnCard, dieCard, reviewCard],
  C.EVENTS.map(eventCard), [checkinCard(), checkinCard()].slice(0, S.checkins),
  TASKS.map(taskCard));
const LABEL = ['4 roles, 4 reference cards, 1 event', '5 events, 2 Publisher Check-Ins, 2 tasks', '9 tasks', '9 tasks'];

// ---------- pages ----------
const W = 2.5, H = 3.5, COLS = 3, ROWS = 3, PER = 9, X0 = (8.5 - COLS * W) / 2, Y0 = (11 - ROWS * H) / 2;
const sheets = []; for (let i = 0; i < cards.length; i += PER) sheets.push(cards.slice(i, i + PER));
const PAGES = 2 + sheets.length;
const sheet = (list, n) => `<section class="page sheet">${list.map((c, i) => `<div class="cell" style="left:${X0 + (i % COLS) * W}in;top:${Y0 + Math.floor(i / COLS) * H}in">${c}</div>`).join('')}
  <div class="cutgrid" style="left:${X0}in;top:${Y0}in;width:${COLS * W}in;height:${Math.ceil(list.length / COLS) * H}in;background-size:${W}in ${H}in"></div>
  <div class="sidefoot">Crunch &middot; sheet ${n + 1} of ${sheets.length} &middot; ${LABEL[n] || ''} &middot; cut on the lines &middot; page ${n + 3} of ${PAGES}</div></section>`;

const nTasks = TASKS.length, nDeck = nTasks + S.events + S.checkins;
const rules = `<section class="page rules">
  <header class="masthead"><div><h1><span>CRUNCH</span></h1><div class="tag">A co-op card game about shipping a video game</div></div>
    <div class="meta">2&ndash;4 players &middot; about 20 minutes<br>Print and play &middot; ${esc(BUILD)}</div></header>
  <div class="cols">
    <h2>The goal</h2>
    <p>You are a studio. The deck is your work and your calendar: when it runs out, the game ships and gets reviewed. Everyone wins or loses together. Talk freely. You win with a review of <b>${S.target} or better</b>.</p>

    <h2>What you need</h2>
    <ul><li><b>${nTasks} task cards</b>, 5 in each discipline:
      <span class="chip d-prod">Production</span> <span class="chip d-art">Art</span> <span class="chip d-code">Code</span> <span class="chip d-design">Design</span></li>
      <li><b>${C.EVENTS.length} Event cards</b> and <b>${S.checkins} Publisher Check-Ins</b> (the red cards)</li>
      <li><b>4 role cards</b> and <b>4 reference cards</b></li>
      <li>One six-sided die, which is not in this file</li></ul>

    <h2>Setup</h2>
    <ol><li>Deal out the four roles. All four are always in the game: with fewer than four players, someone runs two.</li>
      <li>Shuffle the ${C.EVENTS.length} Events face down and take <b>${S.events}</b> without looking. The rest go back in the box.</li>
      <li>Shuffle those ${S.events} Events, the ${S.checkins} Check-Ins and the ${nTasks} tasks together. This ${nDeck}-card deck goes face down in the middle.</li>
      <li>Leave room for a <b>Behind Schedule</b> row beside the deck, and for four <b>Shipped</b> stacks, one per discipline.</li>
      <li>Nobody starts with cards. The Producer goes first, then the Artist, the Engineer and the Designer.</li></ol>
    <div class="lay"><div class="d-prod">PRODUCTION</div><div class="d-art">ART</div><div class="d-code">CODE</div><div class="d-design">DESIGN</div></div>
    <p style="font-size:8pt;color:var(--muted)">The four Shipped stacks. Fan each one so you can see every card.</p>

    <h2>Your turn</h2>
    <ol><li><b>Draw</b> until you hold ${S.handSize} cards. If you draw a red card, do what it says and draw again.</li>
      <li><b>One task from your hand is free.</b> If it is your discipline, do it right: put it upright on its Shipped stack. If it is not, half-ass it: put it on its stack <b>sideways</b>, and read out your excuse from the card. You may half-ass your own discipline too.</li>
      <li><b>Anything more is a crunch.</b> You can crunch another card from your hand, any task from Behind Schedule, or fix a half-assed task of your own discipline (turn it upright). After each crunch, roll the die. Keep going for as long as you dare.</li>
      <li><b>Moving cards is free.</b> Put a card from your hand Behind Schedule, or take one from Behind Schedule into your hand, as long as you never hold more than ${S.handSize}. A card you take this turn cannot be your free task this turn: crunch it, or hold it.</li>
      <li><b>Once per turn, after your free task, you may draw one more card.</b> It cannot be your free task either.</li>
      <li><b>Keep ${S.handSize - 1} card</b> at most for next turn. Anything extra goes Behind Schedule.</li></ol>
    <p>New Behind Schedule cards go on the right end of the row, so the oldest is always on the left.</p>

    <h2>The crunch die</h2>
    <p>After each crunch, roll. To stay Fresh the die must be <b>higher</b> than the number of crunches you have made this turn (counting this one), <b>plus 1 for each Event card on the table</b>. The task you crunched is done either way.</p>
    <div class="box"><h3>Example</h3><p>One Event is out. The Artist&rsquo;s first crunch must beat 2, so a 3 or more is safe. She dares a second: now it must beat 3.</p></div>
    <p><b>Fail</b> and you are <b>Burned Out</b>, and your turn ends. Turn your role card around. While Burned Out, everything you do is half-assed, even your own discipline, and you cannot crunch. At the end of your next turn, turn the card back: you are Fresh again.</p>
  </div><div class="pageno">1 of ${PAGES}</div></section>

<section class="page rules"><div class="cols">
    <h2>Roles</h2>
    <p>Each role does its own discipline right and half-asses everything else. Each also bends one rule:</p>
    <ul>${C.ROLE_ORDER.map(r => `<li><b>${C.ROLES[r].name}: ${POWERS[r][0]}.</b> ${POWERS[r][1]}</li>`).join('')}</ul>

    <h2>Task perks</h2>
    <p>Some tasks have a perk in a dark box. It only happens if the task is done right.</p>
    <ul>${Object.keys(C.PERKS).map(k => `<li><b>${C.PERKS[k].name}.</b> ${esc(C.PERKS[k].text)}</li>`).join('')}</ul>

    <h2>Red cards</h2>
    <p><b>Events.</b> Move the number of tasks it says from the <b>bottom</b> of the deck to Behind Schedule, skipping any red cards. The Event stays on the table for the rest of the game and makes every crunch roll 1 harder. Then draw again.</p>
    <p><b>Publisher Check-In.</b> The publisher counts Behind Schedule. If there are <b>${S.behindLimit} or more</b>, the project is cancelled and everyone loses. Otherwise discard it and draw again.</p>

    <h2>Launch week</h2>
    <p>When the deck runs out, finish the round without drawing. Then everyone takes one last turn, starting with the Producer, with no drawing. On these turns, if your hand is empty, your free task can come from Behind Schedule. Crunch as much as you dare. Then you ship.</p>

    <h2>The name of the game</h2>
    <p>Look at the top card of the Art, Design and Code stacks. Art gives the first word, Design the second, and Code the subtitle. An upright card uses the word at its foot. A sideways card uses the word on its grey edge, which is now along the top. A fixed task keeps its place in the stack.</p>
    <div class="box"><h3>Example</h3><p>Art is topped by an upright Open World Vistas, Design by a sideways Boss Fight and Code by an upright Netcode. You shipped <b>Eternal Clone: Online</b>.</p></div>

    <h2>The review</h2>
    <table class="t"><tr><td>Each task done right (upright)</td><td>${S.ptsRight}</td></tr><tr><td>A Tentpole done right</td><td>${S.ptsRight * 2}</td></tr><tr><td>Each half-assed task (sideways)</td><td>${S.ptsComp}</td></tr><tr><td>Unfinished tasks, in hand or Behind Schedule</td><td>0</td></tr><tr><td>Each Feature: four done-right tasks, one from each discipline</td><td>+${S.ptsFeature}</td></tr></table>
    <p>Your number of Features is the smallest count of upright cards in any one stack. A perfect game is ${MAX} points.</p>
    <table class="t">${bandRows}</table>
    <p>For a review score out of 100, divide your points by ${MAX} and multiply by 100. You need ${S.target}, which is ${WIN} points.</p>

    <div class="box dark"><h3>Printing</h3>
      <ol><li>Print pages 3&ndash;${PAGES} <b>single-sided at actual size</b> (100%, not &ldquo;fit to page&rdquo;) on US Letter. Light cardstock works best.</li>
        <li>Cut on the grey lines. Cards are poker size, 2.5 &times; 3.5 inches.</li>
        <li>The backs are blank. On thin paper the red cards can show through, so slip each card into a sleeve in front of an old playing card.</li></ol></div>
  </div><div class="pageno">2 of ${PAGES}</div></section>`;

const css = fs.readFileSync(path.join(HERE, 'print.css'), 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Crunch – Print and Play</title><style>${css}</style></head><body>
${rules}
${sheets.map(sheet).join('\n')}
</body></html>`;
fs.writeFileSync(path.join(HERE, 'print.html'), html);

const OUT = 'crunch-print-and-play.pdf';
(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(HERE, 'print.html')).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(HERE, OUT), format: 'Letter', printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log(`${OUT}: ${cards.length} cards on ${sheets.length} single-sided sheets, ${PAGES} pages. Perfect game ${MAX} points, win at ${WIN}.`);
})();
