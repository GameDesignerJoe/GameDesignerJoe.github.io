// UNSEEN — climb the building one floor at a time without being seen.
// The loop, the guards, the drawing and the screens. Floors come from level.js, sound from audio.js.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const cv = $('cv'), g = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  const COL = {
    floor: '#3f8fa4', shadow: '#2e788d', deep: '#1f5a6c',
    wall: '#c8e0e6',
    player: '#ff8a3d', playerHi: '#ffc896', playerLo: '#b84f17',
    guard: '#15364a', guardHi: '#2b566c',
    star: '#f3e57e',
  };
  // the light comes from the top left, so everything throws its shadow down and to the right
  const LIGHT = { x: 17, y: 21 };
  const P_SIZE = 14, P_R = 7.5, G_SIZE = 16, G_R = 8.5, CATCH = 16;
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
  const view = { x: 0, y: 0, z: 1, shake: 0 };
  let floorBox = null, spottedCD = 0, hmmCD = 0, lockedCD = 0, gotStars = 0;
  let stats = { caught: 0, time: 0 };

  // ── input ──────────────────────────────────────────────────
  const stick = { on: false, x: 0, y: 0 }, keys = {};
  const stickEl = $('stick'), knob = $('knob');
  const KNOB_MAX = 54; let stickId = null;
  function setStick(cx, cy) {
    const b = stickEl.getBoundingClientRect();
    const dx = cx - (b.left + b.width / 2), dy = cy - (b.top + b.height / 2);
    const len = Math.hypot(dx, dy) || 1, k = Math.min(len, KNOB_MAX);
    knob.style.transform = `translate(${dx / len * k}px, ${dy / len * k}px)`;
    stick.x = dx / len * k / KNOB_MAX; stick.y = dy / len * k / KNOB_MAX; stick.on = true;
  }
  function clearStick() { stick.on = false; stick.x = stick.y = 0; stickId = null; stickEl.classList.remove('on', 'run'); knob.style.transform = ''; }
  stickEl.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation(); AUDIO.unlock();
    if (mode === 'intro') skipIntro();
    stickId = e.pointerId; stickEl.classList.add('on');
    try { stickEl.setPointerCapture(e.pointerId); } catch (err) {}
    setStick(e.clientX, e.clientY);
  });
  stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) setStick(e.clientX, e.clientY); });
  stickEl.addEventListener('pointerup', clearStick); stickEl.addEventListener('pointercancel', clearStick);
  const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'shift', ShiftRight: 'shift' };
  addEventListener('keydown', (e) => {
    AUDIO.unlock();
    const k = KEYMAP[e.code];
    if (k) { keys[k] = true; e.preventDefault(); if (mode === 'intro' && k !== 'shift') skipIntro(); }
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (e.code === 'KeyM' || e.code === 'Tab') { e.preventDefault(); toggleMap(); }
    if ((e.code === 'Enter' || e.code === 'Space') && mode === 'title') startGame();
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; clearStick(); });
  let padStart = false;
  function readPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const st = p.buttons[9] && p.buttons[9].pressed;
      if (st && !padStart) { if (mode === 'title') startGame(); else togglePause(); }
      padStart = st;
      const x = p.axes[0] || 0, y = p.axes[1] || 0;
      if (Math.hypot(x, y) > 0.15) return { x, y };
    }
    return null;
  }
  function readInput() {
    let x = 0, y = 0;
    const pad = readPad();
    if (stick.on) { x = stick.x; y = stick.y; }
    else if (pad) { x = pad.x; y = pad.y; }
    else {
      const kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), ky = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (kx || ky) { const l = Math.hypot(kx, ky), s = keys.shift ? 0.5 : 1; x = kx / l * s; y = ky / l * s; }
    }
    const m0 = Math.min(1, Math.hypot(x, y)), dz = 0.12;
    if (m0 < dz) return { x: 0, y: 0, m: 0 };
    return { x: x / m0, y: y / m0, m: (m0 - dz) / (1 - dz) };
  }

  // ── floors ─────────────────────────────────────────────────
  function startFloor(n, retry) {
    floorN = n;
    L = LEVEL.generate(U.hash(save.runSeed, n), n);
    field = L.field; D = L.D;
    for (const d of L.doors) d.open = false;
    field.applyDoors();
    nav = new LEVEL.Nav(field, 11);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of L.floor) { const b = U.bbox(s); x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
    floorBox = { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
    const exitAng = Math.atan2(L.exit.y - L.entrance.y, L.exit.x - L.entrance.x);
    P = { x: L.entrance.x, y: L.entrance.y, ang: exitAng, vx: 0, vy: 0, alive: true, hidden: false, keys: [], stepT: 0, run: false, moving: false, scale: 1, m: 0 };
    guards = L.guards.map((d, i) => ({
      ...d, id: i, home: { x: d.x, y: d.y, ang: d.ang }, state: 'patrol', aw: 0, wait: 0, route: null, ri: 0,
      repath: 0, lost: 0, last: null, bubble: null, cone: null, sweep: Math.random() * 10, stuck: 0, lastPos: { x: d.x, y: d.y }, scanT: 0,
    }));
    cams = L.cams.map((c) => ({ ...c, ang: c.base, aw: 0, alarm: 0, cone: null, bubble: null }));
    fx = []; gotStars = 0; overview = false; $('mapBtn').classList.remove('on');
    stats.time = 0;
    updateHUD();
    if (mode !== 'title') {
      mode = 'intro'; modeT = retry ? 1.3 : 0;
      view.x = floorBox.cx; view.y = floorBox.cy; view.z = overviewZ();
      if (retry) { view.x = P.x; view.y = P.y; view.z = baseZ() * 0.92; }
      showBanner(retry ? null : n);
      if (!retry) AUDIO.play('floor');
    }
  }
  function overviewZ() {
    const top = 70, bottom = isPortrait() ? 40 : 30;
    return Math.min((W - 40) / floorBox.w, (H - top - bottom) / floorBox.h);
  }
  const isPortrait = () => H > W;
  function baseZ() { return U.clamp(Math.min(W, H) / 470, 0.72, 1.7); }

  // ── the player ─────────────────────────────────────────────
  function updatePlayer(dt) {
    const inp = readInput();
    const m = inp.m;
    let speed = 0;
    if (m > 0) speed = m <= 0.72 ? 24 + 46 * (m / 0.72) : U.lerp(70, 128, U.clamp((m - 0.72) / 0.14, 0, 1));
    P.run = m > 0.8; P.m = m;
    stickEl.classList.toggle('run', stick.on && P.run);
    const tvx = inp.x * speed, tvy = inp.y * speed, acc = 1 - Math.exp(-dt * 16);
    P.vx += (tvx - P.vx) * acc; P.vy += (tvy - P.vy) * acc;
    const before = { x: P.x, y: P.y };
    field.move(P, P.vx * dt, P.vy * dt, P_R);
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
            if (Math.hypot(gd.x - P.x, gd.y - P.y) < D.hear) { toSearch(gd, { x: P.x, y: P.y }, true); }
          }
          hint('run', 'Running makes noise. Push the stick gently to sneak.');
        } else { P.stepT = 0.42; AUDIO.play('step', false); }
      }
    } else P.stepT = 0.05;

    // hiding
    const was = P.hidden;
    P.hidden = L.shades.some(s => Math.hypot(s.x - P.x, s.y - P.y) < s.r - 2);
    if (P.hidden && !was) { AUDIO.play('hide'); fx.push({ k: 'puff', x: P.x, y: P.y, t: 0, dur: 0.5 }); hint('hidden', 'Hidden. Guards can\'t see you in the dark unless they walk right into you.'); }

    // pickups
    for (const s of L.stars) if (!s.got && Math.hypot(s.x - P.x, s.y - P.y) < 16) {
      s.got = true; gotStars++; AUDIO.play('star'); updateHUD();
      fx.push({ k: 'burst', x: s.x, y: s.y, t: 0, dur: 0.7, c: COL.star }, { k: 'pop', x: s.x, y: s.y, t: 0, dur: 1.1, text: '★', c: COL.star });
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
        const c = U.centroid(d.shape); fx.push({ k: 'burst', x: c.x, y: c.y, t: 0, dur: 0.6, c: d.color.c });
      } else if (lockedCD <= 0) {
        lockedCD = 3; toast(`Locked. Find the ${d.color.name} key.`, 2.2);
      }
    }
    // the stairs
    if (Math.hypot(L.exit.x - P.x, L.exit.y - P.y) < 15) clearFloor();
    else if (Math.hypot(L.exit.x - P.x, L.exit.y - P.y) < 260) hint('exit', 'The stairs up. Step on them to climb.');
  }

  // ── guards ─────────────────────────────────────────────────
  function sees(o, len, fov, near) {
    if (!P || !P.alive) return null;
    const dx = P.x - o.x, dy = P.y - o.y, d = Math.hypot(dx, dy);
    if (near && d < 26) return { d };
    if (P.hidden && d > 30) return null;
    if (d > len + P_R) return null;
    if (Math.abs(U.angDiff(o.ang, Math.atan2(dy, dx))) > fov + Math.atan2(P_R, d)) return null;
    const t = field.ray(o.x, o.y, dx / d, dy / d, d);
    return t >= d - P_R ? { d } : null;
  }
  function bubble(o, k) { if (!o.bubble || o.bubble.k !== k) o.bubble = { k, t: 0, a: 1 }; }
  function routeTo(gd, x, y) {
    gd.route = nav.path(gd.x, gd.y, x, y, 20000); gd.ri = 0;
    if (!gd.route) gd.route = [{ x, y }];
  }
  function toSearch(gd, p, heard) {
    if (gd.state !== 'search' && gd.state !== 'chase') { if (hmmCD <= 0) { AUDIO.play('hmm'); hmmCD = 0.6; } }
    gd.state = 'search'; gd.target = { x: p.x, y: p.y }; gd.scanT = -1; gd.hurry = !!heard ? 0 : 1;
    routeTo(gd, p.x, p.y); bubble(gd, '?');
    if (heard) gd.heard = true;
  }
  function toChase(gd) {
    if (gd.state !== 'chase') {
      if (spottedCD <= 0) { AUDIO.play('spotted'); spottedCD = 1.2; if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) {} }
      fx.push({ k: 'flash', t: 0, dur: 0.35 });
      hint('chase', 'Seen! Break their line of sight. They\'ll search where they lost you.');
    }
    gd.state = 'chase'; gd.aw = 1; gd.repath = 0; bubble(gd, '!');
    // a shout: guards who can see this one come to look
    for (const o of guards) {
      if (o === gd || o.state === 'chase' || o.state === 'sus') continue;
      const d = Math.hypot(o.x - gd.x, o.y - gd.y);
      if (d < 240 && field.ray(gd.x, gd.y, (o.x - gd.x) / d, (o.y - gd.y) / d, d) >= d - 4) toSearch(o, { x: P.x, y: P.y });
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
    if (s && gd.state !== 'chase') {
      const rate = D.detect * (0.85 + 2.6 * Math.max(0, 1 - s.d / D.coneLen)) * (P.run ? 1.4 : P.moving ? 1 : 0.8);
      gd.aw = Math.min(1, gd.aw + rate * dt);
      if (s.d < 28) gd.aw = 1;
      if (gd.state !== 'sus') {
        gd.prevState = gd.state; gd.state = 'sus'; gd.susLook = gd.ang;
        bubble(gd, '?'); if (hmmCD <= 0) { AUDIO.play('hmm'); hmmCD = 0.5; }
        hint('sus', 'A guard noticed something. Get out of the light before the meter fills.');
      }
      if (gd.aw >= 1) toChase(gd);
    }

    const turn = gd.state === 'chase' ? 7 : 3.4;
    switch (gd.state) {
      case 'patrol': {
        if (gd.kind === 'sentry') {
          gd.sweep += dt;
          const w = Math.sin(gd.sweep * 0.55), shaped = Math.sign(w) * Math.min(1, Math.abs(w) * 1.5);
          gd.ang = U.turnTo(gd.ang, gd.home.ang + shaped * gd.amp, dt * 1.6);
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
        if (gd.last) {
          gd.ang = U.turnTo(gd.ang, Math.atan2(gd.last.y - gd.y, gd.last.x - gd.x), dt * 2.6);
          if (gd.aw > 0.45 && Math.hypot(gd.last.x - gd.x, gd.last.y - gd.y) > 30) stepToward(gd, gd.last.x, gd.last.y, 16, dt, 2.6);
        }
        if (!s) {
          gd.aw = Math.max(0, gd.aw - dt * 0.3);
          if (gd.lost > 1.1) {
            if (gd.aw > 0.25 && gd.last) toSearch(gd, gd.last);
            else { gd.aw = 0; toReturn(gd); gd.bubble = null; AUDIO.play('lost'); }
          }
        }
        break;
      }
      case 'chase': {
        gd.repath -= dt;
        if (s) {
          if (field.clear(gd.x, gd.y, P.x, P.y, G_R - 1)) { gd.route = [{ x: P.x, y: P.y }]; gd.ri = 0; }
          else if (gd.repath <= 0) { routeTo(gd, P.x, P.y); gd.repath = 0.3; }
        } else if (gd.repath <= 0 && gd.last) { routeTo(gd, gd.last.x, gd.last.y); gd.repath = 0.6; }
        const done = follow(gd, D.chase, dt, turn);
        if (!s && (done || gd.lost > 3)) { gd.aw = 0.6; toSearch(gd, gd.last || { x: gd.x, y: gd.y }); }
        break;
      }
      case 'search': {
        if (gd.scanT < 0) {
          const spd = gd.hurry ? D.chase * 0.75 : D.patrol * 1.45;
          if (follow(gd, spd, dt, 4)) { gd.scanT = 0; gd.scanBase = gd.ang; }
          gd.stuck = Math.hypot(gd.x - gd.lastPos.x, gd.y - gd.lastPos.y) < 0.05 ? gd.stuck + dt : 0;
          if (gd.stuck > 1.2) { gd.scanT = 0; gd.scanBase = gd.ang; gd.stuck = 0; }
        } else {
          // look around, the "?" fading as they lose interest
          gd.scanT += dt;
          const dur = 4.2;
          gd.ang = U.turnTo(gd.ang, gd.scanBase + Math.sin(gd.scanT * 1.5) * 1.5, dt * 2.8);
          if (gd.bubble) gd.bubble.a = 1 - U.clamp((gd.scanT - dur + 1.8) / 1.8, 0, 1);
          gd.aw = Math.max(0, gd.aw - dt * 0.25);
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
    if (s) {
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

  function cone(o, len, fov) {
    const n = Math.max(18, Math.round(fov * 2 / 0.04)), pts = new Float32Array((n + 2) * 2);
    pts[0] = o.x; pts[1] = o.y;
    for (let i = 0; i <= n; i++) {
      const a = o.ang - fov + 2 * fov * i / n, dx = Math.cos(a), dy = Math.sin(a);
      const t = field.ray(o.x, o.y, dx, dy, len);
      pts[2 + i * 2] = o.x + dx * t; pts[3 + i * 2] = o.y + dy * t;
    }
    o.cone = pts;
  }

  // ── caught, clear ──────────────────────────────────────────
  function caught(gd) {
    P.alive = false; mode = 'caught'; modeT = 0; stats.caught++;
    if (gd) { gd.state = 'chase'; bubble(gd, '!'); gd.ang = Math.atan2(P.y - gd.y, P.x - gd.x); }
    AUDIO.play('caught'); view.shake = 1;
    if (navigator.vibrate) try { navigator.vibrate([90, 60, 160]); } catch (e) {}
    fx.push({ k: 'flash', t: 0, dur: 0.6, red: true });
    clearStick();
    setTimeout(() => showResult('caught'), 650);
  }
  function clearFloor() {
    mode = 'clear'; modeT = 0; P.alive = false;
    AUDIO.play('clear');
    const prev = save.stars[floorN] || 0;
    save.stars[floorN] = Math.max(prev, gotStars);
    save.floor = floorN + 1; save.best = Math.max(save.best, floorN + 1);
    persist();
    clearStick();
    fx.push({ k: 'burst', x: L.exit.x, y: L.exit.y, t: 0, dur: 0.9, c: '#ffffff' });
    setTimeout(() => showResult('clear'), 750);
  }
  function showResult(kind) {
    const r = $('result');
    if (kind === 'caught') {
      r.innerHTML = `<div class="stamp caught">CAUGHT</div><div class="sub">Floor ${floorN} — try again</div>`;
      r.className = 'show';
      setTimeout(() => { r.className = ''; startFloor(floorN, true); }, 1500);
    } else {
      const st = [0, 1, 2].map(i => `<span class="${i < gotStars ? 'on' : ''}">★</span>`).join('');
      r.innerHTML = `<div class="stamp clear">FLOOR ${floorN} CLEAR</div><div class="stars">${st}</div><div class="sub">Up the stairs…</div>`;
      r.className = 'show';
      setTimeout(() => { r.className = ''; wipe(() => startFloor(floorN + 1)); }, 2100);
    }
  }
  function wipe(then) {
    const w = $('wipe'); w.className = 'in';
    setTimeout(() => { then(); w.className = 'out'; setTimeout(() => { w.className = ''; }, 600); }, 520);
  }
  function skipIntro() { if (mode === 'intro' && modeT < 1.3) modeT = 1.3; }

  // ── hints ──────────────────────────────────────────────────
  let toastT = 0;
  function toast(text, dur) { const t = $('toast'); t.textContent = text; t.classList.add('show'); toastT = dur || 3.5; }
  function hint(id, text) {
    if (save.hints[id] || floorN > 3) return;
    save.hints[id] = 1; persist(); toast(text, 4.2);
  }

  // ── the loop ───────────────────────────────────────────────
  let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 60;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    fpsAcc += dt; fpsN++; if (fpsAcc > 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    if (!paused && L) step(dt);
    if (L) render();
  }
  function step(dt) {
    time += dt; modeT += dt;
    spottedCD -= dt; hmmCD -= dt; lockedCD -= dt;
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); }
    if (mode === 'intro' && modeT > 2.1) { mode = 'play'; modeT = 0; hint('move', isTouch ? 'Drag the stick to move. Stay out of the light.' : 'WASD or arrows to move, Shift to sneak. Stay out of the light.'); }
    if (mode === 'play') { updatePlayer(dt); stats.time += dt; }
    const live = mode === 'play' || mode === 'caught' || mode === 'title' || mode === 'clear';
    if (live) { for (const gd of guards) updateGuard(gd, dt); for (const c of cams) updateCam(c, dt); }
    // cones only for what's near the screen
    const vw = W / view.z / 2 + 220, vh = H / view.z / 2 + 220;
    for (const gd of guards) if (Math.abs(gd.x - view.x) < vw && Math.abs(gd.y - view.y) < vh) cone(gd, D.coneLen, D.fov); else gd.cone = null;
    for (const c of cams) if (Math.abs(c.x - view.x) < vw && Math.abs(c.y - view.y) < vh) cone(c, D.coneLen * 1.05, 0.42); else c.cone = null;
    for (const f of fx) f.t += dt;
    fx = fx.filter(f => f.t < f.dur);
    if (mode === 'clear') P.scale = Math.max(0, 1 - modeT * 1.6);
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
    if (window.__dbg) $('dbg').textContent = `${fps.toFixed(0)}fps  z${view.z.toFixed(2)}  t${AUDIO.tension.toFixed(2)}  ${guards.map(g => g.state[0]).join('')}`;
  }
  function updateView(dt) {
    let tx, ty, tz, rate = 4;
    if (mode === 'title') { tx = floorBox.cx + Math.sin(time * 0.05) * 30; ty = floorBox.cy + Math.cos(time * 0.04) * 20; tz = overviewZ() * 1.02; rate = 1; }
    else if ((mode === 'intro' && modeT < 1.3) || overview) { tx = floorBox.cx; ty = floorBox.cy + (isPortrait() ? 0 : 0); tz = overviewZ(); rate = overview ? 5 : 3; }
    else {
      tx = P.x + P.vx * 0.32; ty = P.y + P.vy * 0.32; tz = baseZ();
      if (isPortrait()) ty += 70 / tz;   // the stick sits at the bottom: keep the player above the middle
      if (mode === 'intro') rate = 2.6;
    }
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
    g.beginPath(); for (const s of L.floor) shapePath(s, LIGHT.x, LIGHT.y); g.fillStyle = COL.floor; g.fill();
    // a soft pool of light toward the middle of the building
    const fg = g.createRadialGradient(floorBox.cx, floorBox.cy, 0, floorBox.cx, floorBox.cy, Math.max(floorBox.w, floorBox.h) * 0.6);
    fg.addColorStop(0, 'rgba(255,255,255,0.07)'); fg.addColorStop(1, 'rgba(0,30,40,0.06)');
    g.fillStyle = fg; g.fillRect(floorBox.x0, floorBox.y0, floorBox.w, floorBox.h);
    drawShades(z);
    // walls' and pillars' shadows, all one tone
    g.beginPath();
    for (const s of L.obs) polyPath(U.sweep(s, LIGHT.x, LIGHT.y));
    for (const d of L.doors) if (!d.open) polyPath(U.sweep(d.shape, LIGHT.x * 0.9, LIGHT.y * 0.9));
    g.fillStyle = COL.shadow; g.fill();
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
    drawChars(z);
    drawFx(z);
    g.restore();
    drawBubbles();
    drawFlash();
  }

  // hiding spots: a pool of deep shadow, soft at the edge, with a ring of comic halftone
  function drawShades(z) {
    for (const s of L.shades) {
      const inside = P && P.hidden && Math.hypot(P.x - s.x, P.y - s.y) < s.r;
      const gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r + 6);
      gr.addColorStop(0, 'rgba(12,48,62,0.62)'); gr.addColorStop(0.62, 'rgba(12,48,62,0.55)'); gr.addColorStop(1, 'rgba(12,48,62,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(s.x, s.y, s.r + 6, 0, TAU); g.fill();
      g.fillStyle = inside ? 'rgba(170,235,255,0.5)' : 'rgba(12,48,62,0.5)';
      const st = 4.6;
      for (let y = -s.r - 6; y <= s.r + 6; y += st) for (let x = -s.r - 6; x <= s.r + 6; x += st) {
        const xx = x + ((Math.round(y / st) & 1) ? st / 2 : 0), d = Math.hypot(xx, y) / s.r;
        if (d > 1.28 || d < 0.9) continue;
        const rr = 1.25 * (1 - Math.abs(d - 1.06) / 0.24);
        if (rr <= 0.15) continue;
        g.beginPath(); g.arc(s.x + xx, s.y + y, rr, 0, TAU); g.fill();
      }
      if (inside) { g.strokeStyle = 'rgba(170,235,255,0.6)'; g.lineWidth = 1.5; g.setLineDash([4, 4]); g.lineDashOffset = time * 10; g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.stroke(); g.setLineDash([]); }
    }
  }

  function drawStairs(p, up, z) {
    const s = 28;
    g.save(); g.translate(p.x, p.y);
    if (up) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 3);
      const gl = g.createRadialGradient(0, 0, 4, 0, 0, 46 + pulse * 8);
      gl.addColorStop(0, 'rgba(230,255,255,0.55)'); gl.addColorStop(1, 'rgba(230,255,255,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 54, 0, TAU); g.fill();
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

  function coneColor(o, isCam) {
    if (o.state === 'chase' || (isCam && o.alarm > 0)) return [255, 110, 92, 0.38];
    const a = o.aw || 0;
    if (a > 0) return [U.lerp(170, 255, a), U.lerp(235, 205, a), U.lerp(250, 110, a), 0.33 + a * 0.06];
    if (o.state === 'search') return [235, 236, 190, 0.32];
    return isCam ? [190, 214, 255, 0.28] : [170, 235, 252, 0.32];
  }
  function drawCones() {
    const one = (o, len, isCam) => {
      if (!o.cone) return;
      const c = coneColor(o, isCam), p = o.cone;
      const gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, len);
      gr.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3] + 0.08})`);
      gr.addColorStop(1, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3] - 0.05})`);
      g.beginPath(); g.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
      g.closePath(); g.fillStyle = gr; g.fill();
    };
    for (const gd of guards) one(gd, D.coneLen, false);
    for (const c of cams) one(c, D.coneLen * 1.05, true);
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
      g.fillStyle = `rgba(240,240,160,${0.16 + pulse * 0.12})`; g.beginPath(); g.arc(s.x, s.y, 13 + pulse * 2, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(240,240,170,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 13 + pulse * 2, 0, TAU); g.stroke();
      star(s.x + 1.5, s.y + 2, 7.5, time * 0.6); g.fillStyle = 'rgba(20,70,85,0.45)'; g.fill();
      star(s.x, s.y, 7.5, time * 0.6); g.fillStyle = COL.star; g.fill();
    }
    for (const k of L.keys) {
      if (k.got) continue;
      const bob = Math.sin(time * 3 + k.x) * 1.5;
      g.fillStyle = k.color.c + '44'; g.beginPath(); g.arc(k.x, k.y, 15, 0, TAU); g.fill();
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
    g.fillStyle = 'rgba(16,62,78,0.55)';
    g.beginPath();
    for (const gd of guards) charSweep(gd.x, gd.y, gd.ang, G_SIZE, 0.55);
    if (P && P.scale > 0) charSweep(P.x, P.y, P.ang, P_SIZE * P.scale, 0.5);
    g.fill();
  }
  function rsq(x, y, s, ang, r) {
    g.save(); g.translate(x, y); g.rotate(ang);
    const h = s / 2;
    g.beginPath(); g.moveTo(-h + r, -h); g.arcTo(h, -h, h, h, r); g.arcTo(h, h, -h, h, r); g.arcTo(-h, h, -h, -h, r); g.arcTo(-h, -h, h, -h, r); g.closePath();
  }
  function drawChars(z) {
    // cameras: a blue eye on the wall
    for (const c of cams) {
      g.fillStyle = 'rgba(70,110,255,0.25)'; g.beginPath(); g.arc(c.x, c.y, 13, 0, TAU); g.fill();
      g.fillStyle = c.alarm > 0 ? '#e0453a' : '#2044a8'; g.beginPath(); g.arc(c.x, c.y, 7.5, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(c.x, c.y, 4.6, 0, TAU); g.fill();
      g.fillStyle = '#10204a'; g.beginPath(); g.arc(c.x + Math.cos(c.ang) * 2, c.y + Math.sin(c.ang) * 2, 2.3, 0, TAU); g.fill();
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
      const s = P_SIZE * P.scale;
      rsq(P.x, P.y, s, P.ang, 2.5);
      g.globalAlpha = P.hidden ? 0.55 : 1;
      g.fillStyle = COL.player; g.fill();
      g.lineWidth = 1.6; g.strokeStyle = COL.playerLo; g.stroke();
      g.fillStyle = COL.playerHi; g.fillRect(-s / 2 + 2.5, -s / 2 + 2.5, s - 5, 2.5);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(s / 2 - 4.5, -2, 2.5, 4);
      if (P.hidden) { g.globalAlpha = 1; g.setLineDash([3, 3]); g.lineDashOffset = -time * 12; g.strokeStyle = '#bff0ff'; g.lineWidth = 1.4; g.strokeRect(-s / 2 - 3, -s / 2 - 3, s + 6, s + 6); g.setLineDash([]); }
      g.restore();
    }
  }
  function drawNoise(z) {
    for (const f of fx) if (f.k === 'ring') {
      const t = f.t / f.dur, r = U.lerp(8, f.r, U.smooth(t));
      g.strokeStyle = `rgba(255,255,255,${0.45 * (1 - t)})`; g.lineWidth = 2 / z * 1.4;
      g.beginPath(); g.arc(f.x, f.y, r, 0, TAU); g.stroke();
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
        g.strokeStyle = `rgba(190,240,255,${0.7 * (1 - t)})`; g.lineWidth = 1.5;
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
    const one = (o, h) => {
      const b = o.bubble; if (!b) return;
      const s = toScreen(o.x, o.y), pop = U.easeOutBack(U.clamp(b.t / 0.28, 0, 1)), r = 11 * k * pop;
      if (r <= 0.5) return;
      const x = s.x + 10 * k, y = s.y - (h + 16) * k;
      g.save(); g.globalAlpha = b.a;
      const red = b.k === '!';
      g.fillStyle = 'rgba(10,40,52,0.35)'; g.beginPath(); g.arc(x + 2, y + 2.5, r, 0, TAU); g.fill();
      g.fillStyle = red ? '#ff4d3a' : '#ffffff'; g.strokeStyle = red ? '#7a1a10' : '#15364a'; g.lineWidth = 2 * k;
      g.beginPath(); g.moveTo(x - r * 0.55, y + r * 0.6); g.lineTo(x - r * 0.95, y + r * 1.25); g.lineTo(x - r * 0.05, y + r * 0.9); g.arc(x, y, r, Math.PI * 0.55, Math.PI * 0.55 + TAU * 0.86); g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = red ? '#ffffff' : '#15364a';
      g.font = `800 ${Math.round(15 * k * pop)}px "Chakra Petch", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(b.k, x, y + 1);
      g.restore();
    };
    const meter = (o) => {
      if (!(o.aw > 0) || o.state === 'chase' || o.alarm > 0) return;
      const s = toScreen(o.x, o.y), r = 15 * k;
      g.lineWidth = 3 * k; g.strokeStyle = 'rgba(10,40,52,0.45)';
      g.beginPath(); g.arc(s.x, s.y, r, 0, TAU); g.stroke();
      g.strokeStyle = o.aw > 0.7 ? '#ff8c4a' : '#ffd36a';
      g.beginPath(); g.arc(s.x, s.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * o.aw); g.stroke();
    };
    for (const gd of guards) { meter(gd); one(gd, G_SIZE); }
    for (const c of cams) { meter(c); one(c, 8); }
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
      g.fillStyle = f.red ? `rgba(255,60,40,${0.35 * (1 - t)})` : `rgba(255,120,80,${0.16 * (1 - t)})`;
      g.fillRect(0, 0, W, H);
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
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  function updateHUD() {
    $('floorNum').textContent = String(floorN).padStart(2, '0');
    $('floorName').textContent = NAMES[(floorN - 1) % NAMES.length];
    $('hudStars').innerHTML = [0, 1, 2].map(i => `<span class="${i < gotStars ? 'on' : ''}">★</span>`).join('');
    $('hudKeys').innerHTML = (P ? P.keys : []).filter(k => !k.door.open).map(k => `<span class="key" style="background:${k.color.c}"></span>`).join('');
  }
  function showBanner(n) {
    const b = $('banner');
    if (n === null) { b.className = ''; return; }
    b.innerHTML = `<div class="bn">FLOOR ${n}</div><div class="bs">${NAMES[(n - 1) % NAMES.length]}</div>`;
    b.className = 'show';
    setTimeout(() => { b.className = 'hide'; }, 1700);
  }
  function togglePause() {
    if (mode === 'title' || mode === 'boot') return;
    paused = !paused;
    $('pause').classList.toggle('show', paused);
    if (paused) { clearStick(); $('pFloor').textContent = `Floor ${floorN} · ${NAMES[(floorN - 1) % NAMES.length]}`; syncToggles(); }
  }
  function toggleMap() {
    if (mode !== 'play') return;
    overview = !overview; $('mapBtn').classList.toggle('on', overview); AUDIO.play('tap');
  }
  function syncToggles() {
    $('optMusic').textContent = 'Music: ' + (save.music ? 'on' : 'off');
    $('optSound').textContent = 'Sound: ' + (save.sound ? 'on' : 'off');
    $('optStick').textContent = 'Stick: ' + save.stickSide;
    document.body.dataset.stick = save.stickSide;
  }
  function titleScreen() {
    mode = 'title'; modeT = 0; paused = false;
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
  $('btnNew').addEventListener('click', () => { save.floor = 1; save.runSeed = (Math.random() * 1e9) >>> 0; persist(); startGame(); });
  $('pauseBtn').addEventListener('click', (e) => { e.stopPropagation(); AUDIO.play('tap'); togglePause(); });
  $('mapBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleMap(); });
  $('optResume').addEventListener('click', togglePause);
  $('optRestart').addEventListener('click', () => { togglePause(); startFloor(floorN, true); });
  $('optMusic').addEventListener('click', () => { save.music = !save.music; AUDIO.setMusic(save.music); persist(); syncToggles(); });
  $('optSound').addEventListener('click', () => { save.sound = !save.sound; AUDIO.setMuted(!save.sound); persist(); syncToggles(); });
  $('optStick').addEventListener('click', () => { save.stickSide = save.stickSide === 'right' ? 'left' : 'right'; persist(); syncToggles(); });
  $('optQuit').addEventListener('click', () => { paused = false; $('pause').classList.remove('show'); titleScreen(); });
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
    startGame, startFloor: (n) => { $('title').classList.remove('show'); $('hud').classList.remove('gone'); stickEl.classList.remove('gone'); mode = 'intro'; startFloor(n); },
    skipIntro: () => { mode = 'play'; modeT = 0; view.x = P.x; view.y = P.y; view.z = baseZ(); $('banner').className = ''; },
    setOverview: (v) => { overview = v; }, teleport: (x, y) => { P.x = x; P.y = y; },
    stick, keys, togglePause, toggleMap,
  };
})();
