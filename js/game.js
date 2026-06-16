/* ============================================================================
 *  game.js — engine: setup, loop, camera, vision, interactions, sabotage,
 *  cameras, minimap, meetings and win conditions.
 * ========================================================================== */

const Game = (() => {
  let canvas, ctx;
  const VW = 1000, VH = 600;
  let last = 0;

  const S = {
    phase: 'menu',                 // menu | role | play | task | meeting | over
    map: null,
    crew: [], corpses: [],
    player: null,
    cam: { x: 0, y: 0 },
    sabotage: { type: null, timer: 0, fixPoints: [] },
    sabotageCool: 0, botSabotageTimer: 45,
    commsDown: false,
    roleRevealT: 0,
    viewer: null,                  // null | 'cameras' | 'admin' | 'vitals'
    minimapOpen: false,
    killFlash: 0,
    overWin: false, overText: '',
    hintCtx: null, hint: '',
    _accused: null, _taskFlash: 0,
  };

  function init(cv) {
    canvas = cv; ctx = canvas.getContext('2d');
    canvas.width = VW; canvas.height = VH;
    Tasks.init(); Meeting.init();
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- setup ---
  function startMatch() {
    const map = Util.mapById(SETTINGS.mapId);
    S.map = map; GameMap.load(map);
    S.crew = []; S.corpses = [];
    S.sabotage = { type: null, timer: 0, fixPoints: [] };
    S.sabotageCool = 0; S.botSabotageTimer = Util.rand(40, 70);
    S.commsDown = false; S.viewer = null; S.minimapOpen = false; S.killFlash = 0;

    const np = SETTINGS.numPlayers, ni = Util.clamp(SETTINGS.numImpostors, 1, Math.max(1, Math.floor((np - 1) / 2)));
    const colorPool = Util.shuffle(COLORS).filter(c => c.id !== SETTINGS.color);
    const names = Util.shuffle(BOT_NAMES).slice(0, np - 1);
    const hatPool = HATS.filter(h => h.id !== 'none'), petPool = PETS.filter(p => p.id !== 'none');

    let idxs = Array.from({ length: np }, (_, i) => i);
    let impostors = new Set(Util.shuffle(idxs).slice(0, ni));
    if (SETTINGS.rolePref === 'impostor' && !impostors.has(0)) impostors = new Set([0, ...[...impostors].slice(0, ni - 1)]);
    if (SETTINGS.rolePref === 'crew' && impostors.has(0)) { impostors.delete(0); const o = idxs.filter(i => i !== 0 && !impostors.has(i)); impostors.add(Util.pick(o)); }

    const sp = resolveSpot(map.spawn);
    for (let i = 0; i < np; i++) {
      const ang = (i / np) * Math.PI * 2;
      const c = new Crewmate({
        id: 'p' + i,
        name: i === 0 ? 'YOU' : names[i - 1],
        color: i === 0 ? COLORS.find(c => c.id === SETTINGS.color) : colorPool[(i - 1) % colorPool.length],
        hat: i === 0 ? SETTINGS.hat : (Math.random() < 0.5 ? Util.pick(hatPool).id : 'none'),
        pet: i === 0 ? SETTINGS.pet : (Math.random() < 0.25 ? Util.pick(petPool).id : 'none'),
        isPlayer: i === 0, isImpostor: impostors.has(i),
        x: sp.x + Math.cos(ang) * 95, y: sp.y + Math.sin(ang) * 72,
        killCooldown: SETTINGS.killCooldown,
      });
      S.crew.push(c);
    }
    S.player = S.crew[0];
    dealTasks();

    S.phase = 'role'; S.roleRevealT = 3.2;
    UI.showRole(S.player); UI.showHUD(true);
    Sound.resume();
  }

  function dealTasks() {
    const spots = S.map.taskSpots;
    const commons = spots.filter(s => s.kind === 'common');
    const pool = spots.filter(s => s.kind !== 'common');
    const chosenCommon = Util.shuffle(commons).slice(0, SETTINGS.commonTasks);
    for (const c of S.crew) {
      const list = [];
      for (const cm of chosenCommon) list.push(makeTask(cm));
      const extra = Util.shuffle(pool).slice(0, Math.max(0, SETTINGS.tasksPerCrew - chosenCommon.length));
      for (const e of extra) list.push(makeTask(e));
      c.tasks = list;
    }
  }
  function makeTask(spot) { return { def: spot, done: false, step: 0, steps: spot.steps || 1 }; }

  function resolveSpot(s) { const r = S.map.rooms.find(rr => rr.id === s.room); return { x: r.x + r.w / 2 + (s.dx || 0), y: r.y + r.h / 2 + (s.dy || 0) }; }
  function roomRect(id) { return S.map.rooms.find(r => r.id === id); }

  // Current world-space target of a task (handles multi-step long tasks).
  function taskPos(t) {
    if (t.def.steps && t.def.stepRooms && t.def.stepRooms[t.step]) { const r = roomRect(t.def.stepRooms[t.step]); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
    return { x: t.def.x, y: t.def.y };
  }

  // -------------------------------------------------------------- helpers ---
  function aliveCrew() { return S.crew.filter(c => c.alive && !c.isImpostor); }
  function aliveImp() { return S.crew.filter(c => c.alive && c.isImpostor); }
  function taskStats() { let total = 0, done = 0; for (const c of S.crew) if (!c.isImpostor) { for (const t of c.tasks) { total += t.steps; done += t.done ? t.steps : t.step; } } return { total, done }; }

  function world() {
    return { crew: S.crew, corpses: S.corpses, accused: S._accused, sabotage: S.sabotage,
      kill: (k, v) => doKill(k, v), report: (r, b) => startMeeting(r, b) };
  }

  // ---------------------------------------------------------------- kills ---
  function doKill(killer, victim) {
    if (!victim.alive) return;
    victim.alive = false; S.corpses.push(new Corpse(victim)); Sound.kill();
    if (victim.isPlayer) { S.killFlash = 1.3; S.viewer = null; S.minimapOpen = false; S.hint = 'You were eliminated — you are a ghost. Finish your tasks.'; }
    checkWin();
  }

  function startMeeting(reporter, body) {
    if (S.phase === 'meeting' || S.phase === 'over') return;
    if (body) { Sound.body(); body.reported = true; }
    S.sabotage = { type: null, timer: 0, fixPoints: [] }; S.commsDown = false;
    S.viewer = null; S.minimapOpen = false;
    S._accused = Util.pick(S.crew.filter(c => c.alive));
    S.phase = 'meeting'; Tasks.close(false);
    Meeting.start({ reporter, body, crew: S.crew, accused: S._accused, onEnd: endMeeting });
  }

  function endMeeting(ejected) {
    if (ejected) ejected.alive = false;
    S.corpses = [];
    const sp = resolveSpot(S.map.spawn);
    S.crew.forEach((c, i) => {
      if (!c.alive) return;
      const ang = (i / S.crew.length) * Math.PI * 2;
      c.x = sp.x + Math.cos(ang) * 100; c.y = sp.y + Math.sin(ang) * 76;
      if (c.isImpostor) c.killCooldown = SETTINGS.killCooldown;
      if (c.ai) { c.ai.path = []; c.ai.doing = 0; c.ai._task = null; }
    });
    if (checkWin()) return;
    S.phase = 'play';
  }

  // ------------------------------------------------------------- sabotage ---
  function consoleAt(roomId) { const r = roomRect(roomId); return { room: roomId, x: r.x + 44, y: r.y + r.h - 34 }; }

  function triggerSabotage(type) {
    if (S.sabotage.type || S.sabotageCool > 0 || S.phase !== 'play') return;
    if (type === 'doors') { const r = GameMap.roomAt(S.player.x, S.player.y) || S.map.rooms.find(x => x.id !== S.map.spawn.room); GameMap.closeDoors(r.id, 12); S.sabotageCool = SETTINGS.sabotageCooldown; Sound.sabotage(); UI.toast('Doors sealed: ' + r.name); return; }
    S.sabotage.type = type;
    S.sabotage.timer = type === 'reactor' ? SETTINGS.reactorCountdown : 0;
    S.sabotage.fixPoints = (type === 'reactor' ? S.map.reactorRooms : [type === 'lights' ? S.map.lightsRoom : S.map.commsRoom]).map(consoleAt);
    S.sabotageCool = SETTINGS.sabotageCooldown;
    if (type === 'comms') S.commsDown = true;
    Sound.sabotage();
    UI.toast(type === 'reactor' ? 'REACTOR MELTDOWN — fix both consoles!' : type === 'lights' ? 'LIGHTS SABOTAGED' : 'COMMS DISABLED');
  }
  function fixSabotage() { S.sabotage = { type: null, timer: 0, fixPoints: [] }; S.commsDown = false; Sound.taskDone(); UI.toast('Systems restored'); }

  function updateSabotageCoverage() {
    const sab = S.sabotage; if (!sab.type || !sab.fixPoints.length) return;
    for (const fp of sab.fixPoints) fp.covered = S.crew.some(c => c.alive && !c.isImpostor && Util.dist(c.x, c.y, fp.x, fp.y) < 74);
    const allCovered = sab.fixPoints.every(fp => fp.covered);
    const anyCovered = sab.fixPoints.some(fp => fp.covered);
    if ((sab.type === 'reactor' && allCovered) || ((sab.type === 'lights' || sab.type === 'comms') && anyCovered)) fixSabotage();
  }

  // ----------------------------------------------------------------- win ---
  function checkWin() {
    if (S.phase === 'over') return true;
    const imp = aliveImp().length, crew = aliveCrew().length, ts = taskStats();
    if (imp === 0) return endGame(true, 'Crewmates ejected all impostors!');
    if (ts.total > 0 && ts.done >= ts.total) return endGame(true, 'Crewmates finished every task!');
    if (imp >= crew) return endGame(false, 'Impostors reached the crew. They win.');
    return false;
  }
  function endGame(crewWon, text) {
    S.phase = 'over'; S.overWin = crewWon; S.overText = text;
    const playerWon = S.player.isImpostor ? !crewWon : crewWon;
    Sound[playerWon ? 'win' : 'lose'](); UI.showHUD(false);
    UI.showOver(crewWon, text, playerWon, S.crew);
    return true;
  }

  // --------------------------------------------------------------- update ---
  function update(dt) {
    if (S.phase === 'role') { S.roleRevealT -= dt; if (S.roleRevealT <= 0) { UI.hideRole(); S.phase = 'play'; } return; }
    if (S.phase === 'meeting') { Meeting.update(dt); return; }
    if (S.phase !== 'play' && S.phase !== 'task') return;

    if (S.sabotageCool > 0) S.sabotageCool -= dt;
    GameMap.updateDoors(dt);

    if (S.sabotage.type === 'reactor') { S.sabotage.timer -= dt; if (S.sabotage.timer <= 0) { endGame(false, 'Reactor melted down. Impostors win.'); return; } }
    if (!S.sabotage.type && aliveImp().length > 0) { S.botSabotageTimer -= dt; if (S.botSabotageTimer <= 0) { triggerSabotageByBot(); S.botSabotageTimer = Util.rand(45, 85); } }

    for (const c of S.crew) { c.scanFx = Math.max(0, c.scanFx - dt); c.updatePet(dt); }
    if (S.killFlash > 0) S.killFlash -= dt;

    if (S.phase === 'play') handlePlayer(dt);

    const w = world();
    for (const c of S.crew) { if (c.isPlayer || !c.alive) continue; AI.update(c, dt, w); }
    updateSabotageCoverage();

    if (S.player.isImpostor && S.player.killCooldown > 0) S.player.killCooldown -= dt;

    const b = S.map.bounds;
    S.cam.x = Util.clamp(S.player.x - VW / 2, b.minX, Math.max(b.minX, b.maxX - VW));
    S.cam.y = Util.clamp(S.player.y - VH / 2, b.minY, Math.max(b.minY, b.maxY - VH));

    if (checkWin()) return;
    UI.syncHUD(S);
    Input.clear();
  }

  function triggerSabotageByBot() { const r = Math.random(); triggerSabotage(r < 0.45 ? 'reactor' : r < 0.8 ? 'lights' : 'comms'); }

  function handlePlayer(dt) {
    const p = S.player, ax = Input.axis(), ghost = !p.alive;

    // Minimap toggle.
    if (Input.consume('map') && !S.commsDown) S.minimapOpen = !S.minimapOpen;
    if (Input.consume('escape')) { S.viewer = null; S.minimapOpen = false; }

    // A console viewer (cameras / admin / vitals) freezes movement.
    if (S.viewer) {
      if (Input.consume('use')) S.viewer = null;
      p.moving = false; Input.clear(); return;
    }

    const sp = SETTINGS.moveSpeed * (ghost ? 1.25 : 1);
    if (ax.x || ax.y) {
      if (ghost) { p.x += ax.x * sp * dt; p.y += ax.y * sp * dt; } else GameMap.move(p, ax.x * sp * dt, ax.y * sp * dt);
      p.moving = true; p.walkPhase += dt * 11; if (Math.abs(ax.x) > 0.05) p.facing = ax.x > 0 ? 1 : -1;
    } else p.moving = false;

    if (ghost) { Input.clear(); return; }

    const near = context(); S.hintCtx = near;

    if (Input.consume('use')) {
      if (near.task) openTask(near.task);
      else if (near.cameras && !S.commsDown) { S.viewer = 'cameras'; Sound.use(); }
      else if (near.admin && !S.commsDown) { S.viewer = 'admin'; Sound.use(); }
      else if (near.vitals && !S.commsDown) { S.viewer = 'vitals'; Sound.use(); }
      else if (near.vent && p.isImpostor) useVent(near.vent);
      else if (near.emergency && p.usedEmergency < SETTINGS.emergencies && !S.sabotage.type) { p.usedEmergency++; startMeeting(p, null); }
    }
    if (Input.consume('report') && near.body) startMeeting(p, near.body);
    if (Input.consume('kill') && p.isImpostor && near.victim && p.killCooldown <= 0) { doKill(p, near.victim); p.killCooldown = SETTINGS.killCooldown; }
    if (Input.consume('sabotage') && p.isImpostor) UI.toggleSabotageMenu(S);
  }

  function context() {
    const p = S.player;
    const out = { task: null, vent: null, body: null, victim: null, emergency: false, cameras: false, admin: false, vitals: false };
    let bt = Infinity;
    for (const t of p.tasks) if (!t.done) { const tp = taskPos(t); const d = Util.dist(p.x, p.y, tp.x, tp.y); if (d < CFG.USE_RANGE && d < bt) { bt = d; out.task = t; } }
    out.vent = GameMap.ventAt(p.x, p.y, CFG.INTERACT_RANGE);
    let bb = Infinity;
    for (const c of S.corpses) { const d = Util.dist(p.x, p.y, c.x, c.y); if (d < CFG.REPORT_RANGE && d < bb) { bb = d; out.body = c; } }
    if (p.isImpostor) { let bv = Infinity; for (const c of S.crew) if (c.alive && !c.isImpostor) { const d = Util.dist(p.x, p.y, c.x, c.y); if (d < SETTINGS.killRange && d < bv) { bv = d; out.victim = c; } } }
    for (const b of S.map.buttonSpots) if (Util.dist(p.x, p.y, b.x, b.y) < CFG.USE_RANGE) out.emergency = true;
    const sr = roomRect(S.map.securityRoom); const sc = { x: sr.x + sr.w - 40, y: sr.y + sr.h - 36 };
    if (Util.dist(p.x, p.y, sc.x, sc.y) < CFG.USE_RANGE) out.cameras = true;
    const ar = roomRect(S.map.adminRoom); const ac = { x: ar.x + 46, y: ar.y + 44 };
    if (Util.dist(p.x, p.y, ac.x, ac.y) < CFG.USE_RANGE) out.admin = true;
    const vr = roomRect(S.map.vitalsRoom); const vc = { x: vr.x + vr.w - 46, y: vr.y + 44 };
    if (Util.dist(p.x, p.y, vc.x, vc.y) < CFG.USE_RANGE) out.vitals = true;
    return out;
  }

  function openTask(t) {
    if (S.player.isImpostor) UI.toast('Faking task…');
    if (!S.player.isImpostor && (t.def.kind === 'visual')) S.player.scanFx = 2.2;
    S.phase = 'task';
    Tasks.open(t, () => {
      if (!S.player.isImpostor) {
        t.step++;
        if (t.step >= t.steps) { t.done = true; Sound.taskDone(); }
        else { Sound.taskOk(); const r = t.def.stepRooms ? roomRect(t.def.stepRooms[t.step]) : null; UI.toast('Next step' + (r ? ': ' + r.name : '')); }
      }
      S.phase = 'play';
      if (!checkWin()) UI.syncHUD(S);
    });
  }

  function useVent(vent) {
    const group = GameMap.vents().filter(v => v.group === vent.group);
    const idx = group.indexOf(vent); const next = group[(idx + 1) % group.length];
    S.player.x = next.x; S.player.y = next.y; Sound.use();
  }

  // --------------------------------------------------------------- render ---
  function loop(ts) {
    const dt = Math.min((ts - last) / 1000 || 0, 1 / 20); last = ts;
    if (S.phase === 'task' && !Tasks.isOpen()) S.phase = 'play';
    update(dt); render();
    requestAnimationFrame(loop);
  }

  function render() {
    ctx.fillStyle = '#05080f'; ctx.fillRect(0, 0, VW, VH);
    if (S.phase === 'menu') return;

    ctx.save(); ctx.translate(-S.cam.x, -S.cam.y);
    GameMap.drawFloor(ctx);
    GameMap.drawVents(ctx);
    GameMap.drawDevices(ctx, S.sabotage);
    drawTaskMarkers();
    for (const c of S.crew) if (c.alive) c.drawPet(ctx);
    for (const c of S.corpses) c.draw(ctx);
    for (const c of S.crew) {
      if (!c.alive) continue;
      const showImp = c.isImpostor && (S.player.isImpostor || c.isPlayer);
      c.draw(ctx, { highlight: c.isPlayer ? 'me' : (showImp ? 'impostor' : null) });
    }
    ctx.restore();

    if (S.player.alive && (S.phase === 'play' || S.phase === 'task') && !S.viewer) drawVision();

    // Kill flash vignette.
    if (S.killFlash > 0) {
      const a = Math.min(1, S.killFlash) * 0.6;
      const g = ctx.createRadialGradient(VW / 2, VH / 2, 120, VW / 2, VH / 2, VW * 0.7);
      g.addColorStop(0, 'rgba(180,20,30,0)'); g.addColorStop(1, `rgba(150,10,20,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    }
  }

  function drawTaskMarkers() {
    const p = S.player;
    for (const t of p.tasks) {
      if (t.done) continue;
      const tp = taskPos(t);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
      ctx.save();
      ctx.globalAlpha = 0.35 + pulse * 0.3; ctx.strokeStyle = p.isImpostor ? '#ff6b6b' : '#ffd24a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(tp.x, tp.y, 24, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.9; ctx.fillStyle = p.isImpostor ? '#ff6b6b' : '#ffd24a'; ctx.font = '800 18px "Segoe UI"'; ctx.textAlign = 'center';
      ctx.fillText('!', tp.x, tp.y + 6); ctx.textAlign = 'left'; ctx.restore();
    }
  }

  function drawVision() {
    const cx = S.player.x - S.cam.x, cy = S.player.y - S.cam.y;
    let radius = S.player.isImpostor ? SETTINGS.impostorVision : SETTINGS.crewVision;
    if (!S.player.isImpostor && S.sabotage.type === 'lights') radius = Math.min(radius, 150);
    const g = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius);
    g.addColorStop(0, 'rgba(3,5,12,0)'); g.addColorStop(0.85, 'rgba(3,5,12,0.86)'); g.addColorStop(1, 'rgba(3,5,12,0.97)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }

  // Render one camera feed region into a target canvas context (used by UI).
  function renderCamera(tctx, spot, tw, th) {
    const r = spot.rect; const scale = Math.min(tw / (r.w + 120), th / (r.h + 120));
    tctx.save(); tctx.fillStyle = '#05080f'; tctx.fillRect(0, 0, tw, th);
    tctx.translate(tw / 2, th / 2); tctx.scale(scale, scale); tctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    GameMap.drawFloor(tctx); GameMap.drawVents(tctx);
    for (const c of S.crew) if (c.alive && c.x > r.x - 60 && c.x < r.x + r.w + 60 && c.y > r.y - 60 && c.y < r.y + r.h + 60) c.draw(tctx, {});
    for (const cp of S.corpses) if (cp.x > r.x - 60 && cp.x < r.x + r.w + 60) cp.draw(tctx);
    tctx.restore();
  }

  return {
    init, startMatch, world, state: S, renderFrame: render,
    quitToMenu() { S.phase = 'menu'; UI.showHUD(false); UI.showMenu(); },
    taskStats, aliveImp, aliveCrew, triggerSabotage, renderCamera,
  };
})();
