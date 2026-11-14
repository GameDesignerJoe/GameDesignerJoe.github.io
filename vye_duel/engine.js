/* Vye Micro — rules engine, AI personas and batch simulator.
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
    { name: 'Forest', glyph: '♣', color: '#3E7B4F' },
    { name: 'Peaks', glyph: '▲', color: '#6E7380' },
    { name: 'Lake', glyph: '≈', color: '#3B78A6' },
    { name: 'Desert', glyph: '☼', color: '#C2913A' },
    { name: 'Marsh', glyph: '✱', color: '#5E7F6A' },
    { name: 'Crystal', glyph: '◆', color: '#7A5AA6' },
    { name: 'Hills', glyph: '●', color: '#8C7A3E' },
    { name: 'Fields', glyph: '■', color: '#A8A23A' },
    { name: 'Crossing', glyph: '✚', color: '#9A5B3C' },
    { name: 'Tundra', glyph: '❄', color: '#6F9DB5' },
    { name: 'Thicket', glyph: '♠', color: '#2F5E44' },
    { name: 'Village', glyph: '⌂', color: '#A0673F' },
    { name: 'Starfall', glyph: '✦', color: '#4A4F8C' },
    { name: 'Moonvale', glyph: '◐', color: '#5C6E8E' },
    { name: 'Ruby Coast', glyph: '♦', color: '#A3445A' },
    { name: 'Orchard', glyph: '✿', color: '#7D8F3A' }
  ];

  const MEMBERS = {
    advisor: { name: 'Advisor', dirs: ALL8_D, rule: 'Flips all 8 surrounding tiles.' },
    king: { name: 'King', dirs: ORTHO_D, rule: 'Flips the 4 adjacent tiles.' },
    queen: { name: 'Queen', dirs: DIAG_D, rule: 'Flips the 4 diagonal tiles.' },
    heir: { name: 'Heir', dirs: null, rule: 'Flips 1 surrounding tile of your choice.' }
  };
  const MEMBER_ORDER = ['advisor', 'king', 'queen', 'heir'];

  const HOUSES = [
    { name: 'House Midnight', short: 'Midnight', sigil: '☾', color: 'blue' },
    { name: 'House of a Thousand Roses', short: 'Roses', sigil: '✿', color: 'red' }
  ];

  // mode: place = goes in an empty space, cover = stacks on a tile, replace = swaps a tile out
  const SPECIALS = {
    ancient: { name: 'Ancient Passage', mode: 'cover', origin: 'Original',
      rule: 'Cover a tile you don’t own that joins two of your kingdoms. It becomes yours.' },
    lostcity: { name: 'Lost City', mode: 'cover', origin: 'Original',
      rule: 'Cover a Land you own. Worth 2 points in your kingdom.' },
    sinkhole: { name: 'Sinkhole', mode: 'cover', origin: 'Original',
      rule: 'Cover any tile. Nobody owns it, ever. Breaks connections.' },
    sanctuary: { name: 'Sanctuary', mode: 'cover', origin: 'Original',
      rule: 'Cover any tile. Owned by both players. Can’t be flipped, covered or moved.' },
    wild: { name: 'Wild Land', mode: 'cover', origin: 'Adapted',
      rule: 'Cover a Land and become an adjacent Land type, then match from there.' },
    underminers: { name: 'Underminers', mode: 'place', origin: 'Adapted',
      rule: 'Place it, then flip the tile on the far side of an adjacent tile.' },
    earthquake: { name: 'Earthquake', mode: 'place', origin: 'Original',
      rule: 'Place it, then swap any two tiles (not Sanctuary). Nothing triggers.' },
    waystone: { name: 'Waystone', mode: 'place', origin: 'Original',
      rule: 'Place it and take another turn. Flipping it also grants an extra turn.' },
    watchtower: { name: 'Watchtower', mode: 'cover', origin: 'New',
      rule: 'Cover a tile you own. That space can’t be flipped.' },
    pretender: { name: 'Pretender', mode: 'cover', origin: 'New',
      rule: 'Cover an opponent’s Family tile. Take it and fire its capture as yours.' },
    usurp: { name: 'Usurp', mode: 'replace', origin: 'New',
      rule: 'Swap a Land on the board for a Land from your hand, then match. Old Land goes under the deck.' }
  };
  const SPECIAL_ORDER = ['ancient', 'lostcity', 'sinkhole', 'sanctuary', 'wild', 'watchtower', 'pretender', 'usurp', 'underminers', 'earthquake', 'waystone'];

  function defaultConfig() {
    return {
      landSets: 7,
      landCopies: 3,
      specials: { ancient: 1, lostcity: 1, sinkhole: 1, sanctuary: 0, wild: 1, watchtower: 1, pretender: 0, usurp: 1, underminers: 0, earthquake: 0, waystone: 0 },
      family: [{ advisor: 0, king: 1, queen: 1, heir: 1 }, { advisor: 0, king: 1, queen: 1, heir: 1 }],
      gridW: 5, gridH: 5,
      handSize: 3,
      start: 'neutral',      // neutral | none
      stacking: 'once',      // once | unlimited
      wildMode: 'cover',     // cover | place | either
      colorCapture: true,
      end: { boardFull: true, deckEmpty: false, noValidPlay: true },
      tiebreak: 'none'       // none | total
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
    const board = new Map();
    if (cfg.start === 'neutral') board.set(key(0, 0), [{ id: id++, kind: 'start', owner: null }]);
    const state = {
      cfg, rng, seed, board, deck, players, discard: [],
      turn: 0, turnNo: 0, passes: 0, over: false, endReason: null, winner: null,
      plays: [], log: [], lastMove: null, initialDeck: deck.length
    };
    state.moves = legalMoves(state, 0);
    if (!state.moves.length) checkEnd(state, true);
    return state;
  }

  // ---------- board helpers ----------
  const top = (board, k) => { const s = board.get(k); return s ? s[s.length - 1] : null; };
  const landOf = t => !t ? -1 : t.kind === 'land' ? t.land : (t.special === 'wild' ? t.wildAs : -1);
  const ownedBy = (t, p) => t && (t.owner === p || t.owner === 'both');
  function canFlip(t) {
    if (!t || (t.owner !== 0 && t.owner !== 1)) return false;
    if (t.kind === 'start') return false;
    return t.special !== 'watchtower' && t.special !== 'sanctuary' && t.special !== 'sinkhole';
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
    if (s[s.length - 1].special === 'sanctuary') return false;
    if (state.cfg.stacking === 'once' && s.length > 1) return false;
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
  function score(board) {
    const largest = [0, 0], total = [0, 0];
    for (const p of [0, 1]) {
      const seen = new Set();
      for (const k of board.keys()) {
        const t = top(board, k);
        if (!ownedBy(t, p)) continue;
        total[p] += t.special === 'lostcity' ? 2 : 1;
        if (seen.has(k)) continue;
        let v = 0; const q = [k]; seen.add(k);
        while (q.length) {
          const c = q.pop(); const tc = top(board, c); v += tc.special === 'lostcity' ? 2 : 1;
          for (const d of ORTHO_D) { const m = c + d; if (!seen.has(m) && board.has(m) && ownedBy(top(board, m), p)) { seen.add(m); q.push(m); } }
        }
        if (v > largest[p]) largest[p] = v;
      }
    }
    return { largest, total };
  }

  // ---------- move generation ----------
  function flipTargets(board, k, p, dirs) {
    const out = [];
    for (const d of dirs) { const t = top(board, k + d); if (canFlip(t) && t.owner !== p) out.push(k + d); }
    return out;
  }
  function wildChoices(state, k) {
    const { board, cfg } = state;
    const types = new Set();
    for (const d of ORTHO_D) { const L = landOf(top(board, k + d)); if (L >= 0) types.add(L); }
    const ok = [];
    for (const L of types) {
      // union of type-L chains touching k (k itself excluded)
      const seen = new Set([k]); const q = []; let size = 0, hasWild = false;
      for (const d of ORTHO_D) { const n = k + d; if (landOf(top(board, n)) === L && !seen.has(n)) { seen.add(n); q.push(n); } }
      while (q.length) {
        const c = q.pop(); size++; if (top(board, c).special === 'wild') hasWild = true;
        for (const d of ORTHO_D) { const n = c + d; if (!seen.has(n) && landOf(top(board, n)) === L) { seen.add(n); q.push(n); } }
      }
      if (!hasWild && size < cfg.landCopies) ok.push(L);
    }
    return ok;
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
        if (card.member === 'heir') { const t = flipTargets(board, k, p, ALL8_D); if (t.length) t.forEach(c => add(k, c)); else add(k); }
        else add(k);
      }
      return moves;
    }
    const s = card.special;
    switch (s) {
      case 'ancient':
        for (const k of occupied) {
          if (!coverable(state, k)) continue;
          const t = top(board, k); if (t.owner === p || t.owner === 'both') continue;
          const comp = components(board, p, k); const ids = new Set();
          for (const d of ORTHO_D) if (comp.has(k + d)) ids.add(comp.get(k + d));
          if (ids.size >= 2) add(k);
        }
        break;
      case 'lostcity':
        for (const k of occupied) { const t = top(board, k); if (coverable(state, k) && landOf(t) >= 0 && t.owner === p) add(k); }
        break;
      case 'sinkhole':
        for (const k of occupied) if (coverable(state, k) && top(board, k).special !== 'sinkhole') add(k);
        break;
      case 'sanctuary':
        for (const k of occupied) if (coverable(state, k)) add(k);
        break;
      case 'watchtower':
        for (const k of occupied) { const t = top(board, k); if (coverable(state, k) && t.owner === p && t.special !== 'watchtower') add(k); }
        break;
      case 'pretender':
        for (const k of occupied) {
          const t = top(board, k);
          if (!coverable(state, k) || t.kind !== 'family' || t.owner === p) continue;
          if (t.member === 'heir') {
            // capture happens after covering; the covered tile itself is no longer a target
            const tg = flipTargets(board, k, p, ALL8_D); if (tg.length) tg.forEach(c => add(k, c)); else add(k);
          } else add(k);
        }
        break;
      case 'wild': {
        const mode = state.cfg.wildMode;
        if (mode === 'cover' || mode === 'either')
          for (const k of occupied) if (coverable(state, k) && landOf(top(board, k)) >= 0) wildChoices(state, k).forEach(L => add(k, L));
        if (mode === 'place' || mode === 'either')
          for (const k of placeCells(state)) wildChoices(state, k).forEach(L => add(k, L));
        break;
      }
      case 'usurp': {
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
          const tg = [];
          for (const d of ORTHO_D) { if (!board.has(k + d)) continue; const t = top(board, k + 2 * d); if (canFlip(t) && t.owner !== p) tg.push(k + 2 * d); }
          if (tg.length) tg.forEach(c => add(k, c)); else add(k);
        }
        break;
      case 'earthquake': {
        let cells = placeCells(state);
        if (opts && opts.prune && cells.length > 3) cells = shuffle(cells.slice(), state.rng || Math.random).slice(0, 3);
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
    const res = { flips: [], extra: false, removed: null, placed: k };
    const flip = n => { const t = top(board, n); if (canFlip(t) && t.owner !== p) { setTop(board, n, Object.assign({}, t, { owner: p })); res.flips.push(n); if (t.special === 'waystone') res.extra = true; } };
    const landMatch = (start, L) => {
      const seen = new Set([start]); const q = [start];
      while (q.length) { const c = q.pop(); for (const d of ORTHO_D) { const n = c + d; if (!seen.has(n) && landOf(top(board, n)) === L) { seen.add(n); flip(n); q.push(n); } } }
    };
    const familyCapture = (member, house, heirChoice, color) => {
      if (member === 'heir') { if (heirChoice != null) flip(heirChoice); }
      else for (const d of MEMBERS[member].dirs) flip(k + d);
      if (color && cfg.colorCapture) for (const d of ORTHO_D) { const t = top(board, k + d); if (t && t.kind === 'family' && t.house === house) flip(k + d); }
    };
    const base = { id: card.id, kind: card.kind, owner: p };
    if (card.kind === 'land') { pushTile(board, k, Object.assign(base, { land: card.land })); landMatch(k, card.land); return res; }
    if (card.kind === 'family') { pushTile(board, k, Object.assign(base, { member: card.member, house: card.house })); familyCapture(card.member, card.house, choice, true); return res; }
    const s = card.special; base.special = s;
    switch (s) {
      case 'ancient': case 'lostcity': case 'watchtower': pushTile(board, k, base); break;
      case 'sinkhole': base.owner = null; pushTile(board, k, base); break;
      case 'sanctuary': base.owner = 'both'; pushTile(board, k, base); break;
      case 'pretender': { const cov = top(board, k); base.member = cov.member; base.house = cov.house; pushTile(board, k, base); familyCapture(cov.member, cov.house, choice, false); break; }
      case 'wild': base.wildAs = choice; pushTile(board, k, base); landMatch(k, choice); break;
      case 'usurp': {
        res.removed = board.get(k)[0]; board.delete(k);
        pushTile(board, k, { id: choice.cardId, kind: 'land', land: choice.land, owner: p });
        landMatch(k, choice.land); break;
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
    const before = score(state.board);
    const res = applyEffect(state.board, state.cfg, p, card, move.pos, move.choice);
    const after = score(state.board);
    // remove card(s) from hand
    const rm = id => { let i = pl.hand.findIndex(c => c.id === id); if (i >= 0) return pl.hand.splice(i, 1)[0]; i = pl.side.findIndex(c => c.id === id); return i >= 0 ? pl.side.splice(i, 1)[0] : null; };
    rm(card.id);
    if (card.special === 'usurp') { rm(move.choice.cardId); state.discard.push(card); }
    if (res.removed) state.deck.unshift({ id: res.removed.id, kind: 'land', land: res.removed.land });
    const swing = (after.largest[p] - after.largest[o]) - (before.largest[p] - before.largest[o]);
    const play = { p, turn: state.turnNo, label: cardLabel(card), title: cardTitle(card), swing,
      mine: after.largest[p] - before.largest[p], theirs: after.largest[o] - before.largest[o], flips: res.flips.length };
    state.plays.push(play);
    state.lastMove = { p, pos: move.pos, flips: res.flips, card, choice: move.choice };
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
      if (cfg.end.deckEmpty && state.deck.length === 0) return end('Deck empty');
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
    const s = score(state.board);
    state.final = s;
    let w = s.largest[0] > s.largest[1] ? 0 : s.largest[1] > s.largest[0] ? 1 : -1;
    if (w === -1 && state.cfg.tiebreak === 'total') w = s.total[0] > s.total[1] ? 0 : s.total[1] > s.total[0] ? 1 : -1;
    state.winner = w;
  }

  // ---------- AI ----------
  const PERSONAS = {
    greedy: { name: 'Greedy', blurb: 'Takes the biggest immediate swing every turn.', a: 0, keep: 0, look: 0, noise: 0.01 },
    builder: { name: 'Builder', blurb: 'Grows total territory and saves Family for late.', a: 0.35, keep: 0.8, look: 0, noise: 0.02 },
    cautious: { name: 'Cautious', blurb: 'Weighs the best reply the opponent could make.', a: 0.2, keep: 0.4, look: 1, noise: 0.01 },
    hoarder: { name: 'Hoarder', blurb: 'Holds Family cards as long as possible.', a: 0.2, keep: 2.0, look: 0, noise: 0.02 },
    chaotic: { name: 'Chaotic', blurb: 'Plays decent moves with a lot of randomness.', a: 0.1, keep: 0, look: 0, noise: 1.5 },
    random: { name: 'Random', blurb: 'Any legal move. Baseline for sanity checks.', random: true }
  };

  function evalBoard(board, p, a) {
    const s = score(board), o = 1 - p;
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

  function chooseMove(state, personaKey) {
    const per = PERSONAS[personaKey] || PERSONAS.greedy;
    const p = state.turn, rng = state.rng;
    const moves = legalMoves(state, p, { prune: true, dedupe: true });
    if (!moves.length) return null;
    if (per.random) return moves[Math.floor(rng() * moves.length)];
    const base = evalBoard(state.board, p, per.a);
    const progress = state.initialDeck ? state.deck.length / state.initialDeck : 0;
    const scored = moves.map(m => {
      const card = findCard(state, p, m.cardId);
      const b = new Map(state.board);
      const r = applyEffect(b, state.cfg, p, card, m.pos, m.choice);
      let v = evalBoard(b, p, per.a) - base;
      if (r.extra) v += 0.8;
      if (card.kind === 'family') v -= per.keep * progress;
      if (card.special === 'usurp') v -= 0.3; // costs two cards
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
        const before = evalBoard(sc.b, o, 0);
        let best = 0;
        for (const c of proxy) {
          for (const om of cardMoves(fake, o, c, 'x', { prune: true })) {
            const b2 = new Map(sc.b);
            applyEffect(b2, state.cfg, o, c, om.pos, om.choice);
            const sw = evalBoard(b2, o, 0) - before;
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
      unplayedFamilyPerGame: S.unplayedFamily / S.games
    };
  }

  function reportText(sum, cfg, personas) {
    const pct = x => (100 * x).toFixed(1) + '%';
    const f = x => (x >= 0 ? '+' : '') + x.toFixed(2);
    const L = [];
    L.push(`Vye Micro simulation — ${sum.games} games, ${personas.join(' vs ')}, ${sum.seconds.toFixed(1)}s`);
    L.push(`Config: ${cfg.landSets} land sets × ${cfg.landCopies}, grid ${cfg.gridW}×${cfg.gridH}, hand ${cfg.handSize}, stacking ${cfg.stacking}, start ${cfg.start}`);
    L.push(`Family Blue: ${famStr(cfg.family[0])} | Red: ${famStr(cfg.family[1])}`);
    L.push(`Specials: ${Object.entries(cfg.specials).filter(([, n]) => n > 0).map(([k, n]) => SPECIALS[k].name + '×' + n).join(', ') || 'none'}`);
    L.push(`End on: ${Object.entries(cfg.end).filter(([, v]) => v).map(([k]) => k).join(', ')}`);
    L.push('');
    L.push(`Wins: ${Object.entries(sum.wins).map(([k, v]) => `${k} ${pct(v / sum.games)}`).join(', ')}, ties ${pct(sum.tieRate)}`);
    L.push(`First player wins ${pct(sum.firstSeatWinRate)}, second ${pct(sum.secondSeatWinRate)}`);
    L.push(`Turns: mean ${sum.turns.mean.toFixed(1)} (min ${sum.turns.min}, max ${sum.turns.max}). Margin mean ${sum.margin.mean.toFixed(2)}`);
    L.push(`End reasons: ${Object.entries(sum.endReasons).map(([k, v]) => `${k} ${pct(v / sum.games)}`).join(', ')}`);
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
