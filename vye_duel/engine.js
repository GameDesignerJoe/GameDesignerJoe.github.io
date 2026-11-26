/* Vye Duel — rules engine, AI personas and batch simulator.
   Runs in the browser (global VyeEngine) and in Node (module.exports). */
(function (root) {
  'use strict';

  // ---------- coordinates ----------
  const SIZE = 64, OFF = 32;
  const key = (x, y) => (x + OFF) * SIZE + (y + OFF);
  const kx = k => Math.floor(k / SIZE) - OFF;
  const ky = k => (k % SIZE) - OFF;
  const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const ALL8 = ORTHO.concat(DIAG);
  const ORTHO_D = ORTHO.map(([dx, dy]) => dx * SIZE + dy);
  const DIAG_D = DIAG.map(([dx, dy]) => dx * SIZE + dy);
  const ALL8_D = ORTHO_D.concat(DIAG_D);

  // ---------- content ----------
  const LANDS = [
    // The first 7 are the ones in play by default and in the print and play (landSets: 7 takes them in order).
    { name: 'Dragon Keep', art: 'dragon-keep', glyph: '♜', color: '#9C3D2E' },
    { name: 'Longship', art: 'longship', glyph: '♦', color: '#2F6FA0' },
    { name: 'Owl Marsh', art: 'owl-marsh', glyph: '✱', color: '#3E8E7E' },
    { name: 'Raven Moor', art: 'raven-moor', glyph: '✶', color: '#4A4458' },
    { name: 'Firelands', art: 'firelands', glyph: '✹', color: '#D9792B' },
    { name: 'Violet Peaks', art: 'violet-peaks', glyph: '▲', color: '#8C5D88' },
    { name: 'Green Hills', art: 'green-hills', glyph: '■', color: '#7FA44A' },
    // the other nine, used when more than 7 Land types are switched on in Setup
    { name: 'Wolf Hollow', art: 'wolf-hollow', glyph: '◐', color: '#8A9289' },
    { name: 'Spire Isle', art: 'spire-isle', glyph: '⌂', color: '#79A08A' },
    { name: 'Ice Cliffs', art: 'ice-cliffs', glyph: '❄', color: '#7E8E9E' },
    { name: 'Golden Fields', art: 'golden-fields', glyph: '☼', color: '#B5834C' },
    { name: 'Night Thicket', art: 'night-thicket', glyph: '●', color: '#AB9764' },
    { name: 'Birchwood', art: 'birchwood', glyph: '♣', color: '#7A6554' },
    { name: 'High Peaks', art: 'high-peaks', glyph: '△', color: '#664D36' },
    { name: 'Whale Sea', art: 'whale-sea', glyph: '≈', color: '#275B5E' },
    { name: 'Stag Forest', art: 'stag-forest', glyph: '♠', color: '#4F3D28' }
  ];

  const MEMBERS = {
    advisor: { name: 'Advisor', dirs: ALL8_D, rule: 'Flips all 8 surrounding tiles.' },
    king: { name: 'King', dirs: ORTHO_D, rule: 'Flips the 4 adjacent tiles.' },
    queen: { name: 'Queen', dirs: DIAG_D, rule: 'Flips the 4 diagonal tiles.' },
    heir: { name: 'Heir', dirs: null, rule: 'Flips 1 surrounding tile of your choice.' },
    knave: { name: 'Knave', dirs: null, rule: 'Does the family\u2019s dirty work: slips past an adjacent tile and flips the tile on its far side.' }
  };
  const MEMBER_ORDER = ['advisor', 'king', 'queen', 'heir', 'knave'];

  const HOUSES = [
    { name: 'House Midnight', short: 'Midnight', sigil: '☾', color: 'blue', art: 'blue' },
    { name: 'House of a Thousand Roses', short: 'Roses', sigil: '✿', color: 'red', art: 'red' }
  ];

  // mode: place = goes in an empty space, cover = stacks on a tile, replace = swaps a tile out
  const SPECIALS = {
    lostcity: { name: 'Lost City', mode: 'cover', origin: 'Original',
      rule: 'Cover a Land you own. Worth extra points in your kingdom (set below).' },
    sinkhole: { name: 'Sinkhole', mode: 'cover', origin: 'Original',
      rule: 'Cover any tile. Nobody owns it, ever. Breaks connections.' },
    sanctuary: { name: 'Sanctuary', mode: 'cover', origin: 'Original',
      rule: 'Cover any tile. Owned by both players. Can’t be flipped or moved, and can only be covered when stacking is Unlimited.' },
    underminers: { name: 'Underminers', mode: 'place', origin: 'Adapted',
      rule: 'Place it, then flip the tile on the far side of an adjacent tile.' },
    earthquake: { name: 'Earthquake', mode: 'place', origin: 'Original',
      rule: 'Place it, then swap any two tiles (not Sanctuary). Nothing triggers.' },
    waystone: { name: 'Waystone', mode: 'place', origin: 'Original',
      rule: 'Place it and take another turn. Flipping it also grants an extra turn.' },
    usurp: { name: 'Usurp', mode: 'replace', origin: 'New',
      rule: 'Swap a Land on the board for a Land from your hand, then match. Old Land goes under the deck.' },
    rally: { name: 'Rally', mode: 'cover', origin: 'New',
      rule: 'Cover any Land. It becomes yours, keeps that Land\u2019s colour, and matches again.' }
  };
  const SPECIAL_ORDER = ['lostcity', 'sinkhole', 'sanctuary', 'usurp', 'rally', 'underminers', 'earthquake', 'waystone'];

  function defaultConfig() {
    return {
      landSets: 7,
      landCopies: 3,
      specials: { lostcity: 1, sinkhole: 1, sanctuary: 0, usurp: 1, rally: 0, underminers: 0, earthquake: 0, waystone: 0 },
      family: [{ advisor: 0, king: 1, queen: 0, heir: 0, knave: 1 }, { advisor: 0, king: 1, queen: 0, heir: 0, knave: 1 }],
      gridW: 5, gridH: 5,
      handSize: 3,
      start: 'neutral',      // neutral | none
      stacking: 'unlimited', // once | unlimited (unlimited: any tile can be covered, Sanctuary and Sinkhole included)
      crossroadsCover: false,   // can cover cards be played on the Crossroads?
      crossroadsCapture: true,  // can Family captures take the Crossroads?
      lostCityValue: 2,      // points a Lost City is worth in your kingdom
      usurpMode: 'swap',     // swap = trade a Land from your hand for one on the board | take = flip any opponent Land to you, no matching
      usurpMatch: true,      // swap mode: does the Land put down by Usurp trigger matching?
      quakeMode: 'any',      // Earthquake: any = swap any two tiles | far = a tile two spaces away with any other Land | adjacent = two Lands next to each other
      rallyReach: 'own',     // Rally: own = rematch the covered Land's colour | all = also take every adjacent Land and match its colour
      secondApart: false,    // second player's first tile can't go on or next to a first-player tile
      colorCapture: true,
      end: { boardFull: true, deckEmpty: false, noValidPlay: true },
      tiebreak: 'second',    // none | total | second  (default: the second player wins ties)
      secondExtraCards: 0,   // second player starts with this many extra cards
      secondBonus: 0         // points added to the second player's kingdom at the end
    };
  }

  // ---------- rng ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }

  // ---------- cards ----------
  function cardLabel(c) {
    if (c.kind === 'land') return 'Land';
    if (c.kind === 'family') return MEMBERS[c.member].name;
    if (c.kind === 'special') return SPECIALS[c.special].name;
    return 'Start';
  }
  function cardTitle(c) {
    if (c.kind === 'land') return LANDS[c.land].name;
    if (c.kind === 'family') return HOUSES[c.house].short + ' ' + MEMBERS[c.member].name;
    if (c.kind === 'special') return SPECIALS[c.special].name;
    return 'Crossroads';
  }

  function newGame(cfg, seed) {
    cfg = JSON.parse(JSON.stringify(cfg));
    const rng = mulberry32(seed >>> 0);
    let id = 1;
    const deck = [];
    for (let l = 0; l < cfg.landSets; l++)
      for (let c = 0; c < cfg.landCopies; c++) deck.push({ id: id++, kind: 'land', land: l });
    for (const s of SPECIAL_ORDER) {
      const n = (cfg.specials && cfg.specials[s]) | 0;
      for (let i = 0; i < n; i++) deck.push({ id: id++, kind: 'special', special: s });
    }
    shuffle(deck, rng);
    const players = [0, 1].map(p => {
      const side = [];
      for (const m of MEMBER_ORDER) {
        const n = (cfg.family[p] && cfg.family[p][m]) | 0;
        for (let i = 0; i < n; i++) side.push({ id: id++, kind: 'family', member: m, house: p });
      }
      return { hand: [], side };
    });
    for (let i = 0; i < cfg.handSize; i++) for (const pl of players) if (deck.length) pl.hand.push(deck.pop());
    for (let i = 0; i < (cfg.secondExtraCards | 0); i++) if (deck.length) players[1].hand.push(deck.pop());
    const board = new Map();
    if (cfg.start === 'neutral') board.set(key(0, 0), [{ id: id++, kind: 'start', owner: null }]);
    const state = {
      cfg, rng, seed, board, deck, players, discard: [],
      turn: 0, turnNo: 0, passes: 0, over: false, endReason: null, winner: null,
      plays: [], log: [], lastMove: null, initialDeck: deck.length, leads: []
    };
    state.moves = legalMoves(state, 0);
    if (!state.moves.length) checkEnd(state, true);
    return state;
  }

  // ---------- board helpers ----------
  const top = (board, k) => { const s = board.get(k); return s ? s[s.length - 1] : null; };
  // A Rally keeps the colour of the Land it covers, so it matches and chains like that Land.
  const landOf = t => !t ? -1 : t.kind === 'land' ? t.land : t.special === 'rally' && t.land != null ? t.land : -1;
  const ownedBy = (t, p) => t && (t.owner === p || t.owner === 'both');
  function canFlip(t) {
    if (!t || (t.owner !== 0 && t.owner !== 1)) return false;
    if (t.kind === 'start') return false;
    return t.special !== 'sanctuary' && t.special !== 'sinkhole';
  }
  // Family captures may also take the neutral Crossroads when the rule is on.
  function canTake(t, p, fam, cfg) {
    if (t && t.kind === 'start' && fam && cfg && cfg.crossroadsCapture) return t.owner !== p;
    return canFlip(t) && t.owner !== p;
  }
  function setTop(board, k, tile) { const s = board.get(k).slice(); s[s.length - 1] = tile; board.set(k, s); }
  function pushTile(board, k, tile) { const s = board.get(k); board.set(k, s ? s.concat([tile]) : [tile]); }

  function bbox(board) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const k of board.keys()) { const x = kx(k), y = ky(k); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, x1, y0, y1 };
  }
  function placeCells(state) {
    const { board, cfg } = state;
    if (board.size === 0) return [key(0, 0)];
    const b = bbox(board);
    const out = new Set();
    for (const k of board.keys()) {
      for (const d of ORTHO_D) {
        const n = k + d;
        if (board.has(n) || out.has(n)) continue;
        const x = kx(n), y = ky(n);
        if (Math.max(b.x1, x) - Math.min(b.x0, x) + 1 > cfg.gridW) continue;
        if (Math.max(b.y1, y) - Math.min(b.y0, y) + 1 > cfg.gridH) continue;
        out.add(n);
      }
    }
    return [...out];
  }
  function coverable(state, k) {
    const s = state.board.get(k);
    if (!s) return false;
    const t = s[s.length - 1], unl = state.cfg.stacking === 'unlimited';
    if (t.kind === 'start' && !state.cfg.crossroadsCover) return false;
    if (t.special === 'sanctuary' && !unl) return false;
    if (!unl && s.length > 1) return false;
    return true;
  }
  function components(board, p, skip) {
    const comp = new Map(); let n = 0;
    for (const k of board.keys()) {
      if (k === skip || comp.has(k) || !ownedBy(top(board, k), p)) continue;
      const q = [k]; comp.set(k, n);
      while (q.length) { const c = q.pop(); for (const d of ORTHO_D) { const m = c + d; if (m !== skip && !comp.has(m) && board.has(m) && ownedBy(top(board, m), p)) { comp.set(m, n); q.push(m); } } }
      n++;
    }
    return comp;
  }
  function score(board, cfg) {
    const lc = cfg && cfg.lostCityValue != null ? cfg.lostCityValue : 2;
    const largest = [0, 0], total = [0, 0];
    for (const p of [0, 1]) {
      const seen = new Set();
      for (const k of board.keys()) {
        const t = top(board, k);
        if (!ownedBy(t, p)) continue;
        total[p] += t.special === 'lostcity' ? lc : 1;
        if (seen.has(k)) continue;
        let v = 0; const q = [k]; seen.add(k);
        while (q.length) {
          const c = q.pop(); const tc = top(board, c); v += tc.special === 'lostcity' ? lc : 1;
          for (const d of ORTHO_D) { const m = c + d; if (!seen.has(m) && board.has(m) && ownedBy(top(board, m), p)) { seen.add(m); q.push(m); } }
        }
        if (v > largest[p]) largest[p] = v;
      }
    }
    return { largest, total };
  }

  // ---------- move generation ----------
  function flipTargets(board, k, p, dirs, cfg) {
    const out = [];
    for (const d of dirs) { const t = top(board, k + d); if (canTake(t, p, true, cfg)) out.push(k + d); }
    return out;
  }
  // Tiles two spaces away, past an occupied neighbour (Underminers and the Knave).
  function jumpTargets(board, k, p, fam, cfg) {
    const tg = [];
    for (const d of ORTHO_D) { if (!board.has(k + d)) continue; const t = top(board, k + 2 * d); if (canTake(t, p, fam, cfg)) tg.push(k + 2 * d); }
    return tg;
  }

  // All moves for one card. opts.prune limits Earthquake enumeration for the AI.
  function cardMoves(state, p, card, src, opts) {
    const { board } = state;
    const moves = [];
    const add = (k, choice) => moves.push({ cardId: card.id, src, pos: k, choice: choice === undefined ? null : choice });
    const occupied = [...board.keys()];
    if (card.kind === 'land') { for (const k of placeCells(state)) add(k); return moves; }
    if (card.kind === 'family') {
      for (const k of placeCells(state)) {
        if (card.member === 'heir') { const t = flipTargets(board, k, p, ALL8_D, state.cfg); if (t.length) t.forEach(c => add(k, c)); else add(k); }
        else if (card.member === 'knave') { const t = jumpTargets(board, k, p, true, state.cfg); if (t.length) t.forEach(c => add(k, c)); else add(k); }
        else add(k);
      }
      return moves;
    }
    const s = card.special;
    switch (s) {
      case 'lostcity':
        for (const k of occupied) { const t = top(board, k); if (coverable(state, k) && landOf(t) >= 0 && t.owner === p) add(k); }
        break;
      case 'sinkhole':
        for (const k of occupied) if (coverable(state, k) && (state.cfg.stacking === 'unlimited' || top(board, k).special !== 'sinkhole')) add(k);
        break;
      case 'sanctuary':
        for (const k of occupied) if (coverable(state, k)) add(k);
        break;
      case 'rally':
        for (const k of occupied) if (coverable(state, k) && landOf(top(board, k)) >= 0) add(k);
        break;
      case 'usurp': {
        if (state.cfg.usurpMode === 'take') {
          for (const k of occupied) { const t = top(board, k); if (landOf(t) >= 0 && canTake(t, p, false, state.cfg)) add(k); }
          break;
        }
        const hand = state.players[p].hand.filter(c => c.kind === 'land' && c.id !== card.id);
        const byType = new Map(); hand.forEach(c => { if (!byType.has(c.land)) byType.set(c.land, c); });
        if (!byType.size) break;
        for (const k of occupied) {
          const st = board.get(k); if (st.length !== 1 || st[0].kind !== 'land') continue;
          for (const c of byType.values()) if (!(c.land === st[0].land && st[0].owner === p)) add(k, { cardId: c.id, land: c.land });
        }
        break;
      }
      case 'underminers':
        for (const k of placeCells(state)) {
          const tg = jumpTargets(board, k, p, false, state.cfg);
          if (tg.length) tg.forEach(c => add(k, c)); else add(k);
        }
        break;
      case 'earthquake': {
        let cells = placeCells(state);
        if (opts && opts.prune && cells.length > 3) cells = shuffle(cells.slice(), state.rng || Math.random).slice(0, 3);
        const qm = state.cfg.quakeMode || 'any';
        const swappable = c => { const t = top(board, c); return t && t.special !== 'sanctuary'; };
        const isLand = c => landOf(top(board, c)) >= 0;
        const pair = (k, a, b) => {
          if (opts && opts.prune) { const oa = top(board, a).owner, ob = top(board, b).owner; if (oa === ob) return; }
          add(k, [a, b]);
        };
        if (qm === 'far' || qm === 'adjacent') {
          const lands = occupied.filter(isLand);
          for (const k of cells) {
            add(k, null);
            if (qm === 'adjacent') {
              for (const a of lands) for (const d of [ORTHO_D[0], ORTHO_D[2]]) if (isLand(a + d)) pair(k, a, a + d);
            } else {
              // like the Knave: past an occupied neighbour to the tile two spaces away, then swap it with any other Land
              const far = ORTHO_D.filter(d => board.has(k + d) && board.has(k + 2 * d) && swappable(k + 2 * d)).map(d => k + 2 * d);
              for (const a of far) for (const b of lands) if (b !== a && !(isLand(a) && far.includes(b) && b < a)) pair(k, a, b);
            }
          }
          break;
        }
        for (const k of cells) {
          add(k, null);
          const all = occupied.concat([k]).filter(c => c === k || top(board, c).special !== 'sanctuary');
          for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
            const a = all[i] === k ? null : top(board, all[i]), b = all[j] === k ? null : top(board, all[j]);
            if (opts && opts.prune) { // skip swaps that can't change ownership layout
              const oa = a ? a.owner : p, ob = b ? b.owner : p; if (oa === ob) continue;
            }
            add(k, [all[i], all[j]]);
          }
        }
        break;
      }
      case 'waystone':
        for (const k of placeCells(state)) add(k);
        break;
    }
    return moves;
  }

  function legalMoves(state, p, opts) {
    const out = legalMovesAll(state, p, opts);
    // Optional opening rule: the second player's first tile keeps its distance from the first player.
    if (p === 1 && state.cfg.secondApart && state.plays && !state.plays.some(x => x.p === 1)) {
      const near = k => [k].concat(ORTHO_D.map(d => k + d)).some(n => { const t = top(state.board, n); return t && t.owner === 0; });
      const ok = out.filter(m => !near(m.pos));
      if (ok.length) return ok;
    }
    return out;
  }
  function legalMovesAll(state, p, opts) {
    const pl = state.players[p];
    const out = [];
    const seen = new Set();
    for (const c of pl.hand) {
      const sig = c.kind + (c.land ?? '') + (c.special ?? '');
      if (opts && opts.dedupe && seen.has(sig)) continue; seen.add(sig);
      out.push(...cardMoves(state, p, c, 'hand', opts));
    }
    const seenSide = new Set();
    for (const c of pl.side) {
      if (opts && opts.dedupe && seenSide.has(c.member)) continue; seenSide.add(c.member);
      out.push(...cardMoves(state, p, c, 'side', opts));
    }
    return out;
  }

  // ---------- effects (board only) ----------
  function findCard(state, p, id) {
    const pl = state.players[p];
    return pl.hand.find(c => c.id === id) || pl.side.find(c => c.id === id);
  }
  function applyEffect(board, cfg, p, card, k, choice) {
    const res = { flips: [], from: {}, extra: false, removed: null, placed: k };
    const flip = (n, fam) => { const t = top(board, n); if (canTake(t, p, fam, cfg)) { setTop(board, n, Object.assign({}, t, { owner: p })); res.flips.push(n); res.from[n] = t.owner; if (t.special === 'waystone') res.extra = true; } };
    const landMatch = (start, L) => {
      const seen = new Set([start]); const q = [start];
      while (q.length) { const c = q.pop(); for (const d of ORTHO_D) { const n = c + d; if (!seen.has(n) && landOf(top(board, n)) === L) { seen.add(n); flip(n); q.push(n); } } }
    };
    const familyCapture = (member, house, heirChoice, color) => {
      if (member === 'heir' || member === 'knave') { if (heirChoice != null) flip(heirChoice, true); }
      else for (const d of MEMBERS[member].dirs) flip(k + d, true);
      if (color && cfg.colorCapture) for (const d of ORTHO_D) { const t = top(board, k + d); if (t && t.kind === 'family' && t.house === house) flip(k + d, true); }
    };
    const base = { id: card.id, kind: card.kind, owner: p };
    if (card.kind === 'land') { pushTile(board, k, Object.assign(base, { land: card.land })); landMatch(k, card.land); return res; }
    if (card.kind === 'family') { pushTile(board, k, Object.assign(base, { member: card.member, house: card.house })); familyCapture(card.member, card.house, choice, true); return res; }
    const s = card.special; base.special = s;
    switch (s) {
      case 'lostcity': pushTile(board, k, base); break;
      case 'sinkhole': base.owner = null; pushTile(board, k, base); break;
      case 'sanctuary': base.owner = 'both'; pushTile(board, k, base); break;
      case 'rally': {
        const L = landOf(top(board, k));
        pushTile(board, k, Object.assign(base, { land: L }));
        landMatch(k, L);
        if (cfg.rallyReach === 'all') for (const d of ORTHO_D) {
          const n = k + d, L2 = landOf(top(board, n));
          if (L2 >= 0 && L2 !== L) { flip(n); landMatch(n, L2); }
        }
        break;
      }
      case 'usurp': {
        if (cfg.usurpMode === 'take') { flip(k); break; }
        res.removed = board.get(k)[0]; board.delete(k);
        pushTile(board, k, { id: choice.cardId, kind: 'land', land: choice.land, owner: p });
        if (cfg.usurpMatch !== false) landMatch(k, choice.land); break;
      }
      case 'underminers': pushTile(board, k, base); if (choice != null) flip(choice); break;
      case 'earthquake': pushTile(board, k, base); if (choice) { const a = board.get(choice[0]), b = board.get(choice[1]); board.set(choice[0], b); board.set(choice[1], a); } break;
      case 'waystone': pushTile(board, k, base); res.extra = true; break;
    }
    return res;
  }

  // ---------- turn flow ----------
  function playMove(state, move) {
    if (state.over) return null;
    const p = state.turn, o = 1 - p, pl = state.players[p];
    const card = findCard(state, p, move.cardId);
    if (!card) throw new Error('card not in hand');
    const before = score(state.board, state.cfg);
    const res = applyEffect(state.board, state.cfg, p, card, move.pos, move.choice);
    const after = score(state.board, state.cfg);
    // remove card(s) from hand
    const rm = id => { let i = pl.hand.findIndex(c => c.id === id); if (i >= 0) return pl.hand.splice(i, 1)[0]; i = pl.side.findIndex(c => c.id === id); return i >= 0 ? pl.side.splice(i, 1)[0] : null; };
    rm(card.id);
    if (card.special === 'usurp') { if (move.choice) rm(move.choice.cardId); state.discard.push(card); }
    if (res.removed) state.deck.unshift({ id: res.removed.id, kind: 'land', land: res.removed.land });
    const swing = (after.largest[p] - after.largest[o]) - (before.largest[p] - before.largest[o]);
    const play = { p, turn: state.turnNo, label: cardLabel(card), title: cardTitle(card), swing,
      mine: after.largest[p] - before.largest[p], theirs: after.largest[o] - before.largest[o], flips: res.flips.length };
    state.plays.push(play);
    if (state.leads) state.leads.push(after.largest[0] - after.largest[1]); // Midnight's kingdom lead after every play
    state.lastMove = { n: state.turnNo, p, pos: move.pos, flips: res.flips, from: res.from, removed: res.removed, card, choice: move.choice };
    state.log.push(play);
    while (pl.hand.length < state.cfg.handSize && state.deck.length) pl.hand.push(state.deck.pop());
    state.turnNo++;
    state.passes = 0;
    state.turn = res.extra ? p : o;
    checkEnd(state, false);
    return play;
  }

  function cardsLeft(state, p) { const pl = state.players[p]; return pl.hand.length + pl.side.length; }

  function checkEnd(state, initial) {
    const { cfg } = state;
    const end = r => { state.over = true; state.endReason = r; state.moves = []; finish(state); };
    if (!initial) {
      if (cfg.end.boardFull && state.board.size >= cfg.gridW * cfg.gridH) return end('Board full');
      if (cfg.end.deckEmpty && state.deck.length === 0) return end('Bag empty');
    }
    if (!state.deck.length && !cardsLeft(state, 0) && !cardsLeft(state, 1)) return end('Out of cards');
    for (let tries = 0; tries < 2; tries++) {
      state.moves = legalMoves(state, state.turn);
      if (state.moves.length) return;
      if (cfg.end.noValidPlay) return end('No valid play');
      state.log.push({ p: state.turn, pass: true, turn: state.turnNo });
      state.turn = 1 - state.turn;
    }
    end('Neither player can play');
  }

  function finish(state) {
    const s = score(state.board, state.cfg);
    state.final = s;
    const a = s.largest[0], b = s.largest[1] + (state.cfg.secondBonus | 0);
    s.adjusted = [a, b];
    let w = a > b ? 0 : b > a ? 1 : -1;
    if (w === -1 && state.cfg.tiebreak === 'total') w = s.total[0] > s.total[1] ? 0 : s.total[1] > s.total[0] ? 1 : -1;
    if (w === -1 && state.cfg.tiebreak === 'second') w = 1;
    state.winner = w;
  }

  // ---------- AI ----------
  const PERSONAS = {
    // hold: how much a persona values saving a capture card for a turn where it actually captures something
    greedy: { name: 'Greedy', blurb: 'Takes the biggest immediate swing every turn.', a: 0, hold: 0, look: 0, noise: 0.01 },
    builder: { name: 'Builder', blurb: 'Grows total territory and saves capture cards for big turns.', a: 0.35, hold: 0.8, look: 0, noise: 0.02 },
    cautious: { name: 'Cautious', blurb: 'Weighs the best reply the opponent could make, and doesn\u2019t waste capture cards.', a: 0.2, hold: 1.0, look: 1, noise: 0.01 },
    hoarder: { name: 'Hoarder', blurb: 'Holds Family and Specials until they can make a big play.', a: 0.2, hold: 1.8, look: 0, noise: 0.02 },
    chaotic: { name: 'Chaotic', blurb: 'Plays decent moves with a lot of randomness.', a: 0.1, hold: 0.3, look: 0, noise: 1.5 },
    random: { name: 'Random', blurb: 'Any legal move. Baseline for sanity checks.', random: true }
  };

  function evalBoard(board, p, a, cfg) {
    const s = score(board, cfg), o = 1 - p;
    return (s.largest[p] - s.largest[o]) + a * (s.total[p] - s.total[o]);
  }

  // Opponent reply estimate uses only public info: their Family sideboard plus one Land of each type not yet seen.
  function oppProxyCards(state, p) {
    const o = 1 - p, cards = [];
    const seenFam = new Set();
    for (const c of state.players[o].side) if (!seenFam.has(c.member)) { seenFam.add(c.member); cards.push(c); }
    const count = new Array(state.cfg.landSets).fill(state.cfg.landCopies);
    for (const st of state.board.values()) for (const t of st) if (t.kind === 'land') count[t.land]--;
    for (const c of state.players[p].hand) if (c.kind === 'land') count[c.land]--;
    count.forEach((n, L) => { if (n > 0) cards.push({ id: -1 - L, kind: 'land', land: L }); });
    return cards;
  }

  // Rough extra value of a card over a plain Land, from simulation averages.
  const HOLD = { advisor: 4, king: 2, queen: 2.5, heir: 2, knave: 2.5, usurp: 2, rally: 2, sinkhole: 1.5, underminers: 2, earthquake: 2, sanctuary: 1, waystone: 0.5, lostcity: 0.3 };
  function holdValue(card) { return card.kind === 'family' ? HOLD[card.member] || 2 : card.kind === 'special' ? HOLD[card.special] || 1 : 0; }

  function chooseMove(state, personaKey) {
    const per = PERSONAS[personaKey] || PERSONAS.greedy;
    const p = state.turn, rng = state.rng;
    const moves = legalMoves(state, p, { prune: true, dedupe: true });
    if (!moves.length) return null;
    if (per.random) return moves[Math.floor(rng() * moves.length)];
    const base = evalBoard(state.board, p, per.a, state.cfg);
    const progress = state.initialDeck ? state.deck.length / state.initialDeck : 0;
    const scored = moves.map(m => {
      const card = findCard(state, p, m.cardId);
      const b = new Map(state.board);
      const r = applyEffect(b, state.cfg, p, card, m.pos, m.choice);
      let v = evalBoard(b, p, per.a, state.cfg) - base;
      if (r.extra) v += 0.8;
      // Spending a capture card costs what it could have done later; late in the game that cost fades so cards get used.
      v -= (per.hold || 0) * holdValue(card) * Math.min(1, progress * 1.3);
      if (per.keep && card.kind === 'family') v -= per.keep * progress;
      if (card.special === 'usurp' && m.choice) v -= 0.3; // the swap costs two cards
      v += per.noise * (rng() - 0.5);
      return { m, v, b };
    });
    scored.sort((x, y) => y.v - x.v);
    if (per.look) {
      const proxy = oppProxyCards(state, p), o = 1 - p;
      const K = Math.min(5, scored.length);
      for (let i = 0; i < K; i++) {
        const sc = scored[i];
        const fake = { cfg: state.cfg, board: sc.b, players: state.players };
        const before = evalBoard(sc.b, o, 0, state.cfg);
        let best = 0;
        for (const c of proxy) {
          for (const om of cardMoves(fake, o, c, 'x', { prune: true })) {
            const b2 = new Map(sc.b);
            applyEffect(b2, state.cfg, o, c, om.pos, om.choice);
            const sw = evalBoard(b2, o, 0, state.cfg) - before;
            if (sw > best) best = sw;
          }
        }
        sc.v -= per.look * 0.6 * best;
      }
      scored.sort((x, y) => y.v - x.v);
    }
    return scored[0].m;
  }

  // ---------- simulation ----------
  function playOut(cfg, seed, personas, maxTurns) {
    const st = newGame(cfg, seed);
    let guard = 0;
    while (!st.over && guard++ < (maxTurns || 400)) {
      const m = chooseMove(st, personas[st.turn]);
      if (!m) break;
      playMove(st, m);
    }
    if (!st.over) { st.over = true; st.endReason = 'Turn limit'; finish(st); }
    return st;
  }

  // ---------- comebacks and runaway leads ----------
  const CHECKS = [0.25, 0.5, 0.75];
  function addLeadStats(S, st) {
    const L = S.lead || (S.lead = { checks: CHECKS.map(() => ({ led: 0, leaderWon: 0, even: 0, gap: 0 })), bySize: [[0, 0], [0, 0], [0, 0]], changes: 0, decided: [], fromHalf: 0, halfBehindGames: 0, from3: 0, decidedGames: 0, maxDeficit: {} });
    const h = st.leads || [], n = h.length, w = st.winner;
    if (!n) return;
    CHECKS.forEach((f, i) => {
      const d = h[Math.max(0, Math.ceil(f * n) - 1)], c = L.checks[i];
      if (d === 0) { c.even++; return; }
      c.led++; c.gap += Math.abs(d);
      if (w === (d > 0 ? 0 : 1)) c.leaderWon++;
    });
    // at halfway, does the size of the lead matter? buckets: ahead by 1-2, 3-4, 5+
    const dh = h[Math.max(0, Math.ceil(0.5 * n) - 1)];
    if (dh) { const b = Math.abs(dh) <= 2 ? 0 : Math.abs(dh) <= 4 ? 1 : 2; L.bySize[b][0]++; if (w === (dh > 0 ? 0 : 1)) L.bySize[b][1]++; }
    let last = 0; for (const d of h) { const s = Math.sign(d); if (s && last && s !== last) L.changes++; if (s) last = s; }
    if (w === -1) return;
    const sgn = w === 0 ? 1 : -1;
    L.decidedGames++;
    let k = n - 1; while (k >= 0 && sgn * h[k] > 0) k--;      // last moment the eventual winner wasn't ahead
    L.decided.push((k + 1) / n);
    const half = h[Math.max(0, Math.ceil(0.5 * n) - 1)] * sgn;
    if (half < 0) L.fromHalf++;
    const worst = Math.min(0, ...h.map(d => d * sgn));
    if (worst <= -3) L.from3++;
    L.maxDeficit[-worst] = (L.maxDeficit[-worst] || 0) + 1;
  }
  function summarizeLeads(S) {
    const L = S.lead; if (!L) return null;
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    return {
      checks: L.checks.map((c, i) => ({ at: CHECKS[i], leaderWins: c.led ? c.leaderWon / c.led : 0, even: c.even / S.games, avgLead: c.led ? c.gap / c.led : 0 })),
      leadChanges: L.changes / S.games,
      halfwayBySize: ['1\u20132', '3\u20134', '5+'].map((label, i) => ({ label, games: L.bySize[i][0] / S.games, leaderWins: L.bySize[i][0] ? L.bySize[i][1] / L.bySize[i][0] : 0 })),
      decidedAt: mean(L.decided),
      decidedLate: L.decided.filter(x => x >= 0.75).length / Math.max(1, L.decidedGames),
      comebackFromHalf: L.fromHalf / Math.max(1, L.decidedGames),
      comebackFrom3: L.from3 / Math.max(1, L.decidedGames),
      maxDeficit: L.maxDeficit
    };
  }

  function newStats() {
    return { games: 0, wins: {}, ties: 0, seatWins: [0, 0], endReasons: {}, turns: [], margins: [], scores: {}, cards: {}, unplayedFamily: 0, seconds: 0 };
  }
  function addCardStat(cs, label, play, won) {
    let c = cs[label];
    if (!c) c = cs[label] = { plays: 0, sum: 0, sq: 0, min: Infinity, max: -Infinity, flips: 0, mine: 0, theirs: 0, games: 0, gamesWon: 0, hist: {} };
    c.plays++; c.sum += play.swing; c.sq += play.swing * play.swing; c.flips += play.flips; c.mine += play.mine; c.theirs += play.theirs;
    if (play.swing < c.min) c.min = play.swing; if (play.swing > c.max) c.max = play.swing;
    c.hist[play.swing] = (c.hist[play.swing] || 0) + 1;
  }

  // personas: [keyA, keyB]. alternate = swap seats every other game.
  function runBatch(cfg, personas, n, seed, alternate, onProgress) {
    const S = newStats(); const t0 = Date.now();
    S.personas = personas.slice();
    if (personas[0] !== personas[1]) for (const k of personas) { S.wins[k] = 0; S.scores[k] = []; }
    if (personas[0] === personas[1]) { S.wins = { [personas[0] + ' (A)']: 0, [personas[1] + ' (B)']: 0 }; }
    const nameOf = idx => personas[0] === personas[1] ? personas[idx] + (idx ? ' (B)' : ' (A)') : personas[idx];
    for (let g = 0; g < n; g++) {
      const swap = alternate && g % 2 === 1;
      const seats = swap ? [personas[1], personas[0]] : [personas[0], personas[1]];
      const who = swap ? [1, 0] : [0, 1]; // seat -> persona index
      const st = playOut(cfg, (seed + g * 7919) >>> 0, seats);
      S.games++;
      S.endReasons[st.endReason] = (S.endReasons[st.endReason] || 0) + 1;
      S.turns.push(st.turnNo);
      S.margins.push(Math.abs(st.final.largest[0] - st.final.largest[1]));
      for (const seat of [0, 1]) { const nm = nameOf(who[seat]); (S.scores[nm] = S.scores[nm] || []).push(st.final.largest[seat]); }
      if (st.winner === -1) S.ties++; else { S.seatWins[st.winner]++; const nm = nameOf(who[st.winner]); S.wins[nm] = (S.wins[nm] || 0) + 1; }
      const playedBy = [new Set(), new Set()];
      for (const pl of st.plays) { addCardStat(S.cards, pl.label, pl); playedBy[pl.p].add(pl.label); }
      for (const seat of [0, 1]) for (const lab of playedBy[seat]) { const c = S.cards[lab]; c.games++; if (st.winner === seat) c.gamesWon++; }
      S.unplayedFamily += st.players[0].side.length + st.players[1].side.length;
      addLeadStats(S, st);
      if (onProgress && (g % 20 === 19 || g === n - 1)) onProgress(g + 1, n);
    }
    S.seconds = (Date.now() - t0) / 1000;
    return S;
  }

  function summarize(S) {
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    const cards = Object.entries(S.cards).map(([label, c]) => {
      const m = c.sum / c.plays; const sd = Math.sqrt(Math.max(0, c.sq / c.plays - m * m));
      return { label, plays: c.plays, perGame: c.plays / S.games, mean: m, sd, min: c.min, max: c.max, flips: c.flips / c.plays,
        mine: c.mine / c.plays, theirs: c.theirs / c.plays, winWhenPlayed: c.games ? c.gamesWon / c.games : 0, hist: c.hist };
    }).sort((a, b) => b.mean - a.mean);
    const scores = {}; for (const [k, v] of Object.entries(S.scores)) scores[k] = { mean: mean(v), min: Math.min(...v), max: Math.max(...v) };
    const marginHist = {}; S.margins.forEach(m => marginHist[m] = (marginHist[m] || 0) + 1);
    return {
      games: S.games, seconds: S.seconds, wins: S.wins, ties: S.ties,
      firstSeatWinRate: S.seatWins[0] / S.games, secondSeatWinRate: S.seatWins[1] / S.games, tieRate: S.ties / S.games,
      endReasons: S.endReasons, turns: { mean: mean(S.turns), min: Math.min(...S.turns), max: Math.max(...S.turns) },
      margin: { mean: mean(S.margins), hist: marginHist }, scores, cards,
      unplayedFamilyPerGame: S.unplayedFamily / S.games,
      comeback: summarizeLeads(S)
    };
  }

  function reportText(sum, cfg, personas) {
    const pct = x => (100 * x).toFixed(1) + '%';
    const f = x => (x >= 0 ? '+' : '') + x.toFixed(2);
    const L = [];
    L.push(`Vye Duel simulation — ${sum.games} games, ${personas.join(' vs ')}, ${sum.seconds.toFixed(1)}s`);
    L.push(`Config: ${cfg.landSets} land sets × ${cfg.landCopies}, grid ${cfg.gridW}×${cfg.gridH}, hand ${cfg.handSize}, stacking ${cfg.stacking}, start ${cfg.start}`);
    L.push(`Family Blue: ${famStr(cfg.family[0])} | Red: ${famStr(cfg.family[1])}`);
    L.push(`Specials: ${Object.entries(cfg.specials).filter(([, n]) => n > 0).map(([k, n]) => SPECIALS[k].name + '×' + n).join(', ') || 'none'}`);
    L.push(`End on: ${Object.entries(cfg.end).filter(([, v]) => v).map(([k]) => k).join(', ')}`);
    if (cfg.secondBonus || cfg.secondExtraCards || cfg.tiebreak !== 'none') L.push(`Balance: second player +${cfg.secondBonus | 0} points, +${cfg.secondExtraCards | 0} cards, ties → ${cfg.tiebreak}`);
    L.push('');
    L.push(`Wins: ${Object.entries(sum.wins).map(([k, v]) => `${k} ${pct(v / sum.games)}`).join(', ')}, ties ${pct(sum.tieRate)}`);
    L.push(`First player wins ${pct(sum.firstSeatWinRate)}, second ${pct(sum.secondSeatWinRate)}`);
    L.push(`Turns: mean ${sum.turns.mean.toFixed(1)} (min ${sum.turns.min}, max ${sum.turns.max}). Margin mean ${sum.margin.mean.toFixed(2)}`);
    L.push(`End reasons: ${Object.entries(sum.endReasons).map(([k, v]) => `${k} ${pct(v / sum.games)}`).join(', ')}`);
    if (sum.comeback) {
      const cb = sum.comeback;
      L.push(`Leader wins: ${cb.checks.map(c => `ahead at ${Math.round(c.at * 100)}% \u2192 wins ${pct(c.leaderWins)}`).join(', ')}`);
      L.push(`Comebacks: behind at halfway and won ${pct(cb.comebackFromHalf)}, won after being 3+ behind ${pct(cb.comebackFrom3)}. Lead changes per game ${cb.leadChanges.toFixed(1)}. Winner takes the lead for good at ${pct(cb.decidedAt)} of the game on average.`);
    }
    L.push(`Final kingdom: ${Object.entries(sum.scores).map(([k, v]) => `${k} ${v.mean.toFixed(1)} (${v.min}–${v.max})`).join(', ')}`);
    L.push('');
    L.push('Card            plays/g   mean    sd    min   max  flips  win%');
    for (const c of sum.cards) L.push(`${c.label.padEnd(16)}${c.perGame.toFixed(2).padStart(6)}  ${f(c.mean).padStart(6)} ${c.sd.toFixed(2).padStart(5)} ${String(c.min).padStart(5)} ${String(c.max).padStart(5)} ${c.flips.toFixed(2).padStart(6)} ${pct(c.winWhenPlayed).padStart(6)}`);
    L.push('');
    L.push('Swing = change in (your largest kingdom − opponent’s largest kingdom) caused by that one play.');
    return L.join('\n');
  }
  function famStr(f) { return MEMBER_ORDER.filter(m => f[m] > 0).map(m => (f[m] > 1 ? f[m] + '×' : '') + MEMBERS[m].name).join(', ') || 'none'; }

  const api = { key, kx, ky, LANDS, MEMBERS, MEMBER_ORDER, HOUSES, SPECIALS, SPECIAL_ORDER, PERSONAS, defaultConfig,
    newGame, legalMoves, cardMoves, playMove, chooseMove, score, top, landOf, canFlip, bbox, placeCells, cardLabel, cardTitle,
    findCard, playOut, runBatch, summarize, reportText, mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VyeEngine = api;
})(typeof self !== 'undefined' ? self : this);
