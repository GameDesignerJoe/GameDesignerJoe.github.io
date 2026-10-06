// UNSEEN — climb the building one floor at a time without being seen.
// The loop, the guards, the drawing and the screens. Floors come from level.js, sound from audio.js.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const cv = $('cv'), g = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  const COL = {
    floor: '#4596ae', shadow: '#2b6d83', deep: '#225d71',
    wall: '#c9dfe5',
    player: '#ff8a3d', playerHi: '#ffc896', playerLo: '#b84f17',
    guard: '#15364a', guardHi: '#2b566c', guardRim: '#cfe6ee',
    star: '#f3e57e',
    // calm cones: one soft pale-cyan light (about #6CC0D6 at a third over the floor) that fades towards the tip;
    // they're gathered on a layer that keeps the brightest of them, so two crossing fans never add up
    coneNear: 'rgb(34,66,76)', coneFar: 'rgb(12,26,30)',
    coneHot: 'rgba(255,76,52,0.62)', coneEdgeHot: 'rgba(255,120,90,0.9)',
    // the soft shadow under a character or pickup, and the floor's slab shadow on the void
    blob: 'rgba(22,74,92,0.55)', voidShade: 'rgba(38,92,110,0.24)',
  };
  // the light comes from the top left, so everything throws its shadow down and to the right:
  // a long band at 45 degrees, about 2.5 times a wall's thickness (13), so half a room sits in shade.
  // Shadows are swept into one shape per tone, so neighbours merge: a soft fringe, the shadow,
  // and a deeper core hugging the thing that casts it -- void, lit floor, shadow, deep shadow
  const LIGHT = { x: 34, y: 34 }, RIM = 30;   // RIM: how deep the void's shade reaches onto the floor
  const PEN = 1.2, CORE = 0.42;               // the fringe's and the core's reach, as a share of LIGHT
  // characters are drawn a little larger than their footprint (G_LOOK, P_LOOK); each sits on a soft
  // capsule shadow about twice its size, thrown the walls' way
  const G_LOOK = 1.15;
  // the player's square is exactly its footprint across (2 * P_R), so a flat face sits flush on a wall it slides along;
  // P_R matches the guards' G_R, the clearance every floor is built and checked for
  const P_SIZE = 14, P_R = 8.5, P_LOOK = 2 * P_R / P_SIZE, G_SIZE = 16, G_R = 8.5, CATCH = 16;
  // the building, bottom to top: past the roof garden it's the next tower over (II, III, ...), never the lobby again
  const NAMES = ['Lobby', 'Mailroom', 'Archives', 'Canteen', 'Records', 'Atrium', 'Server Hall', 'Laboratory', 'Gallery', 'Vault Annex', 'Boardroom', 'Observatory',
    'Press Room', 'Trading Floor', 'Library', 'Clinic', 'Data Vault', 'Studio', 'Clean Room', 'Sky Lounge', 'Strongroom', 'Situation Room', 'Executive Wing',
    'Private Office', 'Penthouse', 'Sky Bridge', 'Helipad', 'Roof Garden'];
  const ROMAN = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const floorName = (n) => { const t = Math.floor((n - 1) / NAMES.length); return NAMES[(n - 1) % NAMES.length] + (t > 0 ? ' ' + (ROMAN[t - 1] || t + 1) : ''); };
  // stars buy colours: every STARS_PER_SKIN stars in the building unlocks the next one for the player's square
  const STARS_PER_SKIN = 9;
  const SKINS = [
    { name: 'Orange', c: '#ff8a3d', hi: '#ffc896', lo: '#b84f17' },
    { name: 'Lime', c: '#a6e34a', hi: '#dcf7b0', lo: '#5d8c1c' },
    { name: 'Pink', c: '#ff6fae', hi: '#ffc4de', lo: '#b23a73' },
    { name: 'Gold', c: '#ffd23d', hi: '#fff1ad', lo: '#ad850c' },
    { name: 'Violet', c: '#b07cff', hi: '#ddc8ff', lo: '#6a40c0' },
    { name: 'White', c: '#f2f6f7', hi: '#ffffff', lo: '#93a9b1' },
  ];

  // ── save ───────────────────────────────────────────────────
  const SAVE_KEY = 'unseen.v1';
  let save;
  try { save = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { save = null; }
  if (!save || typeof save !== 'object') save = {};
  save = Object.assign({ floor: 1, best: 1, runSeed: (Math.random() * 1e9) >>> 0, stars: {}, hints: {}, music: true, sound: true, stickSide: 'right', skin: 0 }, save);
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
  const starTotal = () => Object.values(save.stars).reduce((a, b) => a + b, 0);
  const skinsOpen = (total) => Math.min(SKINS.length, 1 + Math.floor(total / STARS_PER_SKIN));
  function applySkin() {
    if (!(save.skin < skinsOpen(starTotal()))) save.skin = 0;
    const sk = SKINS[save.skin]; COL.player = sk.c; COL.playerHi = sk.hi; COL.playerLo = sk.lo;
  }
  const starStr = (k) => '\u2605'.repeat(k) + '\u2606'.repeat(3 - k);

  // ── state ──────────────────────────────────────────────────
  let L = null, field = null, nav = null, D = null, floorN = 1;
  let P = null, guards = [], cams = [], fx = [], time = 0;
  let mode = 'boot', modeT = 0, paused = false, overview = false;
  const view = { x: 0, y: 0, z: 1, shake: 0, lead: { x: 0, y: 0 }, locked: false, ease: null };
  let floorBox = null, popT = null, spottedCD = 0, hmmCD = 0, lockedCD = 0, gotStars = 0, knockCD = 0;   // knockCD: seconds until the knock is ready again
  let stats = { caught: 0, time: 0 };
  let replay = false, clearInfo = null;   // replay: a floor played again from the list, for its stars; it doesn't move the climb
  let checkpoint = null, graceCP = false;   // graceCP: just respawned at a checkpoint, so nobody's meter fills for 1.5s   // the last door you opened on this floor: a capture after it starts you there, keys and stars kept
  // the caught and clear sequences run on game time (modeT), so a pause holds them and a quit cancels them
  let safeTop = 0, res = null, catcher = null, shot = null, wipeJob = null, bannerT = 0, chaseHintT = 0;

  // ── input ──────────────────────────────────────────────────
  const stick = { on: false, x: 0, y: 0 }, keys = {};
  const stickEl = $('stick'), knob = $('knob');
  let stickId = null, stickDownT = -1, lastCx = 0, lastCy = 0;
  // a thumb that lands out by the ring starts a quiet walk, not a run: the landing past 55% of the travel is held as an offset.
  // It's only a moment's grace: it melts as the thumb comes back in or pushes on out, and it fades on its own after 0.2s
  // (see relaxStick), so a thumb held on the dashed ring runs within half a second and the knob comes back under it
  const stickOrg = { x: 0, y: 0, len: 0 };
  // an escape: a chase, or a guard half way to seeing you. A thumb slammed out then means it, and runs on the first touch
  const bolting = () => guards.some(g => g.state === 'chase' || (g.state === 'sus' && g.aw > 0.5));
  function setStick(cx, cy, down) {
    lastCx = cx; lastCy = cy;
    // the knob travels 68px on the 212px stick, in proportion on the smaller one, so the dashed ring (where the run starts) sits at the same place
    const b = stickEl.getBoundingClientRect(), max = b.width * 0.32;
    let rx = cx - (b.left + b.width / 2), ry = cy - (b.top + b.height / 2), rl = Math.hypot(rx, ry);
    // a thumb out in the margin past the knob's travel reads as one on the rim: landing further out never runs sooner
    if (rl > max) { rx *= max / rl; ry *= max / rl; rl = max; }
    if (down) {
      const land = bolting() ? max : 0.55 * max;   // in an escape a slammed thumb runs at once
      if (rl > land) { stickOrg.x = rx - rx / rl * land; stickOrg.y = ry - ry / rl * land; } else stickOrg.x = stickOrg.y = 0;
    } else if (rl < stickOrg.len) { const f = Math.min(0.9, rl / stickOrg.len); stickOrg.x *= f; stickOrg.y *= f; }   // gone by the time the thumb is home
    else if (rl > stickOrg.len + 0.5) { stickOrg.x *= 0.85; stickOrg.y *= 0.85; }   // pushing on out asks for more: the grace gives way to it
    stickOrg.len = rl;
    const dx = rx - stickOrg.x, dy = ry - stickOrg.y;
    const len = Math.hypot(dx, dy) || 1, k = Math.min(len, max);
    knob.style.transform = `translate(${dx / len * k}px, ${dy / len * k}px)`;
    stick.x = dx / len * k / max; stick.y = dy / len * k / max; stick.on = true;
  }
  // keep: a capture or a floor clear lets go of the input but not of the thumb, which picks the stick back up (as a fresh,
  // quiet landing) the moment play resumes, without having to lift and touch again
  function clearStick(keep) { stick.on = false; stick.x = stick.y = 0; if (!keep) stickId = null; stickOrg.x = stickOrg.y = stickOrg.len = 0; stickEl.classList.remove('on', 'run', 'loud'); knob.style.transform = ''; }
  stickEl.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation(); AUDIO.unlock();
    if (stickId !== null) return;   // a second finger never steals the thumb's stick
    if (mode === 'intro') skipIntro();
    if (overview) toggleMap();   // like the maze: a move clears the map
    stickId = e.pointerId; stickDownT = time; stickEl.classList.add('on');
    try { stickEl.setPointerCapture(e.pointerId); } catch (err) {}
    setStick(e.clientX, e.clientY, true);
  });
  stickEl.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return;
    if (stick.on) setStick(e.clientX, e.clientY); else { lastCx = e.clientX; lastCy = e.clientY; }   // kept through a capture: just remember where it is
  });
  // every play frame: a thumb kept through a capture lands again, and a landing's grace fades once the first touch is past
  function relaxStick(dt) {
    if (stickId === null) return;
    if (!stick.on) { stickDownT = time; stickEl.classList.add('on'); setStick(lastCx, lastCy, true); return; }
    if (time - stickDownT <= 0.08 || (!stickOrg.x && !stickOrg.y)) return;
    const f = Math.exp(-dt * 12); stickOrg.x *= f; stickOrg.y *= f;
    if (Math.hypot(stickOrg.x, stickOrg.y) < 0.3) stickOrg.x = stickOrg.y = 0;
    setStick(lastCx, lastCy);
  }
  const endStick = (e) => { if (e.pointerId === stickId) clearStick(); };
  stickEl.addEventListener('pointerup', endStick); stickEl.addEventListener('pointercancel', endStick);
  const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyC: 'sneak', Space: 'sneak' };   // never Ctrl: Ctrl+W closes the tab
  addEventListener('keydown', (e) => {
    AUDIO.unlock();
    const k = e.code === 'Space' && (paused || (mode !== 'play' && mode !== 'intro')) ? null : KEYMAP[e.code];   // Space still presses menu buttons
    if (k) { keys[k] = true; e.preventDefault(); if (mode === 'intro' && k !== 'shift' && k !== 'sneak') skipIntro(); }
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (e.code === 'KeyM' || e.code === 'Tab') { e.preventDefault(); toggleMap(); }
    if (e.code === 'KeyE' && !e.repeat) knock();
    if ((e.code === 'Enter' || e.code === 'Space') && mode === 'title' && !e.repeat) startGame();
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; clearStick(); });
  // gamepad: left stick or D-pad to move, Start pauses, A starts and resumes, Back or Y opens the map
  const padWas = {}; let pad = null;
  function padEdge(p, i, k) { const b = p.buttons[i], on = !!(b && b.pressed), was = padWas[k]; padWas[k] = on; return on && !was; }
  function readPad() {   // every frame, paused or not, so A and Start work on any screen
    pad = pollPad();
  }
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      if (padEdge(p, 9, 'start')) { if (mode === 'title') startGame(); else togglePause(); }
      if (padEdge(p, 0, 'a')) { if (mode === 'title') startGame(); else if (paused) togglePause(); }
      const mapB = padEdge(p, 8, 'back'), mapY = padEdge(p, 3, 'y');
      if ((mapB || mapY) && !paused) toggleMap();
      if (padEdge(p, 2, 'x') && !paused) knock();   // X knocks
      const btn = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      const dx = (btn(15) ? 1 : 0) - (btn(14) ? 1 : 0), dy = (btn(13) ? 1 : 0) - (btn(12) ? 1 : 0);
      // RT or RB runs, LT or LB creeps, like Shift and Ctrl on the keys
      const run = btn(7) || btn(5), creep = btn(6) || btn(4);
      if (dx || dy) { const l = Math.hypot(dx, dy); return { x: dx / l * 0.58, y: dy / l * 0.58, dz: 0, run, creep }; }
      return { x: p.axes[0] || 0, y: p.axes[1] || 0, dz: 0.15, run, creep };
    }
    return null;
  }
  const anyKey = () => keys.up || keys.down || keys.left || keys.right;
  let lastDt = 1 / 60;
  // one vector and a magnitude: the stick and pad lose a small dead zone, the keys walk quietly by default
  function readInput() {
    let x = 0, y = 0, dz = 0.12, kb = false, isPad = false, force = 0;   // force: 1 runs, -1 creeps
    const ms = readMouse(lastDt);
    if (ms && ms.m > 0 && !stick.on) { if (anyKey()) clearMouse(); else return { x: ms.x, y: ms.y, m: ms.m, kb: false, isPad: false, force: 0, mouse: true }; }
    if (stick.on) { x = stick.x; y = stick.y; }
    else if (pad && Math.hypot(pad.x, pad.y) > pad.dz) { x = pad.x; y = pad.y; dz = pad.dz; isPad = true; force = pad.run ? 1 : pad.creep ? -1 : 0; }
    else {
      const kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), ky = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (kx || ky) { const l = Math.hypot(kx, ky), s = keys.sneak ? 0.16 : 0.58; x = kx / l * s; y = ky / l * s; dz = 0; kb = true; }   // the plain walk sits under the 0.6 heard line
    }
    const m0 = Math.min(1, Math.hypot(x, y));
    if (m0 <= dz || m0 < 0.01) return { x: 0, y: 0, m: 0, kb, isPad, force: 0 };
    let m = (m0 - dz) / (1 - dz);
    if (force > 0) m = 1; else if (force < 0) m = Math.min(m, 0.4);
    return { x: x / Math.hypot(x, y), y: y / Math.hypot(x, y), m, kb, isPad, force };
  }

  // ── the mouse ──────────────────────────────────────────────
  // Joe: "the force of a shift key to run removes the challenge of movement." On PC you move with the mouse, and how far
  // away you point is how fast you go: a short reach creeps, a middling one walks, a long one runs (and is heard).
  // Hold the button and the player follows the cursor; a quick click walks them there by the nav grid, at the speed the
  // click's distance asked for, round whatever is in the way.
  const MOUSE_REACH = 216;   // screen px from the player to the cursor at which the push is full (the run starts at 88%, 200px out)
  const mouse = { down: false, id: null, t0: 0, sx: 0, sy: 0, wx: 0, wy: 0, steer: false, path: null, pi: 0, m: 0, goal: null, stuckT: 0 };
  const screenToWorld = (sx, sy) => ({ x: (sx - W / 2) / view.z + view.x, y: (sy - H / 2) / view.z + view.y });
  const reachOf = (sx, sy) => { const p = toScreen(P.x, P.y); return U.clamp((Math.hypot(sx - p.x, sy - p.y) - 10) / MOUSE_REACH, 0, 1); };
  function clearMouse() { mouse.down = false; mouse.steer = false; mouse.path = null; mouse.goal = null; mouse.id = null; }
  function mouseGoal(sx, sy) {
    // a click: a route to the nearest open spot to it, walked at the speed its distance asked for
    const w = screenToWorld(sx, sy), q = field.nearestFree(w.x, w.y, P_R + 2, 60);
    if (!q) return;
    const route = nav.path(P.x, P.y, q.x, q.y, 30000);
    if (!route) return;
    mouse.path = route; mouse.pi = 0; mouse.goal = { x: q.x, y: q.y, t: time }; mouse.m = Math.max(0.12, reachOf(sx, sy)); mouse.stuckT = 0;
  }
  cv.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || paused) return;
    AUDIO.unlock();
    if (mode === 'intro') skipIntro();
    if (mode !== 'play' || !P || !P.alive) return;
    e.preventDefault();
    if (overview) { const keep = { x: view.x, y: view.y, z: view.z }; mouseGoal(e.clientX, e.clientY); toggleMap(); Object.assign(view, keep); return; }   // a click on the map sets off for that spot
    mouse.down = true; mouse.id = e.pointerId; mouse.t0 = time; mouse.sx = e.clientX; mouse.sy = e.clientY; mouse.steer = false; mouse.path = null; mouse.goal = null;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  });
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { mouse.sx = e.clientX; mouse.sy = e.clientY; } });
  const mouseUp = (e) => {
    if (e.pointerId !== mouse.id) return;
    const wasSteer = mouse.steer; mouse.down = false; mouse.id = null; mouse.steer = false;
    if (!wasSteer && mode === 'play') mouseGoal(e.clientX, e.clientY);   // a quick click: go there
  };
  cv.addEventListener('pointerup', mouseUp); cv.addEventListener('pointercancel', (e) => { if (e.pointerId === mouse.id) clearMouse(); });
  cv.addEventListener('contextmenu', (e) => { e.preventDefault(); clearMouse(); });   // a right click stops
  // what the mouse asks for this frame, as a direction and a push, or null
  function readMouse(dt) {
    if (!P || mode !== 'play') return null;
    if (mouse.down && !mouse.steer && time - mouse.t0 > 0.16) mouse.steer = true;   // held: follow the cursor
    if (mouse.steer) {
      const w = screenToWorld(mouse.sx, mouse.sy), dx = w.x - P.x, dy = w.y - P.y, d = Math.hypot(dx, dy);
      if (d < P_R) return { x: 0, y: 0, m: 0 };
      return { x: dx / d, y: dy / d, m: reachOf(mouse.sx, mouse.sy) };
    }
    if (mouse.path) {
      let q = mouse.path[mouse.pi];
      while (q && Math.hypot(q.x - P.x, q.y - P.y) < (mouse.pi < mouse.path.length - 1 ? 8 : 3)) q = mouse.path[++mouse.pi];
      if (!q) { mouse.path = null; return null; }
      // stuck on something (a guard's back, a door): give up rather than grind
      mouse.stuckT = Math.hypot(P.vx, P.vy) < 6 && time - mouse.goal.t > 0.4 ? mouse.stuckT + dt : 0;
      if (mouse.stuckT > 0.6) { mouse.path = null; return null; }
      const dx = q.x - P.x, dy = q.y - P.y, d = Math.hypot(dx, dy);
      const end = mouse.goal ? Math.hypot(mouse.goal.x - P.x, mouse.goal.y - P.y) : d;
      return { x: dx / d, y: dy / d, m: Math.min(mouse.m, 0.15 + end / 40) };   // ease in to the last step
    }
    return null;
  }

  // ── floors ─────────────────────────────────────────────────
  function startFloor(n, retry) {
    floorN = n; clearMouse(); popT = null;
    cancelResult(); clearToast(); dimHUD(false);
    // a retry of the same floor keeps the floor already built: generating it again cost ~140ms at the moment of the cut.
    // Only what the last try changed goes back: doors shut, keys and stars on the floor. The doors-shut nav is kept on L.
    const seed = U.hash(save.runSeed, n), same = retry && L && L.seed === seed && L.nav0;
    if (!same) L = LEVEL.generate(seed, n, LEVEL.history(save.runSeed, n));   // the floors below, so the shape changes as you climb
    field = L.field; D = L.D;
    for (const d of L.doors) { d.open = false; d.openT = 0; }
    for (const k of L.keys) k.got = false;
    for (const s of L.stars) s.got = false;
    field.applyDoors();
    nav = L.nav0 || (L.nav0 = new LEVEL.Nav(field, 11));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of L.floor) { const b = U.bbox(s); x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
    floorBox = { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
    const exitAng = Math.atan2(L.exit.y - L.entrance.y, L.exit.x - L.entrance.x);
    P = { x: L.entrance.x, y: L.entrance.y, ang: exitAng, vx: 0, vy: 0, avx: 0, avy: 0, alive: true, hidden: false, keys: [], stepT: 0, run: false, moving: false, scale: 1, m: 0 };
    guards = L.guards.map((d, i) => ({
      ...d, id: i, home: { x: d.x, y: d.y, ang: d.ang }, state: 'patrol', aw: 0, wait: 0, route: null, ri: 0,
      repath: 0, lost: 0, last: null, bubble: null, cone: null, sweep: Math.random() * 10, stuck: 0, lastPos: { x: d.x, y: d.y }, scanT: 0,
    }));
    cams = L.cams.map((c) => ({ ...c, ang: c.base, aw: 0, alarm: 0, cone: null, bubble: null }));
    fx = []; gotStars = 0; knockCD = 0; overview = false; $('mapBtn').classList.remove('on'); stickEl.classList.remove('mapdim');
    stats.time = 0;
    if (!retry || !checkpoint || checkpoint.floor !== n) checkpoint = null;
    else {
      const cp = checkpoint;
      L.keys.forEach((k, i) => { if (cp.keys.includes(i)) { k.got = true; P.keys.push(k); } });
      L.doors.forEach((d, i) => { if (cp.doors.includes(i)) { d.open = true; d.openT = -1e9; } });
      L.stars.forEach((st, i) => { if (cp.stars.includes(i)) { st.got = true; gotStars++; } });
      // the nav for this set of open doors is built once per floor, so a second retry from here is free too
      const nk = cp.doors.join(','); L.navs = L.navs || {};
      field.applyDoors(); nav = nk ? (L.navs[nk] || (L.navs[nk] = new LEVEL.Nav(field, 11))) : L.nav0;
      P.x = cp.x; P.y = cp.y; P.ang = cp.ang;
    }
    // a retry never replays the same moment: every beat starts well along (±25% of it, so a death spot moves), every
    // camera a little into its sweep. From a checkpoint, a guard whose beat comes near starts at one of
    // the points safeSpot found it can walk from for a while without looking at you
    graceCP = !!(retry && checkpoint);
    if (retry) {
      guards.forEach((gd, gi) => {
        if (!gd.path) return;
        const N = gd.path.length, ok = checkpoint && checkpoint.starts && checkpoint.starts[gi];
        let pi = ok ? ok[Math.floor(Math.random() * ok.length)] : (gd.pi + Math.round((Math.random() * 2 - 1) * N * 0.25) + N) % N;
        // the second of a pair on one loop keeps its distance from the first rather than walking in its shoes
        const mate = ok && guards.slice(0, gi).find(o => o.path === gd.path);
        if (mate) { const gap = (i) => { const d = Math.abs(i - mate.pi) % N; return Math.min(d, N - d); }; pi = ok.reduce((b, i) => gap(i) > gap(b) ? i : b, ok[0]); if (!gap(pi)) gd.holdT = 1.6 + Math.random(); }
        gd.pi = pi; gd.x = gd.lastPos.x = gd.path[pi].x; gd.y = gd.lastPos.y = gd.path[pi].y;
        const nx = gd.path[(pi + 1) % N]; gd.ang = Math.atan2(nx.y - gd.y, nx.x - gd.x);
        if (ok && ok.hold) gd.holdT = Math.max(gd.holdT || 0, ok.hold);
        if (!ok || gd.holdT) { gd.wait = gd.waitMax = gd.holdT || Math.random() * 0.8; gd.waitAng = gd.ang; gd.holdT = 0; }
      });
      for (const c of cams) c.phase += (Math.random() * 2 - 1) * 0.8;
    }
    updateHUD();
    if (mode !== 'title') {
      mode = 'intro'; modeT = retry ? 1.3 : 0;
      { const o = overviewFrame(); view.x = o.x; view.y = o.y; view.z = o.z; }
      if (retry) {
        view.x = P.x; view.y = P.y; view.z = baseZ() * 0.92;
        P.scale = 0; popT = -0.12;   // the pop waits for the ink to start lifting, so it is seen
      }
      showBanner(retry ? null : n);
      $('hud').classList.toggle('intro', !retry);   // one clean title card: the HUD tag comes in once the banner goes
      if (!retry) AUDIO.play('floor');
    }
  }
  function overviewZ() {
    const top = 70, bottom = isPortrait() ? 40 : 30;
    return Math.min((W - 40) / floorBox.w, (H - top - bottom) / floorBox.h);
  }
  // the map (and the intro fly-over) fits the floor into what the touch chrome leaves free: below the floor tag and key chip,
  // above the stick ring when upright, beside it on its side, so the bottom room (often the stairs) is never under a thumb.
  // On its side the HUD's left column can instead be kept clear beside the floor: whichever leaves the floor bigger wins.
  function overviewFrame() {
    let bottom = 30, left = 0, right = 0;
    if (isTouch) {
      const r = stickEl.getBoundingClientRect();
      if (isPortrait()) bottom = r.height ? H - r.top + 12 : 276;
      else { const side = (r.width || 188) + 26 + 14; if (save.stickSide === 'left') left = side; else right = side; }
    }
    const fit = (top, l, rr) => ({ top, l, r: rr, z: Math.min((W - 40 - l - rr) / floorBox.w, (H - top - bottom) / floorBox.h) });
    let f = fit(safeTop + 140, left, right);
    if (!isPortrait()) {
      const col = document.querySelector('#hud .left'), cr = col && col.getBoundingClientRect();
      if (cr && cr.width) { const b = fit(safeTop + 66, Math.max(left, cr.right - 8), right); if (b.z > f.z) f = b; }
    }
    return { x: floorBox.cx + (f.r - f.l) / 2 / f.z, y: floorBox.cy + (bottom - f.top) / 2 / f.z, z: f.z };
  }
  const isPortrait = () => H > W;
  // the play zoom: close, like the original (the player about 4% of the short side), but never so close a cone is cropped
  function baseZ() {
    const s = isPortrait() ? W / 340 : H / 330;
    // in portrait the narrow way decides: a guard's square stays on screen while his cone can reach you from the side
    const cl = D ? D.coneLen : 160, coneFit = isPortrait() ? W / (2 * (cl + 24)) : H / (1.8 * cl);
    return U.clamp(Math.min(s, coneFit), 0.8, isTouch ? 2.0 : 2.6);   // a big PC screen still frames the player at about 4% of its height
  }

  // ── the player ─────────────────────────────────────────────
  let mapWas = false, mapHeld = false;   // the map's open-time latch for keys and pad
  function updatePlayer(dt) {
    relaxStick(dt);
    const inp = readInput();
    const m = inp.m;
    // like the maze, a move clears the map: on keys or a pad as on the stick (which closes it on touch). A key already
    // held when the map opened has to be let go first, so the map doesn't shut the moment it opens
    const pushing = (m > 0 && (inp.kb || inp.isPad)) || (stick.on && m > 0.25);
    if (overview && !mapWas) mapHeld = pushing;
    mapWas = overview;
    if (overview) { if (!pushing) mapHeld = false; else if (!mapHeld) { toggleMap(); mapWas = false; } }
    if (overview) { P.vx = P.vy = P.avx = P.avy = 0; P.moving = false; stickEl.classList.remove('run'); return; }   // the map is for planning: the floor holds still
    // a quiet walk up to the dashed ring, a loud run past it; the gap between 0.8 and 0.88 stops thumb jitter flicking between them.
    // Joe: the walk wants more room before the run — the stick is 25% bigger for it and the run starts further out.
    if (inp.kb || inp.force) P.run = m > 0.9;
    else if (inp.isPad) { if (P.run ? m < 0.74 : m > 0.82) P.run = !P.run; }   // worn pad sticks rarely report a full 1.0 on a diagonal
    else if (inp.mouse) { if (P.run ? m < 0.8 : m > 0.88) P.run = !P.run; }
    else if (P.run ? m < 0.8 : m > 0.88 && (time - stickDownT > 0.12 || bolting())) P.run = !P.run;   // never a run on the first touch, unless it's an escape
    let speed = 0;
    if (m > 0) speed = P.run ? U.lerp(98, 128, U.clamp((m - 0.88) / 0.12, 0, 1)) : 24 + 51 * Math.min(1, m / 0.85);
    P.m = m;   // only the run is heard
    stickEl.classList.toggle('run', stick.on && P.run);
    stickEl.classList.toggle('loud', stick.on && !P.run && m > 0.6);   // the heard band of the walk, before the ring
    const tvx = inp.x * speed, tvy = inp.y * speed;
    const acc = 1 - Math.exp(-dt * (Math.hypot(tvx, tvy) < Math.hypot(P.vx, P.vy) ? 30 : 24));   // quick off the mark, quicker to a stop beside a cone
    P.vx += (tvx - P.vx) * acc; P.vy += (tvy - P.vy) * acc;
    const before = { x: P.x, y: P.y };
    field.move(P, P.vx * dt, P.vy * dt, P_R);
    // a push that the walls hold up: little of the step went the way the thumb asked
    const want = Math.hypot(P.vx, P.vy) * dt, ix = inp.x, iy = inp.y;
    const prog = (P.x - before.x) * ix + (P.y - before.y) * iy;
    const wg = field.grad(before.x, before.y);
    if (want > 0.05 && m > 0 && prog < want * 0.5 && -(wg.x * ix + wg.y * iy) > 0.78 && field.sample(before.x, before.y) >= P_R) {
      // a doorway just missed, the square still half over the opening: if a step across the push (a little past the player's whole
      // width either way) opens a clear way on through, slip that way instead. The step is square to the push, not along the
      // wall: on a jamb's corner the wall's normal points round the corner, away from the door. 'On through' is a player's
      // width ahead, so a plain wall met a little off square (the push within ~40 degrees of head-on) never reads as a gap
      const tx = -iy, ty = ix;
      let bt = 0;
      for (let t = 2; t <= 2 * P_R + 4 && !bt; t += 2) for (const sg of [1, -1]) {
        const px = before.x + tx * t * sg, py = before.y + ty * t * sg;
        if (field.sample(px, py) >= P_R && field.sample(px + ix * 3, py + iy * 3) >= P_R + 1 && field.sample(px + ix * 2 * P_R, py + iy * 2 * P_R) >= P_R) { bt = t * sg; break; }
      }
      if (bt) { P.x = before.x; P.y = before.y; const st = Math.min(Math.abs(bt), want) * Math.sign(bt); field.move(P, tx * st, ty * st, P_R); }
      // no gap: a push almost straight into a wall stays put, rather than creeping sideways along a slightly tilted wall normal
      else if (Math.hypot(P.x - before.x, P.y - before.y) < want * 0.14) { P.x = before.x; P.y = before.y; }
    }
    // what the walls let through: the camera leads on this, and a blocked push doesn't build up speed
    const mvx = (P.x - before.x) / dt, mvy = (P.y - before.y) / dt, ak = 1 - Math.exp(-dt * 10);
    P.avx += (mvx - P.avx) * ak; P.avy += (mvy - P.avy) * ak;
    P.vx = U.lerp(P.vx, mvx, 0.5); P.vy = U.lerp(P.vy, mvy, 0.5);
    const moved = Math.hypot(P.x - before.x, P.y - before.y);
    P.moving = moved > 0.15 * dt * 60;
    // face the way you're going; against a wall (close enough that a corner would reach it, and heading the way it actually slides) the square squares up to
    // the wall instead, its nearest face to that heading flat on it, so it slides along the slab rather than digging a corner in
    const head = moved > 0.1 * dt * 60 ? Math.atan2(mvy, mvx) : m > 0 ? Math.atan2(inp.y, inp.x) : P.ang, wd = field.sample(P.x, P.y);
    if (wd < P_R * Math.SQRT2 + 1) {
      // the walls' directions: the one nearest, and (for an inside corner, where that points along the diagonal) the
      // ones under each corner. Of the headings square to one of them, take the one whose corners dig in least
      const q = Math.PI / 2, h = P_R * Math.SQRT2, bases = [field.grad(P.x, P.y)];
      for (let i = 0; i < 4; i++) { const a = P.ang + q / 2 + i * q, cx = P.x + Math.cos(a) * h, cy = P.y + Math.sin(a) * h; if (field.sample(cx, cy) < 2) bases.push(field.grad(cx, cy)); }
      const dig = (a) => { let w = 0; for (let i = 0; i < 4; i++) { const c = a + q / 2 + i * q; w = Math.max(w, -field.sample(P.x + Math.cos(c) * h, P.y + Math.sin(c) * h)); } return w; };
      let best = P.ang, bs = Infinity;
      for (const gb of bases) {
        const wa = Math.atan2(gb.y, gb.x), a = wa + Math.round(U.angDiff(wa, head) / q) * q, sc = dig(a) + Math.abs(U.angDiff(head, a)) * 0.5;
        if (sc < bs) { bs = sc; best = a; }
      }
      P.ang = U.turnTo(P.ang, best, dt * (wd < P_R + 1 ? 20 : 12));
    } else if (m > 0) P.ang = U.turnTo(P.ang, head, dt * 12);

    // footsteps: running is loud, and a guard who hears it comes to look
    if (P.moving) {
      P.stepT -= dt;
      if (P.stepT <= 0) {
        if (P.run) {
          P.stepT = 0.3; AUDIO.play('step', true);
          fx.push({ k: 'ring', x: P.x, y: P.y, r: D.hear, t: 0, dur: 0.7 });
          for (const gd of guards) {
            if (gd.state === 'chase' || gd.state === 'sus') continue;
            if (hears(gd)) { toSearch(gd, { x: P.x, y: P.y }, true); }
          }
          hint('run', isTouch ? 'Running makes noise. Push the stick gently to sneak.' : 'Running makes noise. Point closer to the player to sneak.');
        } else {
          P.stepT = 0.42; AUDIO.play('step', false);
          // the top of the walk is quick, and a guard right beside you hears it: the gentle push is the silent one
          if (m > 0.6) {
            fx.push({ k: 'ring', x: P.x, y: P.y, r: 45, t: 0, dur: 0.45 });
            for (const gd of guards) if (gd.state !== 'chase' && gd.state !== 'sus' && hears(gd, 45)) toSearch(gd, { x: P.x, y: P.y }, true);
          }
        }
      }
    } else P.stepT = 0.05;

    // hiding
    const was = P.hidden;
    P.hidden = L.shades.some(s => Math.hypot(s.x - P.x, s.y - P.y) < s.r - 2);
    if (P.hidden && !was) {
      // a dive in plain view hides nothing: whoever watched you go in walks straight in after you
      const watched = guards.some(gd => gd.lost < 0.1 && (gd.state === 'chase' || gd.aw > 0.6));
      if (watched) {
        P.exposedT = 1.6; fx.push({ k: 'puff', x: P.x, y: P.y, t: 0, dur: 0.6, red: true });
        if (time - (P.exposedToast || -99) > 8) { P.exposedToast = time; toast('They saw you go in \u2014 break their line of sight first.', 3.2); }
      } else {
        AUDIO.play('hide'); fx.push({ k: 'puff', x: P.x, y: P.y, t: 0, dur: 0.5 });
        hint('hidden', 'Hidden \u2014 once nobody\'s watching you go in.');
      }
    }
    if (P.exposedT > 0) P.exposedT -= dt;

    // pickups
    for (const s of L.stars) if (!s.got && Math.hypot(s.x - P.x, s.y - P.y) < 16) {
      s.got = true; gotStars++; AUDIO.play('star');
      // the star itself flies up to its slot in the HUD, which fills when it lands
      fx.push({ k: 'burst', x: s.x, y: s.y, t: 0, dur: 0.7, c: COL.star }, { k: 'fly', x: s.x, y: s.y, t: 0, dur: 0.45, slot: gotStars - 1 });
      updateHUD();
    }
    for (const k of L.keys) if (!k.got && Math.hypot(k.x - P.x, k.y - P.y) < 16) {
      k.got = true; P.keys.push(k); AUDIO.play('key'); updateHUD();
      fx.push({ k: 'burst', x: k.x, y: k.y, t: 0, dur: 0.7, c: k.color.c }, { k: 'pop', x: k.x, y: k.y, t: 0, dur: 0.9, text: k.color.name.toUpperCase() + ' KEY', c: k.color.c, pill: true });
      hint('key', 'A key opens the door striped in its colour.');
    }
    // doors open for whoever carries their key
    for (const d of L.doors) {
      if (d.open) continue;
      const near = U.sd(d.shape, P.x, P.y) < P_R + 14;
      if (!near) continue;
      if (P.keys.some(k => k.door === d)) {
        d.open = true; d.openT = time; field.applyDoors(); nav = new LEVEL.Nav(field, 11);
        AUDIO.play('door'); updateHUD();
        // a checkpoint by the door, somewhere no beat or camera sweep looks at
        const sp = safeSpot(d.conn), dir = sp.dir;
        checkpoint = { floor: floorN, x: sp.x, y: sp.y, starts: sp.starts, ang: Math.atan2(dir.y, dir.x), keys: L.keys.map((k, i) => k.got ? i : -1).filter(i => i >= 0),
          doors: L.doors.map((o, i) => o.open ? i : -1).filter(i => i >= 0), stars: L.stars.map((o, i) => o.got ? i : -1).filter(i => i >= 0) };
        hint('checkpoint', 'Door open. If you\'re caught now, you start again here.');
        const c = U.centroid(d.shape); fx.push({ k: 'burst', x: c.x, y: c.y, t: 0, dur: 0.6, c: d.color.c });
      } else if (lockedCD <= 0) {
        lockedCD = 3; AUDIO.play('locked'); toast(`Locked. Find the ${d.color.name} key.`, 2.2);
      }
    }
    // the stairs
    if (Math.hypot(L.exit.x - P.x, L.exit.y - P.y) < 15) clearFloor();
    else if (Math.hypot(L.exit.x - P.x, L.exit.y - P.y) < 260) hint('exit', 'The stairs up. Step on them to climb.');
  }

  // the knock: a rap on the nearest wall, the one noise you make on purpose. Every guard on its
  // rounds within earshot (110, round corners as footsteps carry) comes over to look, at a walk, so a
  // guard can be pulled off the door it watches. Once every six seconds.
  const KNOCK_CD = 6, KNOCK_R = 110;
  function knock() {
    if (mode !== 'play' || paused || overview || !P || !P.alive || knockCD > 0) return;
    knockCD = KNOCK_CD;
    AUDIO.play('step', true); setTimeout(() => AUDIO.play('step', true), 120);
    fx.push({ k: 'ring', x: P.x, y: P.y, r: KNOCK_R, t: 0, dur: 0.8 }, { k: 'ring', x: P.x, y: P.y, r: KNOCK_R * 0.8, t: 0, dur: 0.6 });
    let n = 0;
    for (const gd of guards) if ((gd.state === 'patrol' || gd.state === 'return') && hears(gd, KNOCK_R)) { toSearch(gd, { x: P.x, y: P.y }, true); n++; }
    if (n) hint('knock', 'They heard that. Move before they get here.');
    syncKnock();
  }
  let knockShown = -1;
  function syncKnock() {
    const q = Math.round((1 - knockCD / KNOCK_CD) * 48) / 48;
    if (q === knockShown) return;
    knockShown = q;
    const b = $('knockBtn'); if (!b) return;
    b.style.setProperty('--k', q); b.classList.toggle('ready', q >= 1);
  }

  // ── guards ─────────────────────────────────────────────────
  // footsteps carry round corners and through doorways, not through walls: heard if the guard is
  // in the open within earshot, or the walk to you is short
  function hears(gd, r = D.hear) {
    const d = Math.hypot(gd.x - P.x, gd.y - P.y);
    if (d >= r) return false;
    if (field.ray(P.x, P.y, (gd.x - P.x) / d, (gd.y - P.y) / d, d) >= d - G_R) return true;
    const p = nav.path(P.x, P.y, gd.x, gd.y, 900);
    if (!p) return false;
    let len = Math.hypot(p[0].x - P.x, p[0].y - P.y);
    for (let i = 1; i < p.length; i++) len += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    return len < r * 1.3;
  }
  // how watched a spot is in the first seconds after a respawn there. Cameras through their whole
  // sweep and sentries through their turn either see it or don't. A walker is fine if some point of
  // its beat lets it walk T seconds, looking where it goes or round it at a stop, without the spot in
  // view: those points are where a retry may start it (starts[i]; null when its beat never comes near).
  // near: how close the nearest watcher comes, to pick the least bad spot when none is clear.
  function watchOf(p, T) {
    let near = Infinity;
    const reach = D.coneLen + P_R + 10;
    const lookAt = (q, ang, lim) => {
      const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
      if (d > reach) return false;
      if (d > 30 && Math.abs(U.angDiff(ang, Math.atan2(dy, dx))) > lim) return false;
      if (d < 1) return true;
      // a guard drifts a little off its line, enough to see round a corner its line just misses
      for (const o of [0, 5, -5]) {
        const ox = q.x - dy / d * o, oy = q.y + dx / d * o, ex = p.x - ox, ey = p.y - oy, e = Math.hypot(ex, ey);
        if (field.ray(ox, oy, ex / e, ey / e, e) >= e - P_R) return true;
      }
      return false;
    };
    for (const c of cams) {
      const e = eyeOf(c), d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < D.coneLen * 1.05 + 20 && Math.abs(U.angDiff(c.base, Math.atan2(p.y - e.y, p.x - e.x))) < c.amp + 0.42 + 0.15 + Math.atan2(P_R, d) && field.ray(e.x, e.y, (p.x - e.x) / d, (p.y - e.y) / d, d) >= d - P_R) return { seen: true, near: 0, score: 0 };
    }
    const starts = [];
    let seen = false, score = Infinity;
    for (const gd of guards) {
      if (!gd.path) { near = Math.min(near, Math.hypot(gd.home.x - p.x, gd.home.y - p.y)); if (lookAt(gd.home, gd.home.ang, gd.amp + D.fov + 0.3)) return { seen: true, near, score: 0 }; starts.push(null); continue; }
      const N = gd.path.length;
      let close = Infinity;
      for (let i = 0; i < N; i++) {
        const a = gd.path[i], b = gd.path[(i + 1) % N], ex = b.x - a.x, ey = b.y - a.y, l2 = ex * ex + ey * ey || 1;
        const t = U.clamp(((p.x - a.x) * ex + (p.y - a.y) * ey) / l2, 0, 1);
        close = Math.min(close, Math.hypot(a.x + ex * t - p.x, a.y + ey * t - p.y));
      }
      if (close > reach) { starts.push(null); continue; }   // its beat never comes within sight of it
      // how far it walks from point i before the spot comes into view (budget if never)
      const budget = D.patrol * T;
      const walk = (i0) => {
        let done = 0;
        for (let i = i0, n = 0; done < budget && n < N; i = (i + 1) % N, n++) {
          const a = gd.path[i], b = gd.path[(i + 1) % N], l = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
          // a stop: it looks round from the way it came in, which on a pace is the way it then leaves reversed
          const z = gd.path[(i - 1 + N) % N], inAng = Math.atan2(a.y - z.y, a.x - z.x), lim = D.fov + (a.look || 0.8) + 0.5;
          if ((a.pause > 0 || n === 0) && (lookAt(a, ang, lim) || lookAt(a, inAng, lim))) return done;
          // a corner: it turns the short way from the way it came in to the way it leaves, and its eyes sweep all between
          const sw = U.angDiff(inAng, ang);
          if (n > 0 && lookAt(a, inAng + sw / 2, Math.abs(sw) / 2 + D.fov + 0.3)) return done;
          for (let t = 0; t < l && done < budget; t += 8, done += 8) {
            const q = { x: a.x + (b.x - a.x) * t / l, y: a.y + (b.y - a.y) * t / l };
            near = Math.min(near, Math.hypot(q.x - p.x, q.y - p.y));
            if (lookAt(q, ang, D.fov + 0.45)) return done;
          }
        }
        return budget;
      };
      const step = Math.max(1, Math.floor(N / 16)), good = [];
      let top = -1, topI = 0;
      for (let i = 0; i < N; i += step) { const w = walk(i); if (w >= budget) good.push(i); if (w > top) { top = w; topI = i; } }
      score = Math.min(score, top);
      // no start keeps it off the spot for long: it starts from the best one and holds there first, so
      // its first look still comes T seconds in (a hold at its post looks round, and its post is clear)
      if (!good.length) { seen = true; good.push(topI); if (top > 0) good.hold = Math.min(3.5, T - top / D.patrol); }
      starts.push(good);
    }
    return { seen, near, starts, score };
  }
  // where a checkpoint goes: just through the door if no one will look there for a while, else
  // to one side of it, or back in the room you came from (cleared already); at worst the quietest of them
  function safeSpot(cn) {
    const m = cn.mouth, n = cn.dirFrom(cn.a);
    // through the door is away from the side you opened it from
    const s = (P.x - m.x) * n.x + (P.y - m.y) * n.y < 0 ? 1 : -1, dir = { x: n.x * s, y: n.y * s }, tan = { x: -dir.y, y: dir.x };
    // the spots near the door, nearest first, the far side a little ahead of the side you came from
    const spots = [];
    for (let d = -330; d <= 330; d += 30) for (let w = -330; w <= 330; w += 30) {
      const r = Math.hypot(d, w);
      if (r < 30 || r > 340) continue;
      spots.push({ d, w, k: r + (d < 0 ? 25 : 0) });
    }
    spots.sort((a, b) => a.k - b.k);
    let best = null;
    for (const { d, w } of spots) {
      const p = field.nearestFree(m.x + dir.x * d + tan.x * w, m.y + dir.y * d + tan.y * w, 14, 12);
      if (!p) continue;
      // reachable from the door, a short walk away
      const r = nav.path(m.x, m.y, p.x, p.y, 4000);
      if (!r) continue;
      let len = Math.hypot(r[0].x - m.x, r[0].y - m.y);
      for (let i = 1; i < r.length; i++) len += Math.hypot(r[i].x - r[i - 1].x, r[i].y - r[i - 1].y);
      if (len > Math.hypot(d, w) * 1.4 + 30) continue;
      const v = watchOf(p, 5.5), face = d > 0 ? dir : { x: -dir.x, y: -dir.y };
      if (!v.seen) return { x: p.x, y: p.y, dir: face, starts: v.starts };
      // none clear: the one where the watchers take longest to look, then the one they come least near
      if (v.starts && (!best || v.score > best.score || (v.score === best.score && v.near > best.near))) best = { x: p.x, y: p.y, score: v.score, near: v.near, dir: face, starts: v.starts };
    }
    if (best) return best;
    const p = field.nearestFree(m.x + dir.x * 40, m.y + dir.y * 40, 14, 40) || { x: P.x, y: P.y };
    return { x: p.x, y: p.y, dir, starts: null };
  }
  // where a watcher sees from: a guard's own square, a camera's lens a little out from its wall
  const eyeOf = (o) => o.base === undefined ? o : { x: o.x + Math.cos(o.base) * 6, y: o.y + Math.sin(o.base) * 6 };
  function sees(o, len, fov, near) {
    if (!P || !P.alive) return null;
    const e = eyeOf(o), dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy);
    // in a shade you are only found by someone who walks right into you, or by a thorough guard
    // come to look in this very pool, on its own half of it: the far side of the pool is the safe one
    if (P.hidden) {
      if (near && d < 12) return { d };
      const sh = o.peekSh;
      if (!sh || !(o.state === 'sus' || (o.state === 'search' && o.scanT >= 0)) || Math.hypot(P.x - sh.x, P.y - sh.y) > sh.r || d > sh.r + 30) return null;
      if ((P.x - sh.x) * (e.x - sh.x) + (P.y - sh.y) * (e.y - sh.y) < 0) return null;   // past the middle, on the far half, you stay unseen
      if (Math.abs(U.angDiff(o.ang, Math.atan2(dy, dx))) > fov + Math.atan2(P_R, d)) return null;
      return field.ray(e.x, e.y, dx / d, dy / d, d) >= d - P_R ? { d } : null;
    }
    // a guard feels you at its elbow, just past arm's reach (CATCH), whichever way it faces
    if (near && d < 18) return { d };
    if (d > len + P_R) return null;
    if (Math.abs(U.angDiff(o.ang, Math.atan2(dy, dx))) > fov + Math.atan2(P_R, d)) return null;
    const t = field.ray(e.x, e.y, dx / d, dy / d, d);
    return t >= d - P_R ? { d } : null;
  }
  // where to look for someone last seen at p: never on top of a shade, but at its rim, the guard's
  // side of it, so they stand and look round while the player holds still in the dark
  // A guard who watched you slip in (still sure of you, and p is where it last saw you) walks
  // right into the pool: a shade only hides you if you broke its line of sight first.
  function lookSpot(gd, p) {
    const sh = L.shades.find(s => Math.hypot(p.x - s.x, p.y - s.y) < s.r + 18);
    if (!sh) return { x: p.x, y: p.y };
    const watched = (gd.aw > 0.6 || gd.state === 'chase') && gd.last && Math.hypot(gd.last.x - p.x, gd.last.y - p.y) < 1;
    if (watched) return { x: sh.x, y: sh.y, dive: true };
    // stop on the rim on the guard's own side, so the walk there never cuts across the pool
    const e = Math.hypot(gd.x - sh.x, gd.y - sh.y) || 1, keep = sh.r + 24;
    const q = { x: sh.x + (gd.x - sh.x) / e * keep, y: sh.y + (gd.y - sh.y) / e * keep };
    return field.nearestFree(q.x, q.y, G_R + 1, 40) || { x: gd.x, y: gd.y };
  }
  // a thorough guard (upper floors) ends a search by going to look at the nearest pool of shade from
  // its rim and staring into it, so hiding is a held breath, not a sure thing: it sees into its own
  // half of the pool (sees), so you slip to the far side, or out of it, while its '?' is turned your way
  function peekShade(gd) {
    gd.peeked = true;
    let sh = null, bd = 220;
    for (const s of L.shades) { const d = Math.hypot(s.x - gd.x, s.y - gd.y); if (d < bd && d > s.r + 30) { bd = d; sh = s; } }
    if (!sh) return false;
    // a spot on the rim with a clear look into the pool, the nearest to its own side first
    const keep = sh.r + 24, ga = Math.atan2(gd.y - sh.y, gd.x - sh.x), spots = [];
    for (let i = 0; i < 12; i++) {
      const a = ga + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * TAU / 12, p = field.nearestFree(sh.x + Math.cos(a) * keep, sh.y + Math.sin(a) * keep, G_R + 1, 12);
      if (!p) continue;
      const dx = sh.x - p.x, dy = sh.y - p.y, d = Math.hypot(dx, dy);
      // and a look across its whole half of the pool, not just its middle: a wall's end beside the pool can't hide a corner of it
      const ux = -dx / d, uy = -dy / d, clearTo = (a, b) => { const qx = sh.x + (ux * a - uy * b) * sh.r, qy = sh.y + (uy * a + ux * b) * sh.r, ex = qx - p.x, ey = qy - p.y, e = Math.hypot(ex, ey); return field.ray(p.x, p.y, ex / e, ey / e, e) >= e - 4; };
      if (d > sh.r + 8 && d < sh.r + 34 && clearTo(0, 0) && clearTo(0.5, 0) && clearTo(0.3, 0.6) && clearTo(0.3, -0.6)) spots.push(p);
    }
    let q = null, r = null;
    // (a pool round the back of a wall, a long walk away, isn't worth the look)
    for (const p of spots.slice(0, 4)) { r = nav.path(gd.x, gd.y, p.x, p.y, 20000); if (r && plen(r, gd) < 320) { q = p; break; } }
    if (!q) return false;
    gd.target = q; gd.scanT = -1; gd.hurry = 0; gd.route = r; gd.ri = 0; gd.peekSh = sh;
    if (gd.bubble) gd.bubble.a = 1;
    return true;
  }
  // how far a route really walks, from o
  const plen = (r, o) => { let l = 0, a = o; for (const q of r) { l += Math.hypot(q.x - a.x, q.y - a.y); a = q; } return l; };
  function bubble(o, k) { if (!o.bubble || o.bubble.k !== k) o.bubble = { k, t: 0, a: 1 }; }
  // true when there is a way there. When there isn't (a locked door, a wall between), a searcher looks
  // round from where it stands rather than pressing into the wall; a returner heads for its round
  // anyway (the stuck check plans again); a chaser keeps the route it had
  function routeTo(gd, x, y) {
    const r = nav.path(gd.x, gd.y, x, y, 20000); gd.ri = 0;
    if (r) { gd.route = r; return true; }
    if (gd.state === 'search') { gd.route = []; gd.scanT = 0; gd.scanBase = gd.ang; }
    else if (gd.state === 'sus') gd.route = [];
    else if (gd.state === 'return' || !gd.route) gd.route = [{ x, y }];
    return false;
  }
  function toSearch(gd, p, heard) {
    if (gd.state !== 'search' && gd.state !== 'chase') { if (hmmCD <= 0) { AUDIO.play('hmm'); hmmCD = 0.6; } }
    const q = lookSpot(gd, p);
    gd.state = 'search'; gd.target = q; gd.scanT = -1; gd.hurry = !!heard ? 0 : 1; gd.dive = !!q.dive; gd.peeked = false; gd.peekSh = null;
    routeTo(gd, q.x, q.y); bubble(gd, '?');
    if (heard) gd.heard = true;
  }
  function toChase(gd) {
    if (gd.state !== 'chase') {
      if (spottedCD <= 0) { AUDIO.play('spotted'); spottedCD = 1.2; if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) {} }
      fx.push({ k: 'flash', t: 0, dur: 0.35 });
      if (toastId === 'sus') clearToast();   // the 'get out of the light' advice is stale once he's running
      if (!save.hints.chase && !chaseHintT) chaseHintT = 0.8;   // only if the chase lasts: a capture straight away says it already
      // a startle: the '!' and the stinger land before they move, a beat to turn and run
      gd.startle = 0.35;
    }
    gd.state = 'chase'; gd.aw = 1; gd.repath = 0; bubble(gd, '!');
    // a shout: guards close by who can see this one come over to look, at a walk, not a sprint
    for (const o of guards) {
      if (o === gd || o.state === 'chase' || o.state === 'sus') continue;
      const d = Math.hypot(o.x - gd.x, o.y - gd.y);
      if (d < 170 && field.ray(gd.x, gd.y, (o.x - gd.x) / d, (o.y - gd.y) / d, d) >= d - 4) { toSearch(o, { x: P.x, y: P.y }); o.hurry = 0; }
    }
  }
  function toReturn(gd) {
    gd.state = 'return'; gd.hurry = 0; gd.heard = false; gd.peekSh = null;
    if (gd.path) {
      let best = 0, bd = Infinity;
      gd.path.forEach((q, i) => { const d = Math.hypot(q.x - gd.x, q.y - gd.y); if (d < bd) { bd = d; best = i; } });
      gd.pi = best; routeTo(gd, gd.path[best].x, gd.path[best].y);
    } else routeTo(gd, gd.home.x, gd.home.y);
  }
  // walk toward a point, turning as you go; true when there
  function stepToward(o, tx, ty, speed, dt, turn) {
    const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
    if (d < 1.5) return true;
    o.ang = U.turnTo(o.ang, Math.atan2(dy, dx), turn * dt);
    const face = Math.max(0.3, Math.cos(U.angDiff(o.ang, Math.atan2(dy, dx))));
    const m = Math.min(d, speed * dt * face);
    field.move(o, dx / d * m, dy / d * m, G_R);
    return Math.hypot(tx - o.x, ty - o.y) < 3;
  }
  function follow(gd, speed, dt, turn) {
    if (!gd.route) return true;
    while (gd.ri < gd.route.length) {
      const p = gd.route[gd.ri];
      if (!stepToward(gd, p.x, p.y, speed, dt, turn)) return false;
      gd.ri++;
      if (gd.ri < gd.route.length) return false;
    }
    return true;
  }

  // two guards never walk through each other: a walker that comes up behind another one going its
  // way holds a beat; one meeting another (head on, or standing in its way) steps aside to its right
  // as it goes, so both slide past like people in a hall. True when it should hold this frame.
  function makeRoom(gd, dt) {
    if (gd.sepT > 0) { gd.sepT -= dt; return true; }
    const hx = Math.cos(gd.ang), hy = Math.sin(gd.ang), near = 2 * G_R + 14;
    for (const o of guards) {
      if (o === gd) continue;
      const dx = o.x - gd.x, dy = o.y - gd.y, d = Math.hypot(dx, dy);
      if (d >= near || d < 0.01 || dx * hx + dy * hy <= 0) continue;
      const still = o.state === 'sus' || o.wait > 0 || (o.kind === 'sentry' && o.state === 'patrol') || o.sepT > 0;
      const same = Math.cos(o.ang) * hx + Math.sin(o.ang) * hy > 0.5;
      if (same && !still && d < 2 * G_R + 4) { gd.sepT = 0.3; return true; }
      if (same && !still) return false;
      // to the right of the heading, harder the closer it is, so it goes round rather than through
      const k = 30 + 40 * (1 - d / near);
      field.move(gd, -hy * k * dt, hx * k * dt, G_R);
      return false;
    }
    return false;
  }

  function updateGuard(gd, dt) {
    const s = sees(gd, D.coneLen, D.fov, true);
    if (s) { gd.last = { x: P.x, y: P.y }; gd.lost = 0; } else gd.lost += dt;
    if (gd.bubble) gd.bubble.t += dt;

    // seeing you fills the meter; closer and faster fills it faster
    const grace = graceCP && mode === 'play' && modeT < 1.5;
    if (s && gd.state !== 'chase' && !grace) {
      const rate = D.detect * (0.3 + 1.9 * Math.max(0, 1 - s.d / D.coneLen)) * (P.run ? 1.4 : P.moving ? 1 : 0.8);
      gd.aw = Math.min(1, gd.aw + rate * dt);
      // right on top of a guard who's facing you is an instant '!'; one rounding a corner beside you still gives a '?'
      if (s.d < 20 && !P.hidden && Math.abs(U.angDiff(gd.ang, Math.atan2(P.y - gd.y, P.x - gd.x))) < D.fov) gd.aw = 1;
      if (gd.state !== 'sus') {
        gd.prevState = gd.state; gd.state = 'sus'; gd.susLook = gd.ang; gd.peakAw = 0; gd.repath = 0;
        bubble(gd, '?'); if (hmmCD <= 0) { AUDIO.play('hmm'); hmmCD = 0.5; }
        hint('sus', 'A guard noticed something. Get out of the light before the meter fills.');
      }
      if (gd.aw >= 1) toChase(gd);
    }

    const turn = gd.state === 'chase' ? 7 : 3.4;
    switch (gd.state) {
      case 'patrol': {
        if (gd.kind === 'sentry') {
          // a snap sentry (floor 13 up) holds each look, then whips its head across
          gd.sweep += dt * (gd.snap ? 1.6 : 1);
          const w = Math.sin(gd.sweep * 0.55), shaped = Math.sign(w) * Math.min(1, Math.abs(w) * (gd.snap ? 2.6 : 1.5));
          gd.ang = U.turnTo(gd.ang, gd.home.ang + shaped * gd.amp, dt * (gd.snap ? 4 : 1.6));
          if (Math.hypot(gd.x - gd.home.x, gd.y - gd.home.y) > 4) stepToward(gd, gd.home.x, gd.home.y, D.patrol, dt, 3);
          break;
        }
        if (gd.wait > 0) {
          gd.wait -= dt;
          const q = gd.path[gd.pi], f = 1 - gd.wait / gd.waitMax;
          gd.ang = U.turnTo(gd.ang, gd.waitAng + Math.sin(f * TAU) * (q.look || 0.8), dt * 2.4);
          if (gd.wait <= 0) gd.pi = (gd.pi + 1) % gd.path.length;
          break;
        }
        if (makeRoom(gd, dt)) break;
        const q = gd.path[gd.pi];
        if (stepToward(gd, q.x, q.y, D.patrol, dt, 3.2)) {
          if (q.pause > 0) { gd.wait = gd.waitMax = q.pause; gd.waitAng = gd.ang; }
          else gd.pi = (gd.pi + 1) % gd.path.length;
        }
        break;
      }
      case 'sus': {
        // stop, turn to look, edge toward what you saw
        gd.peakAw = Math.max(gd.peakAw || 0, gd.aw);
        if (gd.last) {
          gd.ang = U.turnTo(gd.ang, Math.atan2(gd.last.y - gd.y, gd.last.x - gd.x), dt * 2.6);
          if (gd.aw > 0.6 && Math.hypot(gd.last.x - gd.x, gd.last.y - gd.y) > 30) {
            // round a corner by the nav, not along the slab
            if (field.clear(gd.x, gd.y, gd.last.x, gd.last.y, G_R - 1)) { stepToward(gd, gd.last.x, gd.last.y, 16, dt, 2.6); gd.repath = 0; }
            else {
              gd.repath -= dt;
              if (!(gd.repath > 0)) { routeTo(gd, gd.last.x, gd.last.y); gd.repath = 0.5; }
              follow(gd, 16, dt, 2.6);
            }
          }
        }
        if (!s) {
          gd.aw = Math.max(0, gd.aw - dt * 0.3);
          if (gd.lost > 1.1) {
            // a real glimpse (over a third of the meter) is worth a walk over to look, at an amble
            if ((gd.aw > 0.25 || gd.peakAw > 0.35) && gd.last) { const sure = gd.aw > 0.25; toSearch(gd, gd.last); gd.hurry = sure ? 1 : 0; }
            else { gd.aw = 0; toReturn(gd); gd.bubble = null; AUDIO.play('lost'); }
          }
        }
        break;
      }
      case 'chase': {
        if (gd.startle > 0) {
          gd.startle -= dt;
          gd.ang = U.turnTo(gd.ang, Math.atan2(P.y - gd.y, P.x - gd.x), dt * turn);
          break;
        }
        gd.repath -= dt;
        if (s) {
          if (field.clear(gd.x, gd.y, P.x, P.y, G_R - 1)) { gd.route = [{ x: P.x, y: P.y }]; gd.ri = 0; }
          else if (gd.repath <= 0) { routeTo(gd, P.x, P.y); gd.repath = 0.3; }
        } else if (gd.repath <= 0 && gd.last) { const q = lookSpot(gd, gd.last); routeTo(gd, q.x, q.y); gd.repath = 0.6; }
        const done = follow(gd, D.chase, dt, turn);
        // out of sight for two seconds, or at the spot and you're not there: a '?' and a look round.
        // Round a corner (no straight look to where you were last) they give up sooner, at 1.2s, so
        // breaking the line of sight round one corner reliably turns a chase into a search.
        // the meter drops well back, so a glimpse as they search is a beat to duck away, not a re-capture
        const lostAt = gd.last && !field.clear(gd.x, gd.y, gd.last.x, gd.last.y, G_R - 1) ? 1.2 : 2;
        if (!s && (done || gd.lost > lostAt)) { gd.aw = 0.4; toSearch(gd, gd.last || { x: gd.x, y: gd.y }); }
        break;
      }
      case 'search': {
        if (gd.scanT < 0) {
          const spd = gd.hurry ? D.chase * 0.75 : Math.min(D.patrol * 1.3, 54);   // an amble stays a hair under a silent sneak (about 57)
          if (follow(gd, spd, dt, 4)) { gd.scanT = 0; gd.scanBase = gd.peekSh ? Math.atan2(gd.peekSh.y - gd.y, gd.peekSh.x - gd.x) : gd.ang; }
          // a route round a wall can still come at the pool from another side: halt at its rim and look
          else if (P.hidden && !gd.dive && L.shades.some(sh => Math.hypot(P.x - sh.x, P.y - sh.y) < sh.r && Math.hypot(gd.x - sh.x, gd.y - sh.y) < sh.r + 16)) { gd.scanT = 0; gd.scanBase = gd.ang; }
          gd.stuck = Math.hypot(gd.x - gd.lastPos.x, gd.y - gd.lastPos.y) < 0.05 ? gd.stuck + dt : 0;
          if (gd.stuck > 1.2) { gd.scanT = 0; gd.scanBase = gd.ang; gd.stuck = 0; }
        } else {
          // look around, the "?" fading as they lose interest
          gd.scanT += dt;
          const dur = 4.2;
          // a peek stares into the pool, sweeping only its width, the '?' held solid while it looks
          gd.ang = U.turnTo(gd.ang, gd.scanBase + Math.sin(gd.scanT * (gd.peekSh ? 1.1 : 1.5)) * (gd.peekSh ? 0.45 : 1.5), dt * 2.8);
          if (gd.bubble) gd.bubble.a = gd.peekSh ? 1 : 1 - U.clamp((gd.scanT - dur + 1.8) / 1.8, 0, 1);
          gd.aw = Math.max(0, gd.aw - dt * 0.25);
          if (gd.scanT > dur && gd.peek && !gd.peeked && peekShade(gd)) break;
          if (gd.scanT > dur) { gd.bubble = null; gd.aw = 0; AUDIO.play('lost'); toReturn(gd); }
        }
        break;
      }
      case 'return': {
        if (makeRoom(gd, dt)) break;
        if (follow(gd, D.patrol, dt, 3.2)) {
          gd.state = 'patrol'; gd.route = null;
          if (gd.kind === 'sentry') gd.sweep = 0;
        }
        gd.stuck = Math.hypot(gd.x - gd.lastPos.x, gd.y - gd.lastPos.y) < 0.05 ? gd.stuck + dt : 0;
        if (gd.stuck > 1.5) { gd.stuck = 0; toReturn(gd); }
        break;
      }
    }
    // and two squares never sit on one another: each eases out of any other's footprint
    for (const o of guards) {
      if (o === gd) continue;
      const dx = gd.x - o.x, dy = gd.y - o.y, d = Math.hypot(dx, dy), min = 2 * G_R + 2;
      if (d < min) { const u = d > 0.01 ? 1 / d : 0, m = Math.min((min - d) / 2, 40 * dt); field.move(gd, (u ? dx * u : 1) * m, (u ? dy * u : 0) * m, G_R); }
    }
    gd.lastPos.x = gd.x; gd.lastPos.y = gd.y;
    if (P.alive && mode === 'play' && Math.hypot(gd.x - P.x, gd.y - P.y) < CATCH) caught(gd);
  }

  // a camera follows you only to the edge of the arc it is drawn sweeping (plus a hair), so a glimpse
  // can always be slipped sideways: past the edge it loses you and the meter drains
  const camTrack = (c) => c.base + U.clamp(U.angDiff(c.base, Math.atan2(P.y - c.y, P.x - c.x)), -(c.amp + 0.25), c.amp + 0.25);
  function updateCam(c, dt) {
    if (c.bubble) c.bubble.t += dt;
    const s = sees(c, D.coneLen * 1.05, 0.42, false);
    if (c.alarm > 0) {
      c.alarm -= dt;
      if (s) c.ang = U.turnTo(c.ang, camTrack(c), dt * 2);
      if (c.alarm <= 0) { c.aw = 0; c.bubble = null; }
      return;
    }
    if (s && !(graceCP && mode === 'play' && modeT < 1.5)) {
      c.ang = U.turnTo(c.ang, camTrack(c), dt * 1.2);
      c.aw = Math.min(1, c.aw + dt * D.detect * 0.9);
      if (!c.bubble) { bubble(c, '?'); if (hmmCD <= 0) { AUDIO.play('hmm'); hmmCD = 0.5; } }
      if (c.aw >= 1) {
        // the alarm: the nearest guards come running to where you were
        c.alarm = 4; bubble(c, '!'); AUDIO.play('alarm');
        fx.push({ k: 'flash', t: 0, dur: 0.3 });
        // only guards with a real way there, nearest by that way, so nobody is sent to press against a wall or a locked door
        guards.filter(o => o.state !== 'chase' && Math.hypot(o.x - c.x, o.y - c.y) < 750)
          .map(o => { const r = nav.path(o.x, o.y, P.x, P.y, 20000); return { o, d: r ? plen(r, o) : Infinity }; }).filter(e => e.d < 900)
          .sort((a, b) => a.d - b.d).slice(0, 2).forEach(e => { toSearch(e.o, { x: P.x, y: P.y }); e.o.hurry = 1; });
        hint('cam', 'Cameras call the nearest guards to wherever they saw you.');
      }
    } else {
      c.aw = Math.max(0, c.aw - dt * 0.5);
      if (c.aw === 0) c.bubble = null;
      c.phase += dt * TAU / c.period;
      c.ang = U.turnTo(c.ang, c.base + Math.sin(c.phase) * c.amp, dt * 1.5);
    }
  }

  // the cone is the guard's visibility polygon: rays out to the first wall, with the angle refined
  // wherever neighbouring rays disagree, so the edge a wall corner casts is a hard straight line
  function cone(o, len, fov) {
    const e = eyeOf(o), n = Math.max(18, Math.round(fov * 2 / 0.04)), pts = [e.x, e.y];
    // field.ray gives up after a fixed number of steps, which cuts a ray grazing along a wall short
    // and leaves a notch in the cone: carry on from where it stopped until it really meets a wall
    const ray = (a) => {
      const dx = Math.cos(a), dy = Math.sin(a);
      let t = field.ray(e.x, e.y, dx, dy, len);
      for (let k = 0; k < 6 && t < len && field.sample(e.x + dx * t, e.y + dy * t) >= 0.35; k++) t += field.ray(e.x + dx * t, e.y + dy * t, dx, dy, len - t);
      return Math.min(t, len);
    };
    const push = (a, t) => { pts.push(e.x + Math.cos(a) * t, e.y + Math.sin(a) * t); };
    let pa = o.ang - fov, pt = ray(pa);
    push(pa, pt);
    for (let i = 1; i <= n; i++) {
      const a = o.ang - fov + 2 * fov * i / n, t = ray(a);
      if (Math.abs(t - pt) > 5) {
        // bisect to the corner: lo keeps the previous ray's reach, hi the new one's
        let lo = pa, hi = a, tl = pt, th = t;
        for (let k = 0; k < 9; k++) {
          const m = (lo + hi) / 2, tm = ray(m);
          if (Math.abs(tm - tl) < Math.abs(tm - th)) { lo = m; tl = tm; } else { hi = m; th = tm; }
        }
        push(lo, tl); push(hi, th);
      }
      push(a, t); pa = a; pt = t;
    }
    o.cone = new Float32Array(pts);
  }

  // ── caught, clear ──────────────────────────────────────────
  function caught(gd) {
    P.alive = false; mode = 'caught'; modeT = 0; stats.caught++;
    catcher = gd || null;
    // a fresh '!' every time: it pops in now and shouts again as the stamp lands (see drawBubbles)
    if (gd) { gd.state = 'chase'; gd.bubble = { k: '!', t: 0, a: 1 }; gd.ang = Math.atan2(P.y - gd.y, P.x - gd.x); }
    AUDIO.play('caught'); view.shake = 1;
    if (navigator.vibrate) try { navigator.vibrate([90, 60, 160]); } catch (e) {}
    fx.push({ k: 'flash', t: 0, dur: 0.6, red: true });
    clearStick(true); clearMouse(); clearToast(); chaseHintT = 0; dimHUD(true);
    // frame the capture: both squares, centred under the stamp, eased in over 0.4s
    const o = catcher || P;
    // on a short screen the stamp takes the top third, so the capture sits a little below the middle
    const z = baseZ() * 1.3, dy = H < 500 ? H * 0.26 : W >= 1000 ? H * 0.07 : 0;
    shot = { x0: view.x, y0: view.y, z0: view.z, x: (o.x + P.x) / 2, y: (o.y + P.y) / 2 - dy / z, z };
    // the eye goes stamp (0.65s), then the guard's '!' (1.0s), then a red ring on the player (1.2s)
    res = { k: 'caught', stage: 0, at: 0.65, stars: [], ring: 1.2 };
  }
  function clearFloor() {
    mode = 'clear'; modeT = 0; P.alive = false;
    AUDIO.play('clear');
    // a replay only ever raises a floor's stars; the climb stays where it was
    const prev = save.stars[floorN] || 0, before = starTotal();
    save.stars[floorN] = Math.max(prev, gotStars);
    if (!replay) { save.floor = floorN + 1; save.best = Math.max(save.best, floorN + 1); }
    persist();
    clearInfo = { prev, total: starTotal(), unlocked: skinsOpen(starTotal()) > skinsOpen(before) ? SKINS[skinsOpen(starTotal()) - 1] : null };
    clearStick(true); clearToast(); chaseHintT = 0; dimHUD(true);
    fx.push({ k: 'burst', x: L.exit.x, y: L.exit.y, t: 0, dur: 0.9, c: '#ffffff' });
    const z = baseZ() * 1.25, dy = H < 500 ? H * 0.34 : W >= 1000 ? H * 0.22 : H * 0.10;   // well below the stamp, its stars and pills: on a desktop the stairs sit ~65% down, inside the floor
    shot = { x0: view.x, y0: view.y, z0: view.z, x: L.exit.x, y: L.exit.y - dy / z, z };
    res = { k: 'clear', stage: 0, at: 0.75, stars: [] };
  }
  function showResult(kind) {
    const r = $('result');
    if (kind === 'caught') {
      r.innerHTML = `<div class="stamp caught">CAUGHT</div><div class="sub">Floor ${floorN} — try again</div>`;
    } else {
      // the stars land one by one after the stamp, each with a chime
      const st = [0, 1, 2].map(i => `<span class="${i < gotStars ? 'on' : ''}" style="animation-delay:${(0.35 + i * 0.18).toFixed(2)}s">★</span>`).join('');
      const ci = clearInfo || { prev: 0, total: starTotal(), unlocked: null };
      const more = replay && gotStars > ci.prev ? ` · +${gotStars - ci.prev}\u2605` : '';
      const un = ci.unlocked ? `<div class="sub unlock"><i style="background:${ci.unlocked.c}"></i>${ci.unlocked.name} unlocked</div>` : '';
      r.innerHTML = `<div class="sub above">Floor ${floorN}</div><div class="stamp clear">CLEAR</div><div class="stars">${st}</div>` +
        `<div class="sub tally">${gotStars ? `${gotStars}/3${more} · total ${ci.total}\u2605` : `No stars this time · total ${ci.total}\u2605`}</div>${un}<div class="sub foot">${replay ? 'Back to the floors…' : 'Up the stairs…'}</div>`;
      for (let i = 0; i < gotStars; i++) res.stars.push(modeT + 0.35 + i * 0.18);
    }
    r.className = 'show';
  }
  function stepResult() {
    if (!res) return;
    while (res.stars.length && modeT >= res.stars[0]) { res.stars.shift(); AUDIO.play('star'); }
    if (res.ring && modeT >= res.ring) { res.ring = 0; fx.push({ k: 'burst', x: P.x, y: P.y, t: 0, dur: 0.6, c: '#ff5a44' }); }
    if (modeT < res.at) return;
    if (res.stage === 0) { res.stage = 1; showResult(res.k); res.at = modeT + (res.k === 'caught' ? 1.25 : 2.1); return; }
    const k = res.k; res = null;
    $('result').className = 'out';
    // the retry is a quick ink fade, not a cut: the stamp fades out as the cover comes in, so it never sits over the respawn
    if (k === 'caught') wipe(() => startFloor(floorN, true), true);
    else if (replay) wipe(() => { titleScreen(); floorsScreen('title'); });   // a replayed floor goes back to the list
    else wipe(() => startFloor(floorN + 1));
  }
  function cancelResult() { res = null; catcher = null; shot = null; $('result').className = ''; }
  // the wipe runs on frame time and blocks the pause while it covers the screen
  // a floor up slides the ink across; a retry (fade) only dips to it: 0.22s in, the cut once it fully covers, 0.3s out
  function wipe(then, fade) {
    const w = $('wipe');
    if (fade) { w.className = 'fade'; void w.offsetWidth; }   // from clear ink, or the fade would have nothing to run from
    w.className = fade ? 'fade in' : 'in';
    wipeJob = { t: 0, then, done: false, fade: !!fade, cut: fade ? 0.28 : 0.52, end: fade ? 0.62 : 1.12 };
  }
  function stepWipe(dt) {
    if (!wipeJob) return;
    wipeJob.t += dt;
    if (!wipeJob.done && wipeJob.t >= wipeJob.cut) { wipeJob.done = true; const f = wipeJob.then; $('wipe').className = wipeJob.fade ? 'fade out' : 'out'; f(); }
    if (wipeJob && wipeJob.done && wipeJob.t >= wipeJob.end) { wipeJob = null; $('wipe').className = ''; }
  }
  function cancelWipe() { wipeJob = null; $('wipe').className = ''; }
  function skipIntro() { if (mode === 'intro' && modeT < 1.3) modeT = 1.3; }

  // ── hints ──────────────────────────────────────────────────
  let toastT = 0, toastId = null;
  function toast(text, dur, id) { const t = $('toast'); t.textContent = text; t.classList.add('show'); toastT = dur || 3.5; toastId = id || null; }
  function clearToast() { $('toast').classList.remove('show'); toastT = 0; toastId = null; }
  // caught / clear: the HUD and the stick step back so the stamp owns the screen
  function dimHUD(on) { $('hud').classList.toggle('dim', on); stickEl.classList.toggle('dim', on); }
  function hint(id, text) {
    if (save.hints[id] || floorN > 3) return;
    save.hints[id] = 1; persist(); toast(text, 3.4, id);
  }

  // ── the loop ───────────────────────────────────────────────
  let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 60;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000); last = now; lastDt = dt;
    fpsAcc += dt; fpsN++; if (fpsAcc > 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    readPad();
    stepWipe(dt);
    const chrome = mode === 'title' || paused;
    if (chrome !== document.body.classList.contains('chrome')) document.body.classList.toggle('chrome', chrome);
    if (!paused && L) step(dt);
    if (L) render();
  }
  function step(dt) {
    time += dt; modeT += dt;
    spottedCD -= dt; hmmCD -= dt; lockedCD -= dt;
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) clearToast(); }
    if (mode !== 'intro' || bannerT <= 0) $('hud').classList.remove('intro');
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').className = 'hide'; }
    if (chaseHintT > 0 && mode === 'play') { chaseHintT -= dt; if (chaseHintT <= 0) { chaseHintT = 0; hint('chase', 'Seen! Break their line of sight. They\'ll search where they lost you.'); } }
    stepResult();
    // the touch that skips the intro also moves: control comes as the camera starts to close in, not 0.8s later
    if (mode === 'intro' && (modeT > 2.1 || (modeT > 1.3 && readInput().m > 0))) { mode = 'play'; modeT = 0; hint('move', isTouch ? 'Drag the stick to move. Stay out of the light.' : pad ? 'Left stick to move: push it fully or hold RT to run, LT to creep. Y opens the map.' : 'Hold the mouse to move, or click to go there. Point further away to go faster. Stay out of the light.'); }
    if (mode === 'play') { updatePlayer(dt); stats.time += dt; if (knockCD > 0) knockCD = Math.max(0, knockCD - dt); }
    syncKnock();
    // a clear freezes the floor: nobody walks under the stamp or across its stars
    const live = mode === 'play' || mode === 'caught' || mode === 'title';
    if (live && !overview) { for (const gd of guards) if (!(mode === 'caught' && gd === catcher)) updateGuard(gd, dt); for (const c of cams) updateCam(c, dt); }
    // the catcher is frozen, so his '!' is aged here: updateGuard is the only other place it grows
    if (mode === 'caught' && catcher && catcher.bubble) catcher.bubble.t += dt;
    // cones only for what's near the screen
    const vw = W / view.z / 2 + 220, vh = H / view.z / 2 + 220;
    for (const gd of guards) if (Math.abs(gd.x - view.x) < vw && Math.abs(gd.y - view.y) < vh) cone(gd, D.coneLen, D.fov); else gd.cone = null;
    for (const c of cams) if (Math.abs(c.x - view.x) < vw && Math.abs(c.y - view.y) < vh) cone(c, D.coneLen * 1.05, 0.42); else c.cone = null;
    for (const f of fx) f.t += dt;
    const landed = fx.filter(f => f.k === 'fly' && f.t >= f.dur);
    fx = fx.filter(f => f.t < f.dur);
    if (landed.length) { updateHUD(); for (const f of landed) { const sp = $('hudStars').children[f.slot]; if (sp) sp.classList.add('punch'); } }
    // the climb: onto the stairs in 0.35s, shrinking to 0.6 and fading, as if gone up them
    if (mode === 'clear' && P) {
      const t = U.clamp(modeT / 0.35, 0, 1), e = U.smooth(t);
      if (!P.climb) P.climb = { x: P.x, y: P.y };
      P.x = U.lerp(P.climb.x, L.exit.x, e); P.y = U.lerp(P.climb.y, L.exit.y, e);
      P.scale = t >= 1 ? 0 : 1 - 0.4 * e; P.alpha = 1 - e;
    } else if (P) { P.climb = null; P.alpha = 1; }
    // a respawn pops the player back in (the mirror of the shrink on the stairs)
    if (popT !== null) {
      const was = popT; popT += dt;
      if (was < 0 && popT >= 0) fx.push({ k: 'burst', x: P.x, y: P.y, t: 0, dur: 0.6, c: '#e9f5f8' });
      const t = U.clamp(popT / 0.3, 0, 1); P.scale = U.easeOutBack(t);
      if (t >= 1) { P.scale = 1; popT = null; }
    }
    updateView(dt);
    // the score follows the danger (a rough estimate: in play audio.js danger() re-reads the guards itself, with
    // line of sight and facing, so the pulse means a guard that could see you, not one through a wall)
    let t = 0.05;
    if (P && P.alive) {
      for (const gd of guards) {
        const d = Math.hypot(gd.x - P.x, gd.y - P.y);
        if (gd.state === 'chase') t = Math.max(t, 1);
        else if (gd.state === 'sus') t = Math.max(t, 0.5 + gd.aw * 0.3);
        else if (gd.state === 'search') t = Math.max(t, 0.48);
        if (d < 340) t = Math.max(t, 0.14 + 0.26 * (1 - d / 340));
      }
      for (const c of cams) { if (c.alarm > 0) t = Math.max(t, 0.85); else if (c.aw > 0) t = Math.max(t, 0.5); }
    }
    if (mode === 'title') t = 0.05;
    AUDIO.tension = t;
    // the heartbeat follows the most suspicious guard or camera
    let heat = 0;
    if (mode === 'play') {
      for (const gd of guards) heat = Math.max(heat, gd.state === 'chase' ? 1 : gd.state === 'patrol' ? 0 : gd.aw || 0);
      for (const c of cams) heat = Math.max(heat, c.alarm > 0 ? 1 : c.aw || 0);
    }
    AUDIO.heat = heat;
    if (window.__dbg) $('dbg').textContent = `${fps.toFixed(0)}fps  z${view.z.toFixed(2)}  t${AUDIO.tension.toFixed(2)}  ${guards.map(g => g.state[0]).join('')}`;
  }
  function updateView(dt) {
    let tx, ty, tz, rate = 4;
    // Joe: "anchor the camera to the character" — no look-ahead, no lead that eases out on a run and settles back on a stop,
    // which slid the floor about under the cursor. Once the camera has eased onto the player it is locked to them: the
    // player sits at one fixed spot on the screen and only the floor moves, so a click lands where you aimed it.
    if (mode === 'title') { const o = titleAim(); tx = o.x + Math.sin(time * 0.05) * 30; ty = o.y + Math.cos(time * 0.04) * 20; tz = o.z; rate = 1; }
    else if ((mode === 'caught' || mode === 'clear') && shot) {
      // close in on the capture (or the stairs) on a fixed curve: easeOutCubic over 0.4s, then hold
      const t = U.clamp(modeT / 0.4, 0, 1), e = 1 - Math.pow(1 - t, 3);
      view.x = U.lerp(shot.x0, shot.x, e); view.y = U.lerp(shot.y0, shot.y, e); view.z = shot.z0 * Math.pow(shot.z / shot.z0, e);
      view.shake = Math.max(0, view.shake - dt * 2.2);
      return;
    }
    else if ((mode === 'intro' && modeT < 1.3) || overview) { const o = overviewFrame(); tx = o.x; ty = o.y; tz = o.z; rate = overview ? 5 : 3; }
    else {
      tx = P.x; ty = P.y; tz = baseZ();
      if (isPortrait() && isTouch) ty += 60 / tz;   // the stick sits at the bottom: keep the player above the middle (a fixed offset, never moving)
      else if (isTouch) tx += (save.stickSide === 'left' ? -90 : 90) / tz;   // on its side the stick sits in a corner: keep the player clear of it
      if (mode === 'play' && view.locked) { view.x = tx; view.y = ty; view.z = tz; view.shake = Math.max(0, view.shake - dt * 2.2); return; }
      if (mode === 'play') {
        // the one ease onto the player (from the map, the intro or a respawn): a fixed 0.35s easeOutCubic measured from the
        // moving player, so it lands on the anchor even mid-run and then locks. An exponential chase would trail a moving
        // player for ever and settle back after the stop
        if (!view.ease) view.ease = { dx: view.x - tx, dy: view.y - ty, z0: view.z, t: 0 };
        const es = view.ease; es.t += dt;
        const e = 1 - Math.pow(1 - Math.min(1, es.t / 0.35), 3);
        view.x = tx + es.dx * (1 - e); view.y = ty + es.dy * (1 - e); view.z = es.z0 * Math.pow(tz / es.z0, e);
        if (es.t >= 0.35) { view.locked = true; view.ease = null; }
        view.shake = Math.max(0, view.shake - dt * 2.2);
        return;
      }
      rate = 2.6;   // the intro's zoom from the map onto the player
    }
    if (mode !== 'play' || overview) { view.locked = false; view.ease = null; }
    const k = 1 - Math.exp(-dt * rate);
    view.x += (tx - view.x) * k; view.y += (ty - view.y) * k;
    view.z *= Math.pow(tz / view.z, k);
    view.shake = Math.max(0, view.shake - dt * 2.2);
  }

  // ── drawing ────────────────────────────────────────────────
  let bgGrad = null, bgKey = '', bgCv = null, fogCv = null;
  const FOG_PAD = 16;
  function shapePath(s, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    if (s.k === 'c') { g.moveTo(s.x + dx + s.r, s.y + dy); g.arc(s.x + dx, s.y + dy, s.r, 0, TAU); }
    else { g.moveTo(s.pts[0].x + dx, s.pts[0].y + dy); for (let i = 1; i < s.pts.length; i++) g.lineTo(s.pts[i].x + dx, s.pts[i].y + dy); g.closePath(); }
  }
  function polyPath(pts) { g.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y); g.closePath(); }
  // a polygon, always wound the same way round, so any number of them filled at once with 'nonzero' is their union
  function posPath(pts) {
    let A = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) A += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y);
    if (A >= 0) { polyPath(pts); return; }
    g.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    for (let i = pts.length - 2; i >= 0; i--) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
  }
  // the region any shape (concave too) sweeps when slid by (dx, dy): the shape, plus one quad per edge
  function sweepPath(s, dx, dy) {
    if (s.k === 'c' || s.pts.length <= 4) { posPath(U.sweep(s, dx, dy)); return; }
    const p = s.pts;
    posPath(p);
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      posPath([a, b, { x: b.x + dx, y: b.y + dy }, { x: a.x + dx, y: a.y + dy }]);
    }
  }
  // every caster's shadow at one reach, as one path
  // (only the casters whose shape or shadow can reach the screen: a big floor has hundreds off it)
  function castPath(k) {
    const dx = LIGHT.x * k, dy = LIGHT.y * k;
    g.beginPath();
    for (const s of L.obs) if (onView(s, dx, dy)) sweepPath(s, dx, dy);
    for (const d of L.doors) if (!d.open && onView(d.shape, dx, dy)) sweepPath(d.shape, dx, dy);
  }
  // a shape's box (kept on it), and whether that box, stretched by a shadow's (dx, dy), meets the view
  let vx0 = 0, vy0 = 0, vx1 = 0, vy1 = 0;
  function shapeBox(s) {
    if (s._bb) return s._bb;
    if (s.k === 'c') return (s._bb = { x0: s.x - s.r, y0: s.y - s.r, x1: s.x + s.r, y1: s.y + s.r });
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of s.pts) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
    return (s._bb = { x0, y0, x1, y1 });
  }
  function onView(s, dx, dy) {
    const b = shapeBox(s);
    return b.x1 + Math.max(0, dx) >= vx0 && b.x0 + Math.min(0, dx) <= vx1 && b.y1 + Math.max(0, dy) >= vy0 && b.y0 + Math.min(0, dy) <= vy1;
  }
  const toScreen = (x, y) => ({ x: (x - view.x) * view.z + W / 2, y: (y - view.y) * view.z + H / 2 });

  function render() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    // the void's vignette and the light's falloff never move on screen, so each is painted once per size
    // into its own canvas and blitted (a full-screen gradient every frame is the dearest thing in the frame)
    const key = W + 'x' + H + 'x' + DPR;
    if (key !== bgKey) {
      bgKey = key;
      bgCv = bgCv || document.createElement('canvas'); bgCv.width = cv.width; bgCv.height = cv.height;
      const b = bgCv.getContext('2d'); b.setTransform(DPR, 0, 0, DPR, 0, 0);
      bgGrad = b.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      bgGrad.addColorStop(0, '#d2e8ed'); bgGrad.addColorStop(0.55, '#a9cad3'); bgGrad.addColorStop(1, '#5f8996');
      b.fillStyle = bgGrad; b.fillRect(0, 0, W, H);
      // the light: lit most in the middle of the screen, falling off toward the corners (padded for the shake)
      fogCv = fogCv || document.createElement('canvas'); fogCv.width = cv.width + 2 * FOG_PAD * DPR; fogCv.height = cv.height + 2 * FOG_PAD * DPR;
      const f = fogCv.getContext('2d'); f.setTransform(DPR, 0, 0, DPR, FOG_PAD * DPR, FOG_PAD * DPR);
      const fg = f.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
      fg.addColorStop(0, 'rgba(24,72,90,0)'); fg.addColorStop(0.32, 'rgba(24,72,90,0)');
      fg.addColorStop(0.7, 'rgba(24,72,90,0.26)'); fg.addColorStop(1, 'rgba(24,72,90,0.56)');
      f.fillStyle = fg; f.fillRect(-FOG_PAD, -FOG_PAD, W + 2 * FOG_PAD, H + 2 * FOG_PAD);
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bgCv, 0, 0); g.setTransform(DPR, 0, 0, DPR, 0, 0);

    g.save();
    const sh = view.shake * view.shake * 9, shx = (Math.random() - 0.5) * sh, shy = (Math.random() - 0.5) * sh;
    g.translate(W / 2 + shx, H / 2 + shy);
    g.scale(view.z, view.z);
    g.translate(-view.x, -view.y);
    const z = view.z;
    // the world rect on screen (with a margin for the shake), for culling what can't be seen
    { const hw = W / 2 / z + 24, hh = H / 2 / z + 24; vx0 = view.x - hw; vx1 = view.x + hw; vy0 = view.y - hh; vy1 = view.y + hh; }

    // the floor is a raised slab: it throws the same long shadow onto the void, soft at its edge
    g.fillStyle = COL.voidShade;
    g.beginPath(); for (const s of L.floor) sweepPath(s, LIGHT.x * PEN, LIGHT.y * PEN); g.fill('nonzero');
    g.beginPath(); for (const s of L.floor) sweepPath(s, LIGHT.x * 0.75, LIGHT.y * 0.75); g.fill('nonzero');

    // the floor, and everything that lies on it, inside the floor's outline
    g.save();
    g.beginPath(); for (const s of L.floor) shapePath(s); g.clip();
    g.fillStyle = COL.deep; g.fillRect(floorBox.x0 - 50, floorBox.y0 - 50, floorBox.w + 100, floorBox.h + 100);
    // the void's edge shades the floor like a wall would: a deep core along it, then the shadow, then lit floor
    g.beginPath(); for (const s of L.floor) shapePath(s, RIM * CORE, RIM * CORE); g.fillStyle = COL.shadow; g.fill();
    g.beginPath(); for (const s of L.floor) shapePath(s, RIM, RIM); g.fillStyle = COL.floor; g.fill();
    // the walls', pillars' and doors' shadows: each tone is one swept shape filled once, so where shadows
    // overlap (or fall into the rim) they merge into one region instead of stacking into offset copies
    castPath(PEN); g.globalAlpha = 0.45; g.fillStyle = COL.shadow; g.fill('nonzero'); g.globalAlpha = 1;
    castPath(1); g.fillStyle = COL.shadow; g.fill('nonzero');
    castPath(CORE); g.fillStyle = COL.deep; g.fill('nonzero');
    drawShades(z);
    charShadows();
    drawStairs(L.entrance, false, z);
    drawStairs(L.exit, true, z);
    drawCones();
    drawItems(z);
    // walls and pillars
    g.beginPath(); for (const s of L.obs) if (onView(s, 0, 0)) shapePath(s); g.fillStyle = COL.wall; g.fill();
    drawDoors(z);
    // the light: the floor is lit most in the middle of the screen (#4596AE) and falls to about #2A6A80
    // at the corners; the walls dim with it, so the frame reads as one lit room rather than a flat plan
    // (still inside the floor's clip, which holds in device space; the restore puts the world transform back)
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(fogCv, (shx - FOG_PAD) * DPR, (shy - FOG_PAD) * DPR);
    g.restore();

    drawNoise(z);
    drawSightLines(z);
    drawMouse(z);
    drawChars(z);
    drawFx(z);
    g.restore();
    drawBubbles();
    drawFlash();
  }

  // hiding spots: a plain pool of shade, soft at its edge, so they read as places to stand
  // without adding rings, a pattern or a hue to the frame
  function drawShades(z) {
    for (const s of L.shades) {
      if (s.x + s.r < vx0 || s.x - s.r > vx1 || s.y + s.r < vy0 || s.y - s.r > vy1) continue;
      const inside = P && P.hidden && Math.hypot(P.x - s.x, P.y - s.y) < s.r;
      const pool = g.createRadialGradient(s.x, s.y, s.r * 0.5, s.x, s.y, s.r);
      pool.addColorStop(0, 'rgba(22,74,92,0.24)'); pool.addColorStop(1, 'rgba(22,74,92,0.04)');
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fillStyle = pool; g.fill();
      if (!inside) continue;
      // the pool you're in deepens a little: no ring, no dash, just more shade
      g.fillStyle = 'rgba(16,58,74,0.22)'; g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
    }
  }

  function drawStairs(p, up, z) {
    const s = 28;
    g.save(); g.translate(p.x, p.y);
    if (up) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 3);
      const gl = g.createRadialGradient(0, 0, 4, 0, 0, 30 + pulse * 5);
      gl.addColorStop(0, 'rgba(230,255,255,0.4)'); gl.addColorStop(1, 'rgba(230,255,255,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 35, 0, TAU); g.fill();
    }
    // its shadow, then the steps themselves
    g.fillStyle = up ? 'rgba(20,70,85,0.5)' : 'rgba(20,70,85,0.3)';
    g.beginPath(); posPath(U.sweep({ pts: [{ x: -s / 2, y: -s / 2 }, { x: s / 2, y: -s / 2 }, { x: s / 2, y: s / 2 }, { x: -s / 2, y: s / 2 }] }, 9, 9)); g.fill();
    g.fillStyle = up ? '#eef9fb' : 'rgba(200,230,236,0.35)';
    g.beginPath(); g.rect(-s / 2, -s / 2, s, s); g.fill();
    g.strokeStyle = up ? '#4a9db2' : 'rgba(40,110,128,0.6)'; g.lineWidth = 2;
    for (let i = 1; i < 4; i++) { const y = -s / 2 + i * s / 4; g.beginPath(); g.moveTo(-s / 2 + 3, y); g.lineTo(s / 2 - 3, y); g.stroke(); }
    if (up) {
      const b = Math.sin(time * 3) * 3;
      g.strokeStyle = '#ffffff'; g.lineWidth = 3.2; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-7, -s / 2 - 8 + b); g.lineTo(0, -s / 2 - 15 + b); g.lineTo(7, -s / 2 - 8 + b); g.stroke();
    }
    g.restore();
  }

  // a cone is a sector: the visibility polygon from the guard, so walls cut it only along straight
  // rays out of the guard (the pale walls drawn on top trim it clean), and its free edge is one arc.
  // The calm cones are one soft light: each is laid on a dark layer as a gradient from the eye to the
  // tip, keeping the brightest at every pixel ('lighten'), and the layer is screened over the floor once,
  // so a fan is plain, unstroked and fading, and two crossing fans never brighten past one.
  // A guard (or camera) in full alarm turns its cone red, drawn over the top.
  function conePath(path, p) {
    path.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) path.lineTo(p[i], p[i + 1]);
    path.closePath();
  }
  function coneLen(p) {
    let len = 0;
    for (let i = 2; i < p.length; i += 2) len = Math.max(len, Math.hypot(p[i] - p[0], p[i + 1] - p[1]));
    return len;
  }
  let coneCv = null, coneG = null;
  const CONE_RES = 0.5;
  // on a clear the guards, cameras and their light step back, so the stairs and the stamp own the frame
  const clearFade = () => mode === 'clear' ? 1 - 0.6 * U.smooth(U.clamp(modeT / 0.4, 0, 1)) : 1;
  function drawCones() {
    const fa = clearFade();
    const isHot = (o, isCam) => o.state === 'chase' || (isCam && o.alarm > 0);
    const calm = [], hot = [];
    for (const gd of guards) if (gd.cone) (isHot(gd, false) ? hot : calm).push(gd);
    for (const c of cams) if (c.cone) (isHot(c, true) ? hot : calm).push(c);
    if (calm.length) {
      if (!coneCv) { coneCv = document.createElement('canvas'); coneG = coneCv.getContext('2d'); }
      // the layer is soft light, so it is drawn at half the device resolution (a quarter of the pixels to
      // blend) and scaled up; the walls drawn on top keep the cut against them sharp
      const S = CONE_RES, lw = Math.ceil(cv.width * S), lh = Math.ceil(cv.height * S);
      if (coneCv.width !== lw || coneCv.height !== lh) { coneCv.width = lw; coneCv.height = lh; }
      // only the box the cones cover is cleared and composited
      const m = g.getTransform();
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const o of calm) for (let i = 0; i < o.cone.length; i += 2) {
        const X = m.a * o.cone[i] + m.c * o.cone[i + 1] + m.e, Y = m.b * o.cone[i] + m.d * o.cone[i + 1] + m.f;
        if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      }
      x0 = Math.max(0, Math.floor(x0 * S) - 1); y0 = Math.max(0, Math.floor(y0 * S) - 1);
      x1 = Math.min(lw, Math.ceil(x1 * S) + 1); y1 = Math.min(lh, Math.ceil(y1 * S) + 1);
      if (x1 > x0 && y1 > y0) {
        const c = coneG;
        c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over';
        c.fillStyle = '#000'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.setTransform(m.a * S, m.b * S, m.c * S, m.d * S, m.e * S, m.f * S);
        c.globalCompositeOperation = 'lighten';
        const all = new Path2D();
        for (const o of calm) {
          const p = o.cone, len = coneLen(p), path = new Path2D(); conePath(path, p); conePath(all, p);
          const gr = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], len + 1);
          gr.addColorStop(0, COL.coneNear); gr.addColorStop(0.55, COL.coneNear); gr.addColorStop(1, COL.coneFar);
          c.fillStyle = gr; c.fill(path);
        }
        // blend only where there is light: the cones' union clips the composite, so a wide view's empty box costs nothing
        g.save(); g.clip(all, 'nonzero'); g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha *= fa; g.globalCompositeOperation = 'screen';
        g.drawImage(coneCv, x0, y0, x1 - x0, y1 - y0, x0 / S, y0 / S, (x1 - x0) / S, (y1 - y0) / S);
        g.restore();
      }
    }
    g.save(); g.globalAlpha *= fa; g.lineJoin = 'round';
    for (const o of hot) {
      // alarm: a saturated red-orange that stays warm over the teal and its shadows (a pale salmon goes grey there),
      // breathing a little so it reads as live, with a hot rim so the shape holds even on the darkest floor
      const p = o.cone, len = coneLen(p), path = new Path2D(); conePath(path, p);
      const ba = g.globalAlpha;
      g.globalAlpha = ba * (0.86 + 0.14 * Math.sin(time * 6));
      g.fillStyle = COL.coneHot; g.fill(path);
      const gl = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], len * 0.55);
      gl.addColorStop(0, 'rgba(255,170,130,0.42)'); gl.addColorStop(1, 'rgba(255,120,90,0)');
      g.fillStyle = gl; g.fill(path);
      g.globalAlpha = ba;
      g.strokeStyle = COL.coneEdgeHot; g.lineWidth = 1.6; g.stroke(path);
    }
    g.restore();
  }

  function star(x, y, r, rot) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, rr = i & 1 ? r * 0.46 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath();
  }
  function drawItems(z) {
    // on a clear the pickups left behind go, so none sits by the stamp's stars and reads as one of them
    const ia = mode === 'clear' ? 1 - U.smooth(U.clamp(modeT / 0.3, 0, 1)) : 1;
    if (ia <= 0.01) return;
    g.save(); g.globalAlpha *= ia;
    for (const s of L.stars) {
      if (s.got) continue;
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.4 + s.x);
      g.fillStyle = `rgba(240,240,160,${0.1 + pulse * 0.08})`; g.beginPath(); g.arc(s.x, s.y, 9.5 + pulse, 0, TAU); g.fill();
      blob(s.x, s.y, 13);
      star(s.x, s.y, 7.5, time * 0.6); g.fillStyle = COL.star; g.fill();
    }
    for (const k of L.keys) {
      if (k.got) continue;
      const bob = Math.sin(time * 3 + k.x) * 1.5;
      blob(k.x, k.y, 13);
      g.save(); g.translate(k.x, k.y + bob); g.rotate(-0.5);
      g.fillStyle = k.color.c; g.fillRect(-7, -5, 14, 10);
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(-4, -2, 8, 2.2);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-4, 1.5, 3, 1.5);
      g.restore();
    }
    g.restore();
  }
  function drawDoors(z) {
    for (const d of L.doors) {
      let a = 1;
      if (d.open) { a = 1 - (time - d.openT) / 0.5; if (a <= 0) continue; }
      g.save(); g.globalAlpha = a;
      // a slab like the walls with the key's colour set into it: plain enough not to fight the cones
      g.beginPath(); shapePath(d.shape); g.fillStyle = COL.wall; g.fill(); g.clip();
      g.strokeStyle = d.color.c; g.lineWidth = 3.5; g.globalAlpha = a * 0.7;
      g.beginPath(); shapePath(d.shape); g.stroke();
      g.restore();
    }
  }

  // a soft capsule shadow on the floor, about twice the thing's size along the walls' shadow
  // direction: a wide faint halo under a tighter core, so it anchors without a hard edge
  const SH_DIR = (() => { const l = Math.hypot(LIGHT.x, LIGHT.y); return { x: LIGHT.x / l, y: LIGHT.y / l }; })();
  function blob(x, y, size) {
    const a = 0.3 * size, b = 1.45 * size;
    g.save(); g.lineCap = 'round'; g.strokeStyle = COL.blob;
    const a0 = g.globalAlpha;
    g.globalAlpha = a0 * 0.45; g.lineWidth = size * 1.3;
    g.beginPath(); g.moveTo(x + SH_DIR.x * a, y + SH_DIR.y * a); g.lineTo(x + SH_DIR.x * b, y + SH_DIR.y * b); g.stroke();
    g.globalAlpha = a0 * 0.75; g.lineWidth = size * 0.95;
    g.beginPath(); g.moveTo(x + SH_DIR.x * a, y + SH_DIR.y * a); g.lineTo(x + SH_DIR.x * b, y + SH_DIR.y * b); g.stroke();
    g.restore();
  }
  function charShadows() {
    g.save(); g.globalAlpha *= clearFade();   // the shadows step back with the guards on a clear
    for (const gd of guards) blob(gd.x, gd.y, G_SIZE * G_LOOK);
    for (const c of cams) blob(c.x, c.y, 18);
    g.restore();
    if (P && P.scale > 0) blob(P.x, P.y, P_SIZE * P_LOOK * P.scale);
  }
  function rsq(x, y, s, ang, r) {
    g.save(); g.translate(x, y); g.rotate(ang);
    const h = s / 2;
    g.beginPath(); g.moveTo(-h + r, -h); g.arcTo(h, -h, h, h, r); g.arcTo(h, h, -h, h, r); g.arcTo(-h, h, -h, -h, r); g.arcTo(-h, -h, h, -h, r); g.closePath();
  }
  function drawChars(z) {
    g.save(); g.globalAlpha *= clearFade();
    // cameras: a blue eye on the wall
    for (const c of cams) {
      const hot = c.alarm > 0, rgb = hot ? '255,90,70' : '150,220,236';
      const gl = g.createRadialGradient(c.x, c.y, 8, c.x, c.y, 13);
      gl.addColorStop(0, `rgba(${rgb},0.4)`); gl.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gl; g.beginPath(); g.arc(c.x, c.y, 13, 0, TAU); g.fill();
      g.fillStyle = '#0f2a4a'; g.beginPath(); g.arc(c.x, c.y, 9, 0, TAU); g.fill();
      g.strokeStyle = hot ? '#ff7a62' : '#9fdcea'; g.lineWidth = 2.4; g.beginPath(); g.arc(c.x, c.y, 8.2, 0, TAU); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(c.x, c.y, 5, 3.4, c.ang, 0, TAU); g.fill();
      g.fillStyle = '#10204a'; g.beginPath(); g.arc(c.x + Math.cos(c.ang) * 1.6, c.y + Math.sin(c.ang) * 1.6, 2.1, 0, TAU); g.fill();
    }
    for (const gd of guards) {
      // a pale rim (amber when suspicious, red on a chase) lifts the dark square off the shadows it stands in
      const gs = G_SIZE * G_LOOK;
      if (gd.state === 'chase') {
        // a chasing guard glows red, pulsing with his cone
        const gr = g.createRadialGradient(gd.x, gd.y, gs * 0.4, gd.x, gd.y, gs * 1.25);
        gr.addColorStop(0, `rgba(255,84,60,${0.45 + 0.12 * Math.sin(time * 6)})`); gr.addColorStop(1, 'rgba(255,84,60,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(gd.x, gd.y, gs * 1.25, 0, TAU); g.fill();
      }
      rsq(gd.x, gd.y, gs, gd.ang, 3);
      g.fillStyle = COL.guard; g.fill();
      g.lineWidth = Math.max(1.8, 2 / z); g.strokeStyle = gd.state === 'chase' ? '#ff6b52' : gd.state === 'sus' ? '#ffcf6a' : COL.guardRim; g.stroke();
      // the visor, and a bright notch on the front face, show which way they look
      const vc = gd.state === 'chase' ? '#ff7a62' : gd.state === 'sus' || gd.state === 'search' ? '#ffd877' : '#e4f8fd';
      g.fillStyle = vc; g.fillRect(gs / 2 - 5.5, -gs / 2 + 3, 3.5, gs - 6);
      g.beginPath(); g.moveTo(gs / 2 + 1, -4); g.lineTo(gs / 2 + 5.5, 0); g.lineTo(gs / 2 + 1, 4); g.closePath(); g.fill();
      g.restore();
    }
    g.restore();
    if (P && P.scale > 0) {
      // the one warm thing on the floor: no glow, its colour and its long shadow carry it.
      // Hidden it goes faint; seen going in, it blinks red until they lose it
      const s = P_SIZE * P_LOOK * P.scale;
      rsq(P.x, P.y, s, P.ang, 3);
      g.globalAlpha = (P.hidden ? 0.55 : 1) * (P.alpha === undefined ? 1 : P.alpha);
      g.fillStyle = P.hidden && P.exposedT > 0 && Math.sin(time * 18) > -0.3 ? '#ff5a4a' : COL.player; g.fill();
      g.lineWidth = 1.6; g.strokeStyle = COL.playerLo; g.stroke();
      g.fillStyle = COL.playerHi; g.fillRect(-s / 2 + 2.5, -s / 2 + 2.5, s - 5, 2.5);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(s / 2 - 4.5, -2, 2.5, 4);
      g.restore();
    }
  }
  // where the mouse is taking you: a dotted route to a ring, orange when it's a run, pale for a walk, small for a creep
  function drawMouse(z) {
    if (!P || !P.alive || mode !== 'play' || isTouch) return;
    const tier = (m) => m > 0.88 ? 'rgba(255,138,61,0.95)' : m > 0.6 ? 'rgba(255,214,150,0.9)' : 'rgba(225,245,250,0.85)';
    if (mouse.path && mouse.goal) {
      const col = tier(mouse.m);
      g.save(); g.setLineDash([2.5 / z * 1.6, 6 / z * 1.6]); g.lineCap = 'round'; g.strokeStyle = col; g.lineWidth = 2.2 / z * 1.2;
      g.beginPath(); g.moveTo(P.x, P.y); for (let i = mouse.pi; i < mouse.path.length; i++) g.lineTo(mouse.path[i].x, mouse.path[i].y); g.stroke(); g.restore();
      const t = time - mouse.goal.t, r = (5 + 4 * Math.exp(-t * 6)) * (0.8 + mouse.m * 0.5);
      g.strokeStyle = col; g.lineWidth = 2 / z * 1.2; g.beginPath(); g.arc(mouse.goal.x, mouse.goal.y, r, 0, TAU); g.stroke();
    } else if (mouse.steer) {
      const w = screenToWorld(mouse.sx, mouse.sy), m = reachOf(mouse.sx, mouse.sy);
      g.strokeStyle = tier(m); g.lineWidth = 2 / z * 1.2; g.beginPath(); g.arc(w.x, w.y, 4 + m * 5, 0, TAU); g.stroke();
    }
  }
  function drawNoise(z) {
    for (const f of fx) if (f.k === 'ring') {
      const t = f.t / f.dur, r = U.lerp(8, f.r, U.smooth(t));
      g.strokeStyle = `rgba(255,255,255,${0.75 * (1 - t)})`; g.lineWidth = 3 / z * 1.4;
      g.beginPath(); g.arc(f.x, f.y, r, 0, TAU); g.stroke();
      // a second, later ring: every footstep reads as sound spreading, not a single blip
      const t2 = U.clamp((t - 0.22) / 0.78, 0, 1);
      if (t2 > 0) {
        g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - t2)})`; g.lineWidth = 2 / z * 1.4;
        g.beginPath(); g.arc(f.x, f.y, U.lerp(8, f.r * 0.8, U.smooth(t2)), 0, TAU); g.stroke();
      }
    }
  }
  function drawSightLines(z) {
    if (!P || !P.alive) return;
    const line = (o, col) => {
      g.save(); g.setLineDash([5 / z * 1.2, 5 / z * 1.2]); g.lineDashOffset = -time * 30;
      g.globalAlpha = 0.45; g.strokeStyle = col; g.lineWidth = 1.2 / z * 1.2;
      g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(P.x, P.y); g.stroke(); g.restore();
    };
    for (const gd of guards) {
      if (gd.lost > 0.05) {
        // out of their sight, a suspicious guard's last look at you (or a searcher's goal) is a faint
        // mark on the floor, so you know which way they'll come and which way to break
        const q = gd.state === 'sus' ? gd.last : gd.state === 'search' && gd.scanT < 0 ? gd.target : null;
        if (q) {
          const a = gd.state === 'sus' ? 0.55 : 0.35, r = 9 + Math.sin(time * 5) * 0.8;
          g.save(); g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 1.6 / z * 1.2; g.setLineDash([3 / z * 1.2, 3 / z * 1.2]);
          g.beginPath(); g.arc(q.x, q.y, r, 0, TAU); g.stroke(); g.setLineDash([]);
          g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(q.x, q.y, 1.8, 0, TAU); g.fill(); g.restore();
        }
        continue;
      }
      if (gd.state === 'chase') line(gd, 'rgba(255,100,80,0.85)');
      else if (gd.state === 'sus') line(gd, `rgba(255,210,100,${0.4 + gd.aw * 0.5})`);
    }
    for (const c of cams) if (c.aw > 0 && sees(c, D.coneLen * 1.05, 0.42, false)) line(c, c.alarm > 0 ? 'rgba(255,100,80,0.85)' : 'rgba(255,210,100,0.75)');
  }
  function drawFx(z) {
    for (const f of fx) {
      const t = f.t / f.dur;
      if (f.k === 'burst') {
        g.strokeStyle = f.c; g.globalAlpha = 1 - t; g.lineWidth = 3 * (1 - t) + 0.5;
        g.beginPath(); g.arc(f.x, f.y, 6 + t * 34, 0, TAU); g.stroke();
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r0 = 8 + t * 20, r1 = r0 + 8 * (1 - t); g.beginPath(); g.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0); g.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1); g.stroke(); }
        g.globalAlpha = 1;
      } else if (f.k === 'puff') {
        g.strokeStyle = f.red ? `rgba(255,90,74,${0.9 * (1 - t)})` : `rgba(190,240,255,${0.7 * (1 - t)})`; g.lineWidth = f.red ? 2.2 : 1.5;
        g.beginPath(); g.arc(f.x, f.y, 8 + t * 18, 0, TAU); g.stroke();
      } else if (f.k === 'pop') {
        const s = toScreen(f.x, f.y);
        f.sx = s.x; f.sy = s.y;
      }
    }
  }
  // bubbles and meters drawn on the screen, so they read at any zoom
  function drawBubbles() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const k = U.clamp(view.z, 0.7, 1.4);
    const caughtNow = mode === 'caught';
    const one = (o, h) => {
      const b = o.bubble; if (!b) return;
      // under the CAUGHT stamp only the guard who caught you keeps his mark, and it shouts
      if (caughtNow && o !== catcher) return;
      // caught: 1.5x, with a red pulse just after the stamp lands (stamp at 0.65s + its 0.42s pop)
      const pt = modeT - 1.0, shout = caughtNow && pt > 0 ? 0.45 * Math.exp(-pt * 5) * Math.abs(Math.cos(pt * 9)) : 0;
      const big = caughtNow ? 1.5 * (1 + shout) : 1;
      const s = toScreen(o.x, o.y), pop = U.easeOutBack(U.clamp(b.t / 0.28, 0, 1)), r = Math.max(11 * k, 13, caughtNow ? Math.min(W, H) * 0.026 : 0) * pop * big;
      if (r <= 0.5) return;
      const kk = r / 11 / (pop || 1);   // glyph scale: never smaller than it reads on a phone
      // a plain glyph over the head, as in the original: white for '?', hot red for '!'
      const glyph = caughtNow ? '!' : b.k;
      // caught: the mark rides above both squares, so it never sits on the player
      const top = caughtNow && P ? Math.min(s.y, toScreen(P.x, P.y).y) : s.y;
      const x = s.x, y = top - (h + 14) * k - 12 * (kk - k), red = glyph === '!';
      g.save(); g.globalAlpha = (caughtNow ? 1 : b.a) * cf;
      // the moment a '!' goes up the guard's square flashes white for a beat (0.15s), as the original's does
      if (b.k === '!' && b.t < 0.15 && o.ang !== undefined && h === G_SIZE) {
        const gs = G_SIZE * G_LOOK * view.z;
        g.save(); g.translate(s.x, s.y); g.rotate(o.ang); g.globalAlpha = 0.9 * (1 - b.t / 0.15);
        g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect ? g.roundRect(-gs / 2 - 1, -gs / 2 - 1, gs + 2, gs + 2, 3 * view.z) : g.rect(-gs / 2 - 1, -gs / 2 - 1, gs + 2, gs + 2); g.fill();
        g.restore();
      }
      if (caughtNow) {
        // a hot red glow behind the mark, strongest on the pulse
        const gr = g.createRadialGradient(x, y, 0, x, y, 30 * kk);
        gr.addColorStop(0, `rgba(255,90,68,${0.35 + shout})`); gr.addColorStop(1, 'rgba(255,90,68,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, 30 * kk, 0, TAU); g.fill();
      }
      g.font = `800 ${Math.round(26 * kk * pop)}px "Chakra Petch", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(10,40,52,0.45)'; g.fillText(glyph, x + 2.5 * kk, y + 3 * kk);
      g.lineWidth = (caughtNow ? 2 : 3) * kk; g.strokeStyle = red ? 'rgba(120,20,10,0.9)' : 'rgba(21,54,74,0.55)'; g.strokeText(glyph, x, y);
      g.fillStyle = red ? '#ff5a44' : '#ffffff'; g.fillText(glyph, x, y);
      g.restore();
    };
    const meterCol = (o) => (o.state === 'chase' || o.alarm > 0) ? '#ff5a44' : o.aw > 0.7 ? '#ff8a3d' : '#f3e57e';
    const meter = (o) => {
      if (caughtNow || !(o.aw > 0) || o.state === 'chase' || o.alarm > 0) return;
      // a full dark track, then the fill from twelve o'clock, yellow turning orange as it nears 'seen'
      const s = toScreen(o.x, o.y), r = Math.max(15 * k, 18);
      g.lineWidth = Math.max(4, 4.5 * k); g.lineCap = 'round'; g.strokeStyle = 'rgba(18,49,63,0.5)';
      g.beginPath(); g.arc(s.x, s.y, r, 0, TAU); g.stroke();
      const t = U.clamp((o.aw - 0.5) / 0.5, 0, 1);
      g.strokeStyle = `rgb(${Math.round(U.lerp(243, 255, t))},${Math.round(U.lerp(229, 138, t))},${Math.round(U.lerp(126, 61, t))})`;
      g.beginPath(); g.arc(s.x, s.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * o.aw); g.stroke(); g.lineCap = 'butt';
    };
    // someone off screen has noticed you: a chevron on the edge points at them, in their meter's colour
    const top = safeTop + 64;
    const edge = (o) => {
      if (mode !== 'play' || overview) return;
      if (!(o.aw > 0 || o.state === 'chase' || o.state === 'search' || o.alarm > 0)) return;
      const s = toScreen(o.x, o.y), m = 24;
      if (s.x > 0 && s.x < W && s.y > top - 40 && s.y < H) return;
      const cx = W / 2, cy = (top + H) / 2, dx = s.x - cx, dy = s.y - cy;
      const hw = W / 2 - m, hh = (H - top) / 2 - m;
      const t = Math.min(Math.abs(dx) > 0.01 ? hw / Math.abs(dx) : Infinity, Math.abs(dy) > 0.01 ? hh / Math.abs(dy) : Infinity);
      const px = cx + dx * t, py = cy + dy * t, a = Math.atan2(dy, dx);
      const pulse = o.state === 'chase' || o.alarm > 0 ? 1 + 0.15 * Math.sin(time * 14) : 1;
      g.save(); g.translate(px, py); g.rotate(a); g.scale(pulse, pulse);
      g.beginPath(); g.moveTo(12, 0); g.lineTo(-6, -10); g.lineTo(-1, 0); g.lineTo(-6, 10); g.closePath();
      g.fillStyle = 'rgba(10,40,52,0.5)'; g.translate(1.5, 2); g.fill(); g.translate(-1.5, -2);
      g.fillStyle = meterCol(o); g.fill();
      g.lineWidth = 1.5; g.strokeStyle = 'rgba(21,54,74,0.7)'; g.stroke();
      g.restore();
    };
    // a clear: the guards' marks and meters fade with them, under the stamp
    const cf = clearFade(); g.save(); g.globalAlpha = cf;
    if (cf > 0.02) { for (const gd of guards) { meter(gd); one(gd, G_SIZE); edge(gd); } for (const c of cams) { meter(c); one(c, 8); edge(c); } }
    g.restore();
    for (const f of fx) if (f.k === 'fly') {
      // from where the star lay to its slot in the HUD, arcing a little, shrinking to the slot's size
      const sp = $('hudStars').children[f.slot]; if (!sp) continue;
      const rc = sp.getBoundingClientRect(), a = toScreen(f.x, f.y), t = U.clamp(f.t / f.dur, 0, 1), e = 1 - Math.pow(1 - t, 3);
      const bx = rc.left + rc.width / 2, by = rc.top + rc.height / 2;
      const x = U.lerp(a.x, bx, e), y = U.lerp(a.y, by, e) - Math.sin(t * Math.PI) * 40, sz = U.lerp(34, rc.height * 1.1, e);
      g.save(); g.font = `800 ${Math.round(sz)}px "Chakra Petch", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(243,229,126,.8)'; g.shadowBlur = 12;
      g.lineWidth = 3; g.strokeStyle = 'rgba(150,120,20,.7)'; g.strokeText('★', x, y);
      g.fillStyle = COL.star; g.fillText('★', x, y);
      g.restore();
    }
    for (const f of fx) if (f.k === 'pop' && f.sx !== undefined) {
      const t = f.t / f.dur, word = f.text.length > 2;
      if (f.pill) {
        // a key's name rides up on a chip of its colour, white on top, like the HUD's key chip: it reads on any floor
        const sc = 1 + 0.25 * (1 - U.smooth(U.clamp(f.t / 0.18, 0, 1))), y = f.sy - 26 - U.smooth(t) * 24;
        g.save(); g.globalAlpha = 1 - Math.pow(t, 3); g.translate(f.sx, y); g.scale(sc, sc);
        g.font = `800 14px "Chakra Petch", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const w = g.measureText(f.text).width + 20, h = 24;
        g.beginPath(); g.roundRect ? g.roundRect(-w / 2, -h / 2, w, h, h / 2) : g.rect(-w / 2, -h / 2, w, h);
        g.shadowColor = 'rgba(18,49,63,0.4)'; g.shadowOffsetY = 2.5; g.shadowBlur = 0;
        g.fillStyle = f.c; g.fill(); g.shadowColor = 'transparent'; g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.stroke();
        g.fillStyle = '#fff'; g.fillText(f.text, 0, 1);
        g.restore(); continue;
      }
      // a word lands like the stars' punch: 1.3x down to its size over 0.2s, in a heavy ink outline so yellow reads on pale teal
      const sc = 1 + 0.3 * (1 - U.smooth(U.clamp(f.t / 0.2, 0, 1))), y = f.sy - 22 - t * 30;
      g.save(); g.globalAlpha = 1 - t * t; g.translate(f.sx, y); g.scale(sc, sc);
      g.font = `800 ${word ? 16 : 22}px "Chakra Petch", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      if (word) { g.fillStyle = 'rgba(10,40,52,0.45)'; g.fillText(f.text, 1.5, 2.5); }
      g.lineWidth = word ? 5 : 4; g.strokeStyle = word ? 'rgba(18,49,63,0.95)' : 'rgba(15,50,62,0.8)'; g.strokeText(f.text, 0, 0);
      g.fillStyle = f.c; g.fillText(f.text, 0, 0);
      g.restore();
    }
  }
  function drawFlash() {
    for (const f of fx) if (f.k === 'flash') {
      const t = f.t / f.dur;
      // a flash reddens the rim of the screen only, so the floor keeps its teal
      const R = Math.hypot(W, H) / 2, vg = g.createRadialGradient(W / 2, H / 2, R * 0.45, W / 2, H / 2, R);
      vg.addColorStop(0, 'rgba(255,60,40,0)'); vg.addColorStop(1, f.red ? `rgba(255,60,40,${0.5 * (1 - t)})` : `rgba(255,110,70,${0.3 * (1 - t)})`);
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }
    // danger reddens the edges of the screen
    const t = AUDIO.level;   // the smoothed danger, so the red edge fades in rather than snapping on
    if (t > 0.55 && mode !== 'title') {
      const a = (t - 0.55) / 0.45 * 0.3;
      const R = Math.hypot(W, H) / 2;
      const vg = g.createRadialGradient(W / 2, H / 2, R * 0.72, W / 2, H / 2, R);
      vg.addColorStop(0, 'rgba(120,20,20,0)'); vg.addColorStop(1, `rgba(120,20,20,${a})`);
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }
  }

  // ── screens ────────────────────────────────────────────────
  // Touch or PC is decided by what's actually used, not guessed once: touchscreen laptops report touch, and so do some
  // desktop browsers. A movement key puts it in PC mode (no stick, no room left for one); a finger on the screen brings the stick back.
  let isTouch = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  function setTouch(on) {
    if (on === isTouch) return;
    isTouch = on; document.body.classList.toggle('desk', !on);
    if (!on) clearStick();
  }
  addEventListener('keydown', (e) => { if (KEYMAP[e.code]) setTouch(false); }, true);
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { setTouch(true); clearMouse(); } else if (e.pointerType === 'mouse') setTouch(false); }, true);
  function updateHUD() {
    $('floorNum').textContent = String(floorN).padStart(2, '0');
    $('floorName').textContent = floorName(floorN);
    const shown = gotStars - fx.filter(f => f.k === 'fly').length;
    $('hudStars').innerHTML = [0, 1, 2].map(i => `<span class="${i < shown ? 'on' : ''}">★</span>`).join('');
    $('hudKeys').innerHTML = (P ? P.keys : []).filter(k => !k.door.open).map(k => `<span class="key" style="background:${k.color.c}"></span>`).join('');
  }
  function showBanner(n) {
    const b = $('banner');
    if (n === null) { b.className = ''; bannerT = 0; return; }
    b.innerHTML = `<div class="bn">FLOOR ${n}</div><div class="bs">${floorName(n)}</div>`;
    b.className = 'show'; bannerT = 1.7;
  }
  function togglePause() {
    if (floorsShown()) { closeFloors(); return; }   // Esc, P or Start backs out of the list first
    if (mode === 'title' || mode === 'boot' || (wipeJob && !paused)) return;
    paused = !paused;
    $('pause').classList.toggle('show', paused); AUDIO.duck(paused);
    if (paused) {
      clearStick(); $('pFloor').textContent = `Floor ${floorN} · ${floorName(floorN)}` + (replay ? ' · replay' : ''); syncToggles();
      // this floor's stars as they stand, and the run's tally
      $('pStars').innerHTML = [0, 1, 2].map(i => `<span class="${i < gotStars ? 'on' : ''}">★</span>`).join('');
      const total = Object.entries(save.stars).reduce((a, [f, v]) => a + (+f === floorN ? 0 : v), 0) + Math.max(gotStars, save.stars[floorN] || 0);
      $('pTotal').textContent = `${total} ★ this run`;
      // the legend speaks to whatever is in your hand
      const tail = ' Dark pools hide you. Keys open doors of their colour. Three ★ on every floor.';
      $('pLegend').textContent = (pad ? 'Left stick to move: push it fully or hold RT to run, LT to creep. X knocks, Y opens the map.'
        : isTouch ? 'Push the stick gently to sneak, all the way to run (running is loud).'
        : 'Point near the player to creep, further to walk, far to run (running is loud). Click to go there. E knocks.') + tail;
    }
  }
  function toggleMap() {
    if (mode !== 'play') return;
    overview = !overview; $('mapBtn').classList.toggle('on', overview); stickEl.classList.toggle('mapdim', overview); AUDIO.play('tap');
  }
  function syncToggles() {
    // icon and state only, so the three fit one row on a 390px phone
    // stroke icons, drawn like the HUD's, not colour emoji
    const ic = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const note = '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>';
    const spk = '<path d="M4 9h4l5-4v14l-5-4H4z"/>' + (save.sound ? '<path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>' : '<path d="M17 9l5 6M22 9l-5 6"/>');
    $('optMusic').innerHTML = ic(note + (save.music ? '' : '<path d="M3 3l18 18"/>')) + (save.music ? 'On' : 'Off');
    $('optSound').innerHTML = ic(spk) + (save.sound ? 'On' : 'Off');
    $('optStick').textContent = 'Stick ' + (save.stickSide === 'left' ? 'L' : 'R');
    $('optMusic').setAttribute('aria-label', 'Music ' + (save.music ? 'on' : 'off'));
    $('optSound').setAttribute('aria-label', 'Sound ' + (save.sound ? 'on' : 'off'));
    $('optStick').setAttribute('aria-label', 'Stick on the ' + save.stickSide);
    document.body.dataset.stick = save.stickSide;
  }
  function titleScreen() {
    mode = 'title'; modeT = 0; paused = false; AUDIO.duck(false);
    cancelResult(); cancelWipe(); clearToast(); chaseHintT = 0; showBanner(null); dimHUD(false);
    $('title').classList.add('show'); $('hud').classList.add('gone'); stickEl.classList.add('gone');
    replay = false; closeFloors(true);
    const totalStars = starTotal();
    $('btnFloors').style.display = save.floor > 1 ? '' : 'none';
    $('btnPlay').textContent = save.floor > 1 ? `Continue · Floor ${save.floor}` : 'Begin';
    $('btnNew').style.display = save.floor > 1 ? '' : 'none';
    $('titleMeta').textContent = save.best > 1 ? `Highest floor ${save.best} · ${totalStars} ★` : '';
    // the attract floor: guards walking their rounds on an empty floor
    const keep = save.runSeed; save.runSeed = (Math.random() * 1e9) >>> 0;
    startFloor(3 + Math.floor(Math.random() * 4)); save.runSeed = keep;
    P.alive = false; P.scale = 0;
    const o = titleAim(); view.x = o.x; view.y = o.y; view.z = o.z;
  }
  // the attract floor sits clear of the wordmark: below the buttons when upright, to the right on its side
  function titleAim() {
    if (isPortrait()) {
      // upright: the floor hangs below the buttons, its top clear of them (with room for the drift), cut off by the bottom edge if it must be
      const bb = document.querySelector('#title .titleBtns'), rb = bb && bb.getBoundingClientRect();
      const top = rb && rb.bottom > 0 ? rb.bottom + 24 : H * 0.55;
      const z = Math.min(overviewZ() * 1.02, W * 0.94 / floorBox.w), room = H - 30 - top - 40 * z;
      const sy = floorBox.h * z < room ? top + 20 * z + (room - floorBox.h * z) / 2 : top + 20 * z;   // where the floor's top edge sits on screen
      return { x: floorBox.cx, y: floorBox.y0 + (H / 2 - sy) / z, z };
    }
    // on its side the text block is centred at ~31% of the width (see #title in index.html); the floor fills the right 44%
    // on a desktop the wordmark is wide: the floor sits a little smaller and further right, clear of its last letter
    const big = W >= 1000, z = Math.min(overviewZ(), (W * (big ? 0.40 : 0.44)) / floorBox.w, (H - 60) / floorBox.h);
    return { x: floorBox.cx - W * (big ? 0.28 : 0.25) / z, y: floorBox.cy, z };
  }
  function startGame() {
    if (floorsShown()) return;
    replay = false;
    AUDIO.unlock(); AUDIO.play('tap');
    $('title').classList.remove('show'); $('hud').classList.remove('gone'); stickEl.classList.remove('gone');
    mode = 'intro'; modeT = 0;   // the title's clock must not carry over, or the intro hands over to play (and spends the first hint) under the wipe
    wipe(() => startFloor(save.floor));
  }
  // ── the floors you've climbed: any of them again, for the stars you missed ──
  // Floors replay exactly: each is generated from the run's seed and its number (and the kinds below it).
  let floorsFrom = null;
  const floorsShown = () => $('floors').classList.contains('show');
  function floorsScreen(from) {
    floorsFrom = from;
    const total = starTotal(), open = skinsOpen(total), top = save.floor - 1;   // this building's floors, climbed and cleared
    const next = open < SKINS.length ? ` · next colour at ${open * STARS_PER_SKIN}\u2605` : '';
    $('flMeta').textContent = top ? `${total}\u2605 of ${top * 3}${next}` : `No floors cleared yet${next}`;
    let h = '';
    for (let n = 1; n <= top; n++) {
      const k = save.stars[n] || 0;
      h += `<button class="flTile${k === 3 ? ' full' : ''}" data-n="${n}" aria-label="Floor ${n}, ${floorName(n)}, ${k} of 3 stars"><b>${n}</b><span class="nm">${floorName(n)}</span><span class="st">${starStr(k)}</span></button>`;
    }
    $('flGrid').innerHTML = h || '<div class="meta flEmpty">Clear a floor to play it again here.</div>';
    $('flSkins').innerHTML = SKINS.map((sk, i) => i < open
      ? `<button class="skin${i === save.skin ? ' on' : ''}" data-i="${i}" style="--c:${sk.c};--lo:${sk.lo}" aria-label="${sk.name}"></button>`
      : `<button class="skin locked" disabled style="--c:${sk.c};--lo:${sk.lo}" aria-label="${sk.name}, ${i * STARS_PER_SKIN} stars"><span>${i * STARS_PER_SKIN}\u2605</span></button>`).join('');
    $('pause').classList.remove('show'); $('floors').classList.add('show');
    const cur = $('flGrid').querySelector(`[data-n="${Math.min(top, floorN)}"]`); if (cur && from === 'pause') cur.scrollIntoView({ block: 'nearest' });
  }
  function closeFloors(quiet) {
    if (!floorsShown()) return;
    $('floors').classList.remove('show');
    if (!quiet && floorsFrom === 'pause' && paused) $('pause').classList.add('show');
  }
  function replayFloor(n) {
    replay = true; closeFloors(true);
    paused = false; AUDIO.duck(false); $('pause').classList.remove('show');
    AUDIO.unlock(); AUDIO.play('tap');
    $('title').classList.remove('show'); $('hud').classList.remove('gone'); stickEl.classList.remove('gone');
    mode = 'intro'; modeT = 0;
    wipe(() => startFloor(n));
  }
  $('flGrid').addEventListener('click', (e) => { const b = e.target.closest('.flTile'); if (b) replayFloor(+b.dataset.n); });
  $('flSkins').addEventListener('click', (e) => {
    const b = e.target.closest('.skin'); if (!b || b.disabled) return;
    save.skin = +b.dataset.i; persist(); applySkin(); AUDIO.play('tap');
    for (const o of $('flSkins').children) o.classList.toggle('on', o === b);
  });
  $('flBack').addEventListener('click', () => { AUDIO.play('tap'); closeFloors(); });
  $('btnFloors').addEventListener('click', () => { AUDIO.unlock(); AUDIO.play('tap'); floorsScreen('title'); });
  $('optFloors').addEventListener('click', () => floorsScreen('pause'));
  $('btnPlay').addEventListener('click', startGame);
  $('btnNew').addEventListener('click', () => { save.floor = 1; save.runSeed = (Math.random() * 1e9) >>> 0; save.stars = {}; persist(); startGame(); });   // a new building's stars start from none
  // pointerdown, not click: Chromium sends click only for the primary pointer, and the thumb on the stick is that pointer
  let btnDownT = -1e9;
  $('pauseBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); btnDownT = performance.now(); AUDIO.play('tap'); togglePause(); });
  $('mapBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); btnDownT = performance.now(); toggleMap(); });
  $('knockBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); btnDownT = performance.now(); knock(); });
  $('knockBtn').addEventListener('click', (e) => { if (keyClick(e)) knock(); });
  // keyboard activation (Enter or Space on a focused button) still arrives as a click with no pointer behind it;
  // a tap's own click can too (detail 0 on some touch stacks), so a click just after a pointerdown is that tap, not a second press
  const keyClick = (e) => { e.stopPropagation(); return e.detail === 0 && performance.now() - btnDownT > 500; };
  $('pauseBtn').addEventListener('click', (e) => { if (keyClick(e)) { AUDIO.play('tap'); togglePause(); } });
  $('mapBtn').addEventListener('click', (e) => { if (keyClick(e)) toggleMap(); });
  $('optResume').addEventListener('click', togglePause);
  $('optRestart').addEventListener('click', () => { togglePause(); startFloor(floorN, true); });
  $('optMusic').addEventListener('click', () => { save.music = !save.music; AUDIO.setMusic(save.music); persist(); syncToggles(); });
  $('optSound').addEventListener('click', () => { save.sound = !save.sound; AUDIO.setMuted(!save.sound); persist(); syncToggles(); });
  $('optStick').addEventListener('click', () => { save.stickSide = save.stickSide === 'right' ? 'left' : 'right'; persist(); syncToggles(); });
  $('optQuit').addEventListener('click', () => { paused = false; AUDIO.duck(false); $('pause').classList.remove('show'); titleScreen(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { AUDIO.suspend(); if (mode === 'play' && !paused) togglePause(); }
  });
  document.addEventListener('pointerdown', () => AUDIO.unlock(), { capture: true });

  // Size from the layout viewport, not innerWidth: on iOS a pinch or double-tap zoom shrinks
  // innerWidth, and the canvas used to shrink with it and stay that way.
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = document.documentElement.clientWidth; H = document.documentElement.clientHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    safeTop = Math.max(0, (parseFloat(getComputedStyle($('hud')).paddingTop) || 10) - 10);
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 200));
  // iOS Safari ignores user-scalable=no: refuse its pinch and double-tap zooms by hand
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = performance.now();
    if (now - lastTouchEnd < 350 && !e.target.closest('button')) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  resize();
  AUDIO.setMusic(save.music); AUDIO.setMuted(!save.sound);
  syncToggles(); applySkin();
  if (!isTouch) document.body.classList.add('desk');
  titleScreen();
  requestAnimationFrame(frame);

  // for tests and the critic
  window.GAME = {
    get mode() { return mode; }, get P() { return P; }, get guards() { return guards; }, get cams() { return cams; }, get L() { return L; },
    get view() { return view; }, get fps() { return fps; }, get floor() { return floorN; }, get save() { return save; },
    startGame, startFloor: (n, retry) => { $('title').classList.remove('show'); $('hud').classList.remove('gone'); stickEl.classList.remove('gone'); mode = 'intro'; startFloor(n, retry); },
    get checkpoint() { return checkpoint; }, get modeT() { return modeT; },
    skipIntro: () => { mode = 'play'; modeT = 0; view.x = P.x; view.y = P.y; view.z = baseZ(); $('banner').className = ''; },
    setOverview: (v) => { overview = v; stickEl.classList.toggle('mapdim', !!v); }, teleport: (x, y) => {
      // debug only, but never into a wall or off the floor: snap to the nearest free spot, or stay put
      // (the field alone isn't enough: the void outside the floor's outer walls is free space to it, so the nav grid decides)
      if (!nav || !field) return false;
      // on the floor = a walkable nav cell within two cells (a spot by a wall or a shut door sits in an unwalkable cell)
      const onFloor = (px, py) => { for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const c = nav.cell(px + di * nav.C, py + dj * nav.C); if (c >= 0 && nav.walk[c]) return true; } return false; };
      let q = onFloor(x, y) ? (field.sample(x, y) >= P_R ? { x, y } : field.nearestFree(x, y, P_R + 0.5, 20)) : null;
      if (!q) { const k = nav.near(x, y); if (k < 0) return false; q = nav.center(k); }
      P.x = q.x; P.y = q.y; return true;
    },
    stick, keys, togglePause, toggleMap, replayFloor, floorsScreen, knock, get replay() { return replay; }, get knockCD() { return knockCD; }, get nav() { return nav; },
  };
})();
