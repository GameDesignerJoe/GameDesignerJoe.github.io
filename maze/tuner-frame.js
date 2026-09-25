// The Maze — the tuner's hands inside the game
//
// tuner.html runs the real game in a hidden iframe and copies its Full map view,
// so the pictures are the game drawing itself rather than a second icon language
// invented for the tuner. This file is the part that runs INSIDE that frame.
//
// It has to exist, and it cannot be replaced by reaching in from the parent. The
// engine's top-level `let` and `const` — SAVE, PHASES, MUST, CONTRACT, started,
// parked, tiles, W, H — are script-scope bindings, not properties of `window`.
// From outside, `frame.contentWindow.SAVE` is undefined, and assigning to it
// creates a lookalike that the game never reads. That bit us: `parked = true` set
// from the parent looked like it had disabled saving and had disabled nothing.
// A script loaded INTO the frame shares the realm and sees the real bindings, so
// everything the tuner needs goes through here.
//
// Nothing in this file generates anything. It sets the game up, asks it to draw
// one frame, and reports what the maze holds.

window.TUNER = (() => {
  const K = (x, y) => x + ',' + y;

  // ── stop it saving, and hold it still ──────────────────────────────────────
  // The game autosaves every six seconds, and on visibilitychange and pagehide
  // (input.js). Without this, opening the tuner would write over the run Joe is
  // actually playing. `parked` is the game's own switch for exactly this — it is
  // what a refresh uses — and persist/saveRun are stubbed behind it in case the
  // switch ever moves. update() is stubbed too so nothing drifts between the maze
  // we set up and the frame we copy.
  let drawOnce = null;
  function park() {
    parked = true;
    persist = () => {};
    saveRun = () => {};
    update = () => {};
    // Take the real draw away from the frame loop and keep it for ourselves. The
    // loop cannot be cancelled from here — boot.js re-arms it every frame — but a
    // no-op draw costs nothing, where leaving it in place re-rendered a whole Full
    // map sixty times a second for as long as the tuner was open, to no end.
    if (!drawOnce) { drawOnce = draw; draw = () => {}; }
    if (typeof AUDIO === 'object' && AUDIO) {
      for (const k in AUDIO) if (typeof AUDIO[k] === 'function') AUDIO[k] = () => {};
    }
    return { parked, saving: 'off' };
  }

  // ── what the tuner needs to read out of the engine ─────────────────────────
  const phases = () => PHASES.map((p) => ({ who: p.who, size: p.size }));
  // prototypes the tuner can show a block of, alongside the chapters
  const protos = () => [{ who: 'Districts (prototype)', proto: 'districts' }];
  const mustFor = (who) => Object.assign({}, MUST[who] || {});
  const clauses = () => Object.keys(CONTRACT.CLAUSES).map((k) => ({ key: k, label: CONTRACT.CLAUSES[k].label }));
  const canvas = () => cv;

  // ── build one maze and draw it, full map, once ─────────────────────────────
  // `proto` selects a prototype instead of a chapter's ordinary maze — the
  // district prototype is the reason this argument exists.
  function build(ph, size, seed, must, proto) {
    SAVE.phase = ph; SAVE.stones = ph; SAVE.poolPending = false;
    SAVE.collected = {}; SAVE.pushLearned = true;
    SAVE.ui = proto ? { proto } : { size };
    delete SAVE.run;
    reset(seed);

    // the run has to be "going" for Full map to draw, but nobody is playing it
    document.body.classList.remove('pre');
    document.getElementById('title').classList.add('hide');
    started = true;
    setDebugMap(true);
    // Centre it ourselves instead of taking dbgFrame's default: that one lifts the
    // map 80px to clear the HUD, which would crop the bottom row out of the copy.
    const fit = Math.min(innerWidth / W, innerHeight / H);
    dbgView = { cx: W / 2, cy: H / 2, S: fit };
    drawOnce();                   // synchronous; no frame to wait for, nothing to race

    const f = dbgFrame();
    const m = CONTRACT.measure();
    return {
      seed, W, H, m,
      src: { x: f.ox * dpr, y: f.oy * dpr, w: W * f.S * dpr, h: H * f.S * dpr },
      what: whatIsWhere(),
      // one row per tile line, so hover can answer "floor" or "wall" rather than
      // going silent over a plain corridor and reading as broken
      grid: tiles.map((row) => Array.from(row, (v) => (v ? '1' : '0')).join('')),
      counts: countOf(),
      vaults: keyVaults.map((v) => ({ x0: v.x0, y0: v.y0, x1: v.x1, y1: v.y1 })),
      districts: clusters.map((c) => [c.tx0, c.ty0, c.tx1, c.ty1]),
      splits: [...(m.thresholdTiles || [])],
      grade: CONTRACT.grade(m, must),
    };
  }

  // ── what is on a tile, in the game's own words ─────────────────────────────
  // The picture is the game's own rendering, so nothing in it carries a label.
  // This is the whole reason hover exists. Most specific first; the room and the
  // district a tile belongs to come last, as context rather than as the answer.
  function whatIsWhere() {
    const at = {};
    const add = (k, text) => { if (k != null) (at[k] = at[k] || []).push(text); };
    const addXY = (x, y, text) => add(K(x, y), text);
    const each = (coll, fn) => { if (coll) for (const it of coll) fn(it); };

    addXY(Math.floor(start.x), Math.floor(start.y), 'where you wake');
    addXY(Math.floor(exit.x), Math.floor(exit.y), gated ? 'the way out — locked' : 'the way out');
    each(exitAlley, ([x, y]) => addXY(x, y, 'the alley to the way out'));
    each(exitTree, (k) => add(k, 'the squeeze gauntlet guarding the way out'));

    const vaultAt = new Set(keyVaults.map((v) => K(v.cx, v.cy)));
    for (const [k, shape] of innerKeys) add(k, `a ${shape} key — ` + (vaultAt.has(k) ? 'buried in a vault' : 'lying loose in a hall'));
    each(doors, (d) => addXY(d.x, d.y, `a locked door — takes the ${d.shape} key`));
    if (keySpot) add(keySpot, 'the key to the way out');
    each(keyVaults, (v) => addXY(v.cx, v.cy, 'the heart of a vault'));

    for (const k of journals.keys()) add(k, 'a journal');
    for (const [k, kind] of pickups) add(k, `a ${kind} pickup`);
    each(chalkSpots, (k) => add(k, 'chalk'));
    each(charcoalSpots, (k) => add(k, 'charcoal'));
    each(scrapSpots, (k) => add(k, 'a map fragment'));

    each(shrines, (sh) => {
      addXY(sh.x, sh.y, `a statue — ${sh.who}`);
      addXY(sh.sx, sh.sy, `the bowl at ${sh.who}'s statue`);
    });
    for (const [k, who] of offerings) add(k, `a carved stone to carry — ${who}`);

    each(crawlGaps, (k) => add(k, 'a crawl gap — only the Child fits through'));
    each(crawlCells, (k) => add(k, 'a squeeze'));
    each(sliders, (sl) => {
      addXY(sl.x, sl.y, sl.gauntlet ? 'a gauntlet swing — the floor slides away'
        : sl.atStart ? 'the push block out of the start room' : 'a push block');
      addXY(sl.x + sl.dx, sl.y + sl.dy, 'where that block slides to');
    });
    each(pockets, ([x, y]) => addXY(x, y, 'a pocket, reachable only by shoving a block'));
    if (typeof tunnelTiles !== 'undefined') each(tunnelTiles, (k) => add(k, 'a tunnel'));
    each(darkTiles, (k) => add(k, 'darkness — you need the lamp'));
    if (lampSpot) add(lampSpot, 'the lamp');

    each(hopscotch, (k) => add(k, 'a hopscotch square'));
    if (ticTacToe) addXY(ticTacToe.x, ticTacToe.y, 'a tic-tac-toe board chalked on the floor');
    each(figures, (f) => addXY(Math.floor(f.x), Math.floor(f.y), 'the father, walking away'));
    if (typeof secretTiles !== 'undefined') each(secretTiles, (k) => add(k, 'the secret room'));
    if (secretSwitch) add(secretSwitch, 'the switch that lights the secret room');
    if (secretFather) add(secretFather, 'somebody drew a man walking away');
    if (startArrow) addXY(startArrow.x, startArrow.y, 'the arrow on the start-room floor');

    each(landmarks, (l) => {
      if (l.rx0 == null) { addXY(l.x, l.y, `the ${l.kind} room`); return; }
      for (let y = l.ry0; y <= l.ry1; y++) for (let x = l.rx0; x <= l.rx1; x++) addXY(x, y, `the ${l.kind} room`);
    });
    each(clusters, (c) => {
      for (let y = c.ty0; y <= c.ty1; y++) for (let x = c.tx0; x <= c.tx1; x++) addXY(x, y, `a district — ${c.heart}`);
    });

    for (const k in at) at[k] = [...new Set(at[k])];   // a room repeats its name on every tile
    return at;
  }

  function countOf() {
    const n = (v) => v == null ? 0 : (v.size ?? v.length ?? (v ? 1 : 0));
    const kinds = {};
    for (const l of landmarks) kinds[l.kind] = (kinds[l.kind] || 0) + 1;
    return {
      kinds: Object.entries(kinds).map(([k, v]) => v > 1 ? `${v}× ${k}` : k).join(', '),
      journals: n(journals), pickups: n(pickups),
      chalk: n(chalkSpots), charcoal: n(charcoalSpots), scraps: n(scrapSpots),
      shrines: n(shrines), offerings: n(offerings),
      sliders: n(sliders), pockets: n(pockets), crawl: n(crawlGaps),
      tunnels: typeof tunnelTiles !== 'undefined' ? n(tunnelTiles) : 0,
      dark: n(darkTiles), lamp: !!lampSpot,
      hopscotch: n(hopscotch), tic: !!ticTacToe, figures: n(figures),
      secret: typeof secretTiles !== 'undefined' ? n(secretTiles) : 0,
      secretSwitch: !!secretSwitch,
    };
  }

  return { park, phases, protos, mustFor, clauses, canvas, build };
})();
