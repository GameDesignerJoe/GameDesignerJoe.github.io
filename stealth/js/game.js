// UNSEEN — climb the building one floor at a time without being seen.
// The loop, the guards, the drawing and the screens. Floors come from level.js, sound from audio.js.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const cv = $('cv'), g = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  const COL = {
    floor: '#4192a8', shadow: '#2f7488', deep: '#1f5a6c', castShade: 'rgba(18,64,82,0.36)',
    wall: '#c8e0e6',
    player: '#ff8a3d', playerHi: '#ffc896', playerLo: '#b84f17',
    guard: '#15364a', guardHi: '#2b566c',
    star: '#f3e57e',
    // cones add light: the union gets coneBase, each cone adds coneNear at the guard fading to coneFar at the arc
    coneBase: 'rgb(16,15,14)', coneNear: 'rgb(30,28,27)', coneFar: 'rgb(17,16,15)', coneHot: 'rgba(255,128,104,0.46)',
  };
  // the light comes from the top left, so everything throws its shadow down and to the right
  const LIGHT = { x: 26, y: 26 }, RIM = 29;   // RIM: how deep the void's shade reaches onto the floor
  const P_SIZE = 14, P_LOOK = 1.3, P_R = 7.5, G_SIZE = 16, G_R = 8.5, CATCH = 16;
  const NAMES = ['Lobby', 'Mailroom', 'Archives', 'Canteen', 'Records', 'Atrium', 'Server Hall', 'Laboratory', 'Gallery', 'Vault Annex', 'Boardroom', 'Observatory', 'Penthouse', 'Roof Garden'];

  // ── save ───────────────────────────────────────────────────
  const SAVE_KEY = 'unseen.v1';
  let save;
  try { save = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { save = null; }
  if (!save || typeof save !== 'object') save = {};
  save = Object.assign({ floor: 1, best: 1, runSeed: (Math.random() * 1e9) >>> 0, stars: {}, hints: {}, music: true, sound: true, stickSide: 'right' }, save);
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

  // ── state ──────────────────────────────────────────────────
  let L = null, field = null, nav = null, D = null, floorN = 1;
  let P = null, guards = [], cams = [], fx = [], time = 0;
  let mode = 'boot', modeT = 0, paused = false, overview = false;
  const view = { x: 0, y: 0, z: 1, shake: 0, lead: { x: 0, y: 0 }, locked: false };
  let floorBox = null, spottedCD = 0, hmmCD = 0, lockedCD = 0, gotStars = 0;
  let stats = { caught: 0, time: 0 };
  let checkpoint = null, graceCP = false;   // graceCP: just respawned at a checkpoint, so nobody's meter fills for 1.5s   // the last door you opened on this floor: a capture after it starts you there, keys and stars kept
  // the caught and clear sequences run on game time (modeT), so a pause holds them and a quit cancels them
  let safeTop = 0, res = null, catcher = null, shot = null, wipeJob = null, bannerT = 0, chaseHintT = 0;

  // ── input ──────────────────────────────────────────────────
  const stick = { on: false, x: 0, y: 0 }, keys = {};
  const stickEl = $('stick'), knob = $('knob');
  let stickId = null, stickDownT = -1;
  // a thumb that lands out by the ring starts a quiet walk, not a run: the landing past 55% of the travel is held as an offset,
  // which melts away as the thumb comes back in, so pushing out from where it landed still reaches the ring and the run
  const stickOrg = { x: 0, y: 0, len: 0 };
  function setStick(cx, cy, down) {
    // the knob travels 68px on the 212px stick, in proportion on the smaller one, so the dashed ring (where the run starts) sits at the same place
    const b = stickEl.getBoundingClientRect(), max = b.width * 0.32;
    const rx = cx - (b.left + b.width / 2), ry = cy - (b.top + b.height / 2), rl = Math.hypot(rx, ry);
    if (down) {
      const land = 0.55 * max;
      if (rl > land) { stickOrg.x = rx - rx / rl * land; stickOrg.y = ry - ry / rl * land; } else stickOrg.x = stickOrg.y = 0;
    } else if (rl < stickOrg.len) { const f = Math.min(0.9, rl / stickOrg.len); stickOrg.x *= f; stickOrg.y *= f; }   // gone by the time the thumb is home
    stickOrg.len = rl;
    const dx = rx - stickOrg.x, dy = ry - stickOrg.y;
    const len = Math.hypot(dx, dy) || 1, k = Math.min(len, max);
    knob.style.transform = `translate(${dx / len * k}px, ${dy / len * k}px)`;
    stick.x = dx / len * k / max; stick.y = dy / len * k / max; stick.on = true;
  }
  function clearStick() { stick.on = false; stick.x = stick.y = 0; stickId = null; stickOrg.x = stickOrg.y = stickOrg.len = 0; stickEl.classList.remove('on', 'run', 'loud'); knob.style.transform = ''; }
  stickEl.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation(); AUDIO.unlock();
    if (stickId !== null) return;   // a second finger never steals the thumb's stick
    if (mode === 'intro') skipIntro();
    if (overview) toggleMap();   // like the maze: a move clears the map
    stickId = e.pointerId; stickDownT = time; stickEl.classList.add('on');
    try { stickEl.setPointerCapture(e.pointerId); } catch (err) {}
    setStick(e.clientX, e.clientY, true);
  });
  stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) setStick(e.clientX, e.clientY); });
  const endStick = (e) => { if (e.pointerId === stickId) clearStick(); };
  stickEl.addEventListener('pointerup', endStick); stickEl.addEventListener('pointercancel', endStick);
  const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyC: 'sneak', Space: 'sneak' };   // never Ctrl: Ctrl+W closes the tab
  addEventListener('keydown', (e) => {
    AUDIO.unlock();
    const k = e.code === 'Space' && (paused || (mode !== 'play' && mode !== 'intro')) ? null : KEYMAP[e.code];   // Space still presses menu buttons
    if (k) { keys[k] = true; e.preventDefault(); if (mode === 'intro' && k !== 'shift' && k !== 'sneak') skipIntro(); }
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (e.code === 'KeyM' || e.code === 'Tab') { e.preventDefault(); toggleMap(); }
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
      if (kx || ky) { const l = Math.hypot(kx, ky), s = keys.sneak ? 0.4 : 0.58; x = kx / l * s; y = ky / l * s; dz = 0; kb = true; }   // the plain walk sits under the 0.6 heard line
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
  const MOUSE_REACH = 230;   // screen px from the player to the cursor at which the push is full (the run starts at 88%, ~200px)
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
    floorN = n; clearMouse();
    cancelResult(); clearToast(); dimHUD(false);
    L = LEVEL.generate(U.hash(save.runSeed, n), n, LEVEL.history(save.runSeed, n));   // the floors below, so the shape changes as you climb
    field = L.field; D = L.D;
    for (const d of L.doors) d.open = false;
    field.applyDoors();
    nav = new LEVEL.Nav(field, 11);
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
    fx = []; gotStars = 0; overview = false; $('mapBtn').classList.remove('on');
    stats.time = 0;
    if (!retry || !checkpoint || checkpoint.floor !== n) checkpoint = null;
    else {
      const cp = checkpoint;
      L.keys.forEach((k, i) => { if (cp.keys.includes(i)) { k.got = true; P.keys.push(k); } });
      L.doors.forEach((d, i) => { if (cp.doors.includes(i)) { d.open = true; d.openT = -1e9; } });
      L.stars.forEach((st, i) => { if (cp.stars.includes(i)) { st.got = true; gotStars++; } });
      field.applyDoors(); nav = new LEVEL.Nav(field, 11);
      P.x = cp.x; P.y = cp.y; P.ang = cp.ang;
    }
    // a retry never replays the same moment: every beat starts a little along (±10% of it), every
    // camera a little into its sweep. From a checkpoint, a guard whose beat comes near starts at one of
    // the points safeSpot found it can walk from for a while without looking at you
    graceCP = !!(retry && checkpoint);
    if (retry) {
      guards.forEach((gd, gi) => {
        if (!gd.path) return;
        const N = gd.path.length, ok = checkpoint && checkpoint.starts && checkpoint.starts[gi];
        let pi = ok ? ok[Math.floor(Math.random() * ok.length)] : (gd.pi + Math.round((Math.random() * 2 - 1) * N * 0.1) + N) % N;
        // the second of a pair on one loop keeps its distance from the first rather than walking in its shoes
        const mate = ok && guards.slice(0, gi).find(o => o.path === gd.path);
        if (mate) { const gap = (i) => { const d = Math.abs(i - mate.pi) % N; return Math.min(d, N - d); }; pi = ok.reduce((b, i) => gap(i) > gap(b) ? i : b, ok[0]); if (!gap(pi)) gd.holdT = 1.6 + Math.random(); }
        gd.pi = pi; gd.x = gd.lastPos.x = gd.path[pi].x; gd.y = gd.lastPos.y = gd.path[pi].y;
        const nx = gd.path[(pi + 1) % N]; gd.ang = Math.atan2(nx.y - gd.y, nx.x - gd.x);
        if (!ok || gd.holdT) { gd.wait = gd.waitMax = gd.holdT || Math.random() * 0.8; gd.waitAng = gd.ang; gd.holdT = 0; }
      });
      for (const c of cams) c.phase += (Math.random() * 2 - 1) * 0.8;
    }
    updateHUD();
    if (mode !== 'title') {
      mode = 'intro'; modeT = retry ? 1.3 : 0;
      view.x = floorBox.cx; view.y = floorBox.cy; view.z = overviewZ();
      if (retry) { view.x = P.x; view.y = P.y; view.z = baseZ() * 0.92; }
      showBanner(retry ? null : n);
      $('hud').classList.toggle('intro', !retry);   // one clean title card: the HUD tag comes in once the banner goes
      if (!retry) AUDIO.play('floor');
    }
  }
  function overviewZ() {
    const top = 70, bottom = isPortrait() ? 40 : 30;
    return Math.min((W - 40) / floorBox.w, (H - top - bottom) / floorBox.h);
  }
  const isPortrait = () => H > W;
  // the play zoom: close, like the original (the player about 4% of the short side), but never so close a cone is cropped
  function baseZ() {
    const s = isPortrait() ? W / 340 : H / 330;
    const coneFit = Math.min(W, H) / (1.8 * (D ? D.coneLen : 160));
    return U.clamp(Math.min(s, coneFit), 0.8, 2.0);
  }

  // ── the player ─────────────────────────────────────────────
  function updatePlayer(dt) {
    const inp = readInput();
    const m = inp.m;
    if (overview) { P.vx = P.vy = P.avx = P.avy = 0; P.moving = false; stickEl.classList.remove('run'); return; }   // the map is for planning: the floor holds still
    // a quiet walk up to the dashed ring, a loud run past it; the gap between 0.8 and 0.88 stops thumb jitter flicking between them.
    // Joe: the walk wants more room before the run — the stick is 25% bigger for it and the run starts further out.
    if (inp.kb || inp.force) P.run = m > 0.9;
    else if (inp.isPad) { if (P.run ? m < 0.74 : m > 0.82) P.run = !P.run; }   // worn pad sticks rarely report a full 1.0 on a diagonal
    else if (inp.mouse) { if (P.run ? m < 0.8 : m > 0.88) P.run = !P.run; }
    else if (P.run ? m < 0.8 : m > 0.88 && time - stickDownT > 0.12) P.run = !P.run;   // never a run on the first touch
    let speed = 0;
    if (m > 0) speed = P.run ? U.lerp(110, 128, U.clamp((m - 0.8) / 0.2, 0, 1)) : 24 + 51 * Math.min(1, m / 0.85);
    P.m = m;   // only the run is heard
    stickEl.classList.toggle('run', stick.on && P.run);
    stickEl.classList.toggle('loud', stick.on && !P.run && m > 0.6);   // the heard band of the walk, before the ring
    const tvx = inp.x * speed, tvy = inp.y * speed, acc = 1 - Math.exp(-dt * 16);
    P.vx += (tvx - P.vx) * acc; P.vy += (tvy - P.vy) * acc;
    const before = { x: P.x, y: P.y };
    field.move(P, P.vx * dt, P.vy * dt, P_R);
    // a push almost straight into a wall stays put, rather than creeping sideways along a slightly tilted wall normal
    const want = Math.hypot(P.vx, P.vy) * dt;
    if (want > 0.05 && Math.hypot(P.x - before.x, P.y - before.y) < want * 0.14 && field.sample(before.x, before.y) >= P_R) { P.x = before.x; P.y = before.y; }
    // what the walls let through: the camera leads on this, and a blocked push doesn't build up speed
    const mvx = (P.x - before.x) / dt, mvy = (P.y - before.y) / dt, ak = 1 - Math.exp(-dt * 10);
    P.avx += (mvx - P.avx) * ak; P.avy += (mvy - P.avy) * ak;
    P.vx = U.lerp(P.vx, mvx, 0.5); P.vy = U.lerp(P.vy, mvy, 0.5);
    const moved = Math.hypot(P.x - before.x, P.y - before.y);
    P.moving = moved > 0.15 * dt * 60;
    if (m > 0) P.ang = U.turnTo(P.ang, Math.atan2(inp.y, inp.x), dt * 12);

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
      fx.push({ k: 'burst', x: k.x, y: k.y, t: 0, dur: 0.7, c: k.color.c }, { k: 'pop', x: k.x, y: k.y, t: 0, dur: 1.3, text: k.color.name.toUpperCase() + ' KEY', c: k.color.c });
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
      if (!good.length) { seen = true; good.push(topI); }
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
    // in a shade you are only found by someone who walks right into you
    if (P.hidden) return near && d < 12 ? { d } : null;
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
  // its rim, so hiding is a held breath, not a sure thing; the rim is past arm's reach of its middle
  function peekShade(gd) {
    gd.peeked = true;
    let sh = null, bd = 220;
    for (const s of L.shades) { const d = Math.hypot(s.x - gd.x, s.y - gd.y); if (d < bd && d > s.r + 30) { bd = d; sh = s; } }
    if (!sh) return false;
    const q = lookSpot(gd, { x: sh.x, y: sh.y });
    if (q.dive) return false;
    gd.target = q; gd.scanT = -1; gd.hurry = 0; routeTo(gd, q.x, q.y);
    if (gd.bubble) gd.bubble.a = 1;
    return true;
  }
  function bubble(o, k) { if (!o.bubble || o.bubble.k !== k) o.bubble = { k, t: 0, a: 1 }; }
  function routeTo(gd, x, y) {
    gd.route = nav.path(gd.x, gd.y, x, y, 20000); gd.ri = 0;
    if (!gd.route) gd.route = [{ x, y }];
  }
  function toSearch(gd, p, heard) {
    if (gd.state !== 'search' && gd.state !== 'chase') { if (hmmCD <= 0) { AUDIO.play('hmm'); hmmCD = 0.6; } }
    const q = lookSpot(gd, p);
    gd.state = 'search'; gd.target = q; gd.scanT = -1; gd.hurry = !!heard ? 0 : 1; gd.dive = !!q.dive; gd.peeked = false;
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
    gd.state = 'return'; gd.hurry = 0; gd.heard = false;
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
        gd.prevState = gd.state; gd.state = 'sus'; gd.susLook = gd.ang; gd.peakAw = 0;
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
          if (gd.aw > 0.6 && Math.hypot(gd.last.x - gd.x, gd.last.y - gd.y) > 30) stepToward(gd, gd.last.x, gd.last.y, 16, dt, 2.6);
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
        // the meter drops well back, so a glimpse as they search is a beat to duck away, not a re-capture
        if (!s && (done || gd.lost > 2)) { gd.aw = 0.4; toSearch(gd, gd.last || { x: gd.x, y: gd.y }); }
        break;
      }
      case 'search': {
        if (gd.scanT < 0) {
          const spd = gd.hurry ? D.chase * 0.75 : D.patrol * 1.45;
          if (follow(gd, spd, dt, 4)) { gd.scanT = 0; gd.scanBase = gd.ang; }
          // a route round a wall can still come at the pool from another side: halt at its rim and look
          else if (P.hidden && !gd.dive && L.shades.some(sh => Math.hypot(P.x - sh.x, P.y - sh.y) < sh.r && Math.hypot(gd.x - sh.x, gd.y - sh.y) < sh.r + 16)) { gd.scanT = 0; gd.scanBase = gd.ang; }
          gd.stuck = Math.hypot(gd.x - gd.lastPos.x, gd.y - gd.lastPos.y) < 0.05 ? gd.stuck + dt : 0;
          if (gd.stuck > 1.2) { gd.scanT = 0; gd.scanBase = gd.ang; gd.stuck = 0; }
        } else {
          // look around, the "?" fading as they lose interest
          gd.scanT += dt;
          const dur = 4.2;
          gd.ang = U.turnTo(gd.ang, gd.scanBase + Math.sin(gd.scanT * 1.5) * 1.5, dt * 2.8);
          if (gd.bubble) gd.bubble.a = 1 - U.clamp((gd.scanT - dur + 1.8) / 1.8, 0, 1);
          gd.aw = Math.max(0, gd.aw - dt * 0.25);
          if (gd.scanT > dur && gd.peek && !gd.peeked && peekShade(gd)) break;
          if (gd.scanT > dur) { gd.bubble = null; gd.aw = 0; AUDIO.play('lost'); toReturn(gd); }
        }
        break;
      }
      case 'return': {
        if (follow(gd, D.patrol, dt, 3.2)) {
          gd.state = 'patrol'; gd.route = null;
          if (gd.kind === 'sentry') gd.sweep = 0;
        }
        gd.stuck = Math.hypot(gd.x - gd.lastPos.x, gd.y - gd.lastPos.y) < 0.05 ? gd.stuck + dt : 0;
        if (gd.stuck > 1.5) { gd.stuck = 0; toReturn(gd); }
        break;
      }
    }
    gd.lastPos.x = gd.x; gd.lastPos.y = gd.y;
    if (P.alive && mode === 'play' && Math.hypot(gd.x - P.x, gd.y - P.y) < CATCH) caught(gd);
  }

  function updateCam(c, dt) {
    if (c.bubble) c.bubble.t += dt;
    const s = sees(c, D.coneLen * 1.05, 0.42, false);
    if (c.alarm > 0) {
      c.alarm -= dt;
      if (s) c.ang = U.turnTo(c.ang, Math.atan2(P.y - c.y, P.x - c.x), dt * 2);
      if (c.alarm <= 0) { c.aw = 0; c.bubble = null; }
      return;
    }
    if (s && !(graceCP && mode === 'play' && modeT < 1.5)) {
      c.ang = U.turnTo(c.ang, Math.atan2(P.y - c.y, P.x - c.x), dt * 1.2);
      c.aw = Math.min(1, c.aw + dt * D.detect * 0.9);
      if (!c.bubble) { bubble(c, '?'); if (hmmCD <= 0) { AUDIO.play('hmm'); hmmCD = 0.5; } }
      if (c.aw >= 1) {
        // the alarm: the nearest guards come running to where you were
        c.alarm = 4; bubble(c, '!'); AUDIO.play('alarm');
        fx.push({ k: 'flash', t: 0, dur: 0.3 });
        guards.filter(o => o.state !== 'chase').map(o => ({ o, d: Math.hypot(o.x - c.x, o.y - c.y) })).filter(e => e.d < 750)
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
    const ray = (a) => field.ray(e.x, e.y, Math.cos(a), Math.sin(a), len);
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
    clearStick(); clearMouse(); clearToast(); chaseHintT = 0; dimHUD(true);
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
    const prev = save.stars[floorN] || 0;
    save.stars[floorN] = Math.max(prev, gotStars);
    save.floor = floorN + 1; save.best = Math.max(save.best, floorN + 1);
    persist();
    clearStick(); clearToast(); chaseHintT = 0; dimHUD(true);
    fx.push({ k: 'burst', x: L.exit.x, y: L.exit.y, t: 0, dur: 0.9, c: '#ffffff' });
    const z = baseZ() * 1.25, dy = H < 500 ? H * 0.22 : W >= 1000 ? H * 0.18 : H * 0.06;   // below the stamp, its stars and the 'Up the stairs' line
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
      r.innerHTML = `<div class="sub above">Floor ${floorN}</div><div class="stamp clear">CLEAR</div><div class="stars">${st}</div><div class="sub foot">Up the stairs…</div>`;
      for (let i = 0; i < gotStars; i++) res.stars.push(modeT + 0.35 + i * 0.18);
    }
    r.className = 'show';
  }
  function stepResult() {
    if (!res) return;
    while (res.stars.length && modeT >= res.stars[0]) { res.stars.shift(); AUDIO.play('star'); }
    if (res.ring && modeT >= res.ring) { res.ring = 0; fx.push({ k: 'burst', x: P.x, y: P.y, t: 0, dur: 0.6, c: '#ff5a44' }); }
    if (modeT < res.at) return;
    if (res.stage === 0) { res.stage = 1; showResult(res.k); res.at = modeT + (res.k === 'caught' ? 1.5 : 2.1); return; }
    const k = res.k; res = null;
    $('result').className = '';
    if (k === 'caught') startFloor(floorN, true);
    else wipe(() => startFloor(floorN + 1));
  }
  function cancelResult() { res = null; catcher = null; shot = null; $('result').className = ''; }
  // the wipe runs on frame time and blocks the pause while it covers the screen
  function wipe(then) { $('wipe').className = 'in'; wipeJob = { t: 0, then, done: false }; }
  function stepWipe(dt) {
    if (!wipeJob) return;
    wipeJob.t += dt;
    if (!wipeJob.done && wipeJob.t >= 0.52) { wipeJob.done = true; const f = wipeJob.then; $('wipe').className = 'out'; f(); }
    if (wipeJob && wipeJob.done && wipeJob.t >= 1.12) { wipeJob = null; $('wipe').className = ''; }
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
    if (mode === 'intro' && (modeT > 2.1 || (modeT > 1.3 && readInput().m > 0))) { mode = 'play'; modeT = 0; hint('move', isTouch ? 'Drag the stick to move. Stay out of the light.' : 'Hold the mouse to move, or click to go there. Point further away to go faster. Stay out of the light.'); }
    if (mode === 'play') { updatePlayer(dt); stats.time += dt; }
    const live = mode === 'play' || mode === 'caught' || mode === 'title' || mode === 'clear';
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
    if (mode === 'clear') P.scale = Math.max(0, 1 - U.smooth(U.clamp(modeT / 0.5, 0, 1)));
    updateView(dt);
    // the score follows the danger
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
    if (mode === 'title') { tx = floorBox.cx + Math.sin(time * 0.05) * 30; ty = floorBox.cy + Math.cos(time * 0.04) * 20; tz = overviewZ() * 1.02; rate = 1; }
    else if ((mode === 'caught' || mode === 'clear') && shot) {
      // close in on the capture (or the stairs) on a fixed curve: easeOutCubic over 0.4s, then hold
      const t = U.clamp(modeT / 0.4, 0, 1), e = 1 - Math.pow(1 - t, 3);
      view.x = U.lerp(shot.x0, shot.x, e); view.y = U.lerp(shot.y0, shot.y, e); view.z = shot.z0 * Math.pow(shot.z / shot.z0, e);
      view.shake = Math.max(0, view.shake - dt * 2.2);
      return;
    }
    else if ((mode === 'intro' && modeT < 1.3) || overview) { tx = floorBox.cx; ty = floorBox.cy + (isPortrait() ? 0 : 0); tz = overviewZ(); rate = overview ? 5 : 3; }
    else {
      tx = P.x; ty = P.y; tz = baseZ();
      if (isPortrait() && isTouch) ty += 90 / tz;   // the stick sits at the bottom: keep the player above the middle (a fixed offset, never moving)
      else if (isTouch) tx += (save.stickSide === 'left' ? -90 : 90) / tz;   // on its side the stick sits in a corner: keep the player clear of it
      if (mode === 'play' && view.locked) { view.x = tx; view.y = ty; view.z = tz; view.shake = Math.max(0, view.shake - dt * 2.2); return; }
      rate = mode === 'intro' ? 2.6 : 6;   // the one ease: from the map, the intro or a respawn onto the player, then the lock
      if (mode === 'play' && Math.hypot(tx - view.x, ty - view.y) * view.z < 1.5 && Math.abs(tz / view.z - 1) < 0.01) view.locked = true;
    }
    if (mode !== 'play' || overview) view.locked = false;
    const k = 1 - Math.exp(-dt * rate);
    view.x += (tx - view.x) * k; view.y += (ty - view.y) * k;
    view.z *= Math.pow(tz / view.z, k);
    view.shake = Math.max(0, view.shake - dt * 2.2);
  }

  // ── drawing ────────────────────────────────────────────────
  let bgGrad = null, bgKey = '';
  function shapePath(s, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    if (s.k === 'c') { g.moveTo(s.x + dx + s.r, s.y + dy); g.arc(s.x + dx, s.y + dy, s.r, 0, TAU); }
    else { g.moveTo(s.pts[0].x + dx, s.pts[0].y + dy); for (let i = 1; i < s.pts.length; i++) g.lineTo(s.pts[i].x + dx, s.pts[i].y + dy); g.closePath(); }
  }
  function polyPath(pts) { g.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y); g.closePath(); }
  const toScreen = (x, y) => ({ x: (x - view.x) * view.z + W / 2, y: (y - view.y) * view.z + H / 2 });

  function render() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const key = W + 'x' + H;
    if (key !== bgKey) {
      bgKey = key;
      bgGrad = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      bgGrad.addColorStop(0, '#d2e8ed'); bgGrad.addColorStop(0.55, '#a9cad3'); bgGrad.addColorStop(1, '#5f8996');
    }
    g.fillStyle = bgGrad; g.fillRect(0, 0, W, H);

    g.save();
    const sh = view.shake * view.shake * 9;
    g.translate(W / 2 + (Math.random() - 0.5) * sh, H / 2 + (Math.random() - 0.5) * sh);
    g.scale(view.z, view.z);
    g.translate(-view.x, -view.y);
    const z = view.z;

    // the floor, and everything that lies on it, inside the floor's outline
    g.save();
    g.beginPath(); for (const s of L.floor) shapePath(s); g.clip();
    g.fillStyle = COL.shadow; g.fillRect(floorBox.x0 - 50, floorBox.y0 - 50, floorBox.w + 100, floorBox.h + 100);
    // the floor is lit where the void beside it doesn't shade it
    g.beginPath(); for (const s of L.floor) shapePath(s, RIM, RIM); g.fillStyle = COL.floor; g.fill();
    // a soft pool of light toward the middle of the building
    const fg = g.createRadialGradient(floorBox.cx, floorBox.cy, 0, floorBox.cx, floorBox.cy, Math.max(floorBox.w, floorBox.h) * 0.6);
    fg.addColorStop(0, 'rgba(255,255,255,0.07)'); fg.addColorStop(1, 'rgba(0,30,40,0.06)');
    g.fillStyle = fg; g.fillRect(floorBox.x0, floorBox.y0, floorBox.w, floorBox.h);
    drawShades(z);
    // walls' and pillars' shadows: one tone on the lit floor, a deeper one where they fall into the
    // ring the void already shades, so the floor reads in layers
    g.beginPath();
    // one light, one length: walls, pillars, doors and characters all throw the same 45-degree shadow
    for (const s of L.obs) polyPath(U.sweep(s, LIGHT.x, LIGHT.y));
    for (const d of L.doors) if (!d.open) polyPath(U.sweep(d.shape, LIGHT.x, LIGHT.y));
    g.fillStyle = COL.castShade; g.fill();
    drawStairs(L.entrance, false, z);
    drawStairs(L.exit, true, z);
    drawCones();
    drawItems(z);
    drawCharShadows();
    // walls and pillars
    g.beginPath(); for (const s of L.obs) shapePath(s); g.fillStyle = COL.wall; g.fill();
    drawDoors(z);
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

  // hiding spots: a faint pool of shade inside a crisp pale ring, with a few soft hatch lines, so
  // it reads as a deliberate place to stand rather than a hole in the floor
  function drawShades(z) {
    for (const s of L.shades) {
      const inside = P && P.hidden && Math.hypot(P.x - s.x, P.y - s.y) < s.r;
      g.save();
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fillStyle = 'rgba(18,64,82,0.2)'; g.fill(); g.clip();
      g.strokeStyle = 'rgba(200,236,244,0.08)'; g.lineWidth = 2; g.beginPath();
      for (let i = -s.r * 2; i <= s.r * 2; i += 9) { g.moveTo(s.x + i - s.r, s.y - s.r); g.lineTo(s.x + i + s.r, s.y + s.r); }
      g.stroke(); g.restore();
      g.strokeStyle = inside ? 'rgba(190,240,255,0.85)' : 'rgba(205,236,244,0.42)'; g.lineWidth = 1.8;
      if (inside) { g.setLineDash([4, 4]); g.lineDashOffset = time * 10; }
      g.beginPath(); g.arc(s.x, s.y, s.r - 1, 0, TAU); g.stroke(); g.setLineDash([]);
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
    g.beginPath(); g.rect(-s / 2 + 4, -s / 2 + 5, s, s); g.fill();
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

  // a cone is light falling on the floor, not a decal over it: it is added to what is already there
  // ('lighter'), so the floor's shading and the shadows the walls cast still read through it, and
  // the walls, drawn after, cut it off at their edge. One pass lights the union of every calm cone
  // evenly; a second adds each cone on its own, brightest at the guard and fading toward the arc,
  // so a single cone lands at about #6BB8CC and ground two cones watch builds toward #7CC8DC.
  // Only a guard (or camera) in full alarm turns its cone red.
  function conePath(path, p) {
    path.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) path.lineTo(p[i], p[i + 1]);
    path.closePath();
  }
  function drawCones() {
    const calm = new Path2D(), hot = new Path2D(), each = [];
    let nh = 0;
    const add = (o, len, isCam) => {
      const p = o.cone; if (!p) return;
      if (o.state === 'chase' || (isCam && o.alarm > 0)) { conePath(hot, p); nh++; return; }
      const one = new Path2D(); conePath(one, p); conePath(calm, p);
      each.push({ path: one, x: p[0], y: p[1], len });
    };
    for (const gd of guards) add(gd, D.coneLen, false);
    for (const c of cams) add(c, D.coneLen * 1.05, true);
    g.save(); g.globalCompositeOperation = 'lighter';
    if (each.length) {
      g.fillStyle = COL.coneBase; g.fill(calm, 'nonzero');
      for (const c of each) {
        const gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.len);
        gr.addColorStop(0, COL.coneNear); gr.addColorStop(1, COL.coneFar);
        g.fillStyle = gr; g.fill(c.path);
      }
    }
    g.restore();
    if (nh) { g.fillStyle = COL.coneHot; g.fill(hot, 'nonzero'); }
  }

  function star(x, y, r, rot) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, rr = i & 1 ? r * 0.46 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath();
  }
  function drawItems(z) {
    for (const s of L.stars) {
      if (s.got) continue;
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.4 + s.x);
      g.fillStyle = `rgba(240,240,160,${0.1 + pulse * 0.08})`; g.beginPath(); g.arc(s.x, s.y, 9.5 + pulse, 0, TAU); g.fill();
      star(s.x + 1.5, s.y + 2, 7.5, time * 0.6); g.fillStyle = 'rgba(20,70,85,0.45)'; g.fill();
      star(s.x, s.y, 7.5, time * 0.6); g.fillStyle = COL.star; g.fill();
    }
    for (const k of L.keys) {
      if (k.got) continue;
      const bob = Math.sin(time * 3 + k.x) * 1.5;
      g.fillStyle = k.color.c + '33'; g.beginPath(); g.arc(k.x, k.y, 10.5, 0, TAU); g.fill();
      g.save(); g.translate(k.x, k.y + bob); g.rotate(-0.5);
      g.fillStyle = 'rgba(20,60,75,0.5)'; g.fillRect(-7 + 2, -5 + 3, 14, 10);
      g.fillStyle = k.color.c; g.fillRect(-7, -5, 14, 10);
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(-4, -2, 8, 2.2);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-4, 1.5, 3, 1.5);
      g.restore();
    }
  }
  function drawDoors(z) {
    for (const d of L.doors) {
      let a = 1;
      if (d.open) { a = 1 - (time - d.openT) / 0.5; if (a <= 0) continue; }
      g.save(); g.globalAlpha = a;
      g.beginPath(); shapePath(d.shape); g.fillStyle = '#1a2a33'; g.fill(); g.clip();
      const c = U.centroid(d.shape);
      g.strokeStyle = d.color.c; g.lineWidth = 3.4;
      g.beginPath();
      for (let i = -50; i <= 50; i += 8) { g.moveTo(c.x + i - 20, c.y - 20); g.lineTo(c.x + i + 20, c.y + 20); }
      g.stroke();
      g.restore();
    }
  }

  function charSweep(x, y, ang, size, k) {
    const s = U.rect(x, y, size, size, ang);
    polyPath(U.sweep(s, LIGHT.x * k, LIGHT.y * k));
  }
  function drawCharShadows() {
    // the guards' shadows are lighter than the player's, so the player is the one shape that stands out
    g.fillStyle = 'rgba(16,62,78,0.3)';
    g.beginPath();
    for (const gd of guards) charSweep(gd.x, gd.y, gd.ang, G_SIZE, 1);
    g.fill();
    if (P && P.scale > 0) { g.fillStyle = 'rgba(16,62,78,0.55)'; g.beginPath(); charSweep(P.x, P.y, P.ang, P_SIZE * P_LOOK * P.scale, 1); g.fill(); }
  }
  function rsq(x, y, s, ang, r) {
    g.save(); g.translate(x, y); g.rotate(ang);
    const h = s / 2;
    g.beginPath(); g.moveTo(-h + r, -h); g.arcTo(h, -h, h, h, r); g.arcTo(h, h, -h, h, r); g.arcTo(-h, h, -h, -h, r); g.arcTo(-h, -h, h, -h, r); g.closePath();
  }
  function drawChars(z) {
    // cameras: a blue eye on the wall
    for (const c of cams) {
      const hot = c.alarm > 0, rgb = hot ? '255,90,70' : '90,170,255';
      const gl = g.createRadialGradient(c.x, c.y, 8, c.x, c.y, 13);
      gl.addColorStop(0, `rgba(${rgb},0.4)`); gl.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gl; g.beginPath(); g.arc(c.x, c.y, 13, 0, TAU); g.fill();
      g.fillStyle = '#0f2a4a'; g.beginPath(); g.arc(c.x, c.y, 9, 0, TAU); g.fill();
      g.strokeStyle = hot ? '#ff7a62' : '#6cc4ff'; g.lineWidth = 2.4; g.beginPath(); g.arc(c.x, c.y, 8.2, 0, TAU); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(c.x, c.y, 5, 3.4, c.ang, 0, TAU); g.fill();
      g.fillStyle = '#10204a'; g.beginPath(); g.arc(c.x + Math.cos(c.ang) * 1.6, c.y + Math.sin(c.ang) * 1.6, 2.1, 0, TAU); g.fill();
    }
    for (const gd of guards) {
      rsq(gd.x, gd.y, G_SIZE, gd.ang, 3);
      g.fillStyle = COL.guard; g.fill();
      g.lineWidth = 1.5; g.strokeStyle = gd.state === 'chase' ? '#ff6b52' : gd.state === 'sus' ? '#ffcf6a' : COL.guardHi; g.stroke();
      // the visor shows which way they face
      const vc = gd.state === 'chase' ? '#ff7a62' : gd.state === 'sus' || gd.state === 'search' ? '#ffd877' : '#bdf0ff';
      g.fillStyle = vc; g.fillRect(G_SIZE / 2 - 4.5, -G_SIZE / 2 + 3, 3, G_SIZE - 6);
      g.restore();
    }
    if (P && P.scale > 0) {
      // drawn larger than its footprint, with a warm glow: the brightest, warmest thing on the floor
      const s = P_SIZE * P_LOOK * P.scale;
      if (!P.hidden) {
        const gl = g.createRadialGradient(P.x, P.y, s * 0.4, P.x, P.y, s * 1.0);
        gl.addColorStop(0, 'rgba(255,170,90,0.4)'); gl.addColorStop(1, 'rgba(255,170,90,0)');
        g.fillStyle = gl; g.beginPath(); g.arc(P.x, P.y, s * 1.0, 0, TAU); g.fill();
      }
      rsq(P.x, P.y, s, P.ang, 3);
      g.globalAlpha = P.hidden ? 0.55 : 1;
      g.fillStyle = COL.player; g.fill();
      g.lineWidth = 1.6; g.strokeStyle = COL.playerLo; g.stroke();
      g.fillStyle = COL.playerHi; g.fillRect(-s / 2 + 2.5, -s / 2 + 2.5, s - 5, 2.5);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(s / 2 - 4.5, -2, 2.5, 4);
      if (P.hidden) { g.globalAlpha = 1; g.setLineDash([3, 3]); g.lineDashOffset = -time * 12; g.strokeStyle = P.exposedT > 0 && Math.sin(time * 18) > -0.3 ? '#ff5a4a' : '#bff0ff'; g.lineWidth = 1.4; g.strokeRect(-s / 2 - 3, -s / 2 - 3, s + 6, s + 6); g.setLineDash([]); }
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
      g.strokeStyle = col; g.lineWidth = 1.6 / z * 1.2;
      g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(P.x, P.y); g.stroke(); g.restore();
    };
    for (const gd of guards) {
      if (gd.lost > 0.05) continue;
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
      g.save(); g.globalAlpha = caughtNow ? 1 : b.a;
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
    const meterCol = (o) => (o.state === 'chase' || o.alarm > 0) ? '#ff5a44' : o.aw > 0.7 ? '#ff8c4a' : '#ffd36a';
    const meter = (o) => {
      if (caughtNow || !(o.aw > 0) || o.state === 'chase' || o.alarm > 0) return;
      const s = toScreen(o.x, o.y), r = Math.max(15 * k, 18);
      g.lineWidth = Math.max(3 * k, 3.5); g.strokeStyle = 'rgba(10,40,52,0.45)';
      g.beginPath(); g.arc(s.x, s.y, r, 0, TAU); g.stroke();
      g.strokeStyle = meterCol(o);
      g.beginPath(); g.arc(s.x, s.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * o.aw); g.stroke();
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
    for (const gd of guards) { meter(gd); one(gd, G_SIZE); edge(gd); }
    for (const c of cams) { meter(c); one(c, 8); edge(c); }
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
      const t = f.t / f.dur;
      g.save(); g.globalAlpha = 1 - t * t;
      g.font = `800 ${f.text.length > 2 ? 13 : 22}px "Chakra Petch", system-ui, sans-serif`; g.textAlign = 'center';
      g.lineWidth = 4; g.strokeStyle = 'rgba(15,50,62,0.8)'; g.strokeText(f.text, f.sx, f.sy - 20 - t * 30);
      g.fillStyle = f.c; g.fillText(f.text, f.sx, f.sy - 20 - t * 30);
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
    const t = AUDIO.tension;
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
    $('floorName').textContent = NAMES[(floorN - 1) % NAMES.length];
    const shown = gotStars - fx.filter(f => f.k === 'fly').length;
    $('hudStars').innerHTML = [0, 1, 2].map(i => `<span class="${i < shown ? 'on' : ''}">★</span>`).join('');
    $('hudKeys').innerHTML = (P ? P.keys : []).filter(k => !k.door.open).map(k => `<span class="key" style="background:${k.color.c}"></span>`).join('');
  }
  function showBanner(n) {
    const b = $('banner');
    if (n === null) { b.className = ''; bannerT = 0; return; }
    b.innerHTML = `<div class="bn">FLOOR ${n}</div><div class="bs">${NAMES[(n - 1) % NAMES.length]}</div>`;
    b.className = 'show'; bannerT = 1.7;
  }
  function togglePause() {
    if (mode === 'title' || mode === 'boot' || (wipeJob && !paused)) return;
    paused = !paused;
    $('pause').classList.toggle('show', paused); AUDIO.duck(paused);
    if (paused) {
      clearStick(); $('pFloor').textContent = `Floor ${floorN} · ${NAMES[(floorN - 1) % NAMES.length]}`; syncToggles();
      // this floor's stars as they stand, and the run's tally
      $('pStars').innerHTML = [0, 1, 2].map(i => `<span class="${i < gotStars ? 'on' : ''}">★</span>`).join('');
      const total = Object.entries(save.stars).reduce((a, [f, v]) => a + (+f === floorN ? 0 : v), 0) + Math.max(gotStars, save.stars[floorN] || 0);
      $('pTotal').textContent = `${total} ★ this run`;
    }
  }
  function toggleMap() {
    if (mode !== 'play') return;
    overview = !overview; $('mapBtn').classList.toggle('on', overview); AUDIO.play('tap');
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
    const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);
    $('btnPlay').textContent = save.floor > 1 ? `Continue · Floor ${save.floor}` : 'Begin';
    $('btnNew').style.display = save.floor > 1 ? '' : 'none';
    $('titleMeta').textContent = save.best > 1 ? `Highest floor ${save.best} · ${totalStars} ★` : '';
    // the attract floor: guards walking their rounds on an empty floor
    const keep = save.runSeed; save.runSeed = (Math.random() * 1e9) >>> 0;
    startFloor(3 + Math.floor(Math.random() * 4)); save.runSeed = keep;
    P.alive = false; P.scale = 0;
    view.x = floorBox.cx; view.y = floorBox.cy; view.z = overviewZ();
  }
  function startGame() {
    AUDIO.unlock(); AUDIO.play('tap');
    $('title').classList.remove('show'); $('hud').classList.remove('gone'); stickEl.classList.remove('gone');
    mode = 'intro';
    wipe(() => startFloor(save.floor));
  }
  $('btnPlay').addEventListener('click', startGame);
  $('btnNew').addEventListener('click', () => { save.floor = 1; save.runSeed = (Math.random() * 1e9) >>> 0; save.stars = {}; persist(); startGame(); });   // a new building's stars start from none
  // pointerdown, not click: Chromium sends click only for the primary pointer, and the thumb on the stick is that pointer
  let btnDownT = -1e9;
  $('pauseBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); btnDownT = performance.now(); AUDIO.play('tap'); togglePause(); });
  $('mapBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); btnDownT = performance.now(); toggleMap(); });
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
  syncToggles();
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
    setOverview: (v) => { overview = v; }, teleport: (x, y) => { P.x = x; P.y = y; },
    stick, keys, togglePause, toggleMap,
  };
})();
