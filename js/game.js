/* ============================================================================
 *  game.js — engine: setup, loop, camera, vision, interactions, sabotage,
 *  meetings and win conditions.
 * ========================================================================== */

const Game = (() => {
  let canvas, ctx;
  const VW = 1000, VH = 600;
  let last = 0;

  const S = {
    phase: 'menu',                  // menu | role | play | task | meeting | over
    rolePref: 'random',
    crew: [], corpses: [],
    player: null,
    cam: { x: 0, y: 0 },
    sabotage: { type: null, timer: 0 },
    sabotageCool: 0,
    botSabotageTimer: 45,
    emergencyCool: 0,
    roleRevealT: 0,
    overText: '', overWin: false,
    winner: null,
    hint: '',
  };

  // ---------------------------------------------------------------- setup ---
  function init(cv) {
    canvas = cv; ctx = canvas.getContext('2d');
    canvas.width = VW; canvas.height = VH;
    GameMap.build(); Tasks.init(); Meeting.init();
    requestAnimationFrame(loop);
  }

  function startMatch(rolePref) {
    S.rolePref = rolePref || S.rolePref;
    S.crew = []; S.corpses = [];
    S.sabotage = { type: null, timer: 0 }; S.sabotageCool = 0; S.botSabotageTimer = Util.rand(40, 70);
    S.emergencyCool = 0;

    const colors = Util.shuffle(COLORS).slice(0, CFG.NUM_PLAYERS);
    const names = Util.shuffle(BOT_NAMES).slice(0, CFG.NUM_PLAYERS - 1);

    // Decide impostor indices.
    let idxs = Array.from({ length: CFG.NUM_PLAYERS }, (_, i) => i);
    let impostorSet = new Set(Util.shuffle(idxs).slice(0, CFG.NUM_IMPOSTORS));
    // Honour player's role preference (player is index 0).
    if (S.rolePref === 'impostor' && !impostorSet.has(0)) { impostorSet = new Set([0, ...[...impostorSet].slice(0, CFG.NUM_IMPOSTORS - 1)]); }
    if (S.rolePref === 'crew' && impostorSet.has(0)) { const others = idxs.filter(i => i !== 0 && !impostorSet.has(i)); impostorSet.delete(0); impostorSet.add(Util.pick(others)); }

    const spawn = { x: EMERGENCY_BTN.x - 60, y: EMERGENCY_BTN.y + 120 };
    for (let i = 0; i < CFG.NUM_PLAYERS; i++) {
      const ang = (i / CFG.NUM_PLAYERS) * Math.PI * 2;
      const c = new Crewmate({
        id: 'p' + i,
        name: i === 0 ? 'YOU' : names[i - 1],
        color: colors[i],
        isPlayer: i === 0,
        isImpostor: impostorSet.has(i),
        x: spawn.x + Math.cos(ang) * 90,
        y: spawn.y + Math.sin(ang) * 70,
      });
      S.crew.push(c);
    }
    S.player = S.crew[0];

    // Deal tasks. Crewmates get counted tasks; impostors get fakes (uncounted).
    for (const c of S.crew) {
      const pool = Util.shuffle(TASK_DEFS).slice(0, CFG.TASKS_PER_CREW);
      c.tasks = pool.map(def => ({ def, done: false }));
    }

    S.phase = 'role'; S.roleRevealT = 3.2;
    UI.showRole(S.player);
    UI.showHUD(true);
    Sound.resume();
  }

  // -------------------------------------------------------------- helpers ---
  function aliveCrew() { return S.crew.filter(c => c.alive && !c.isImpostor); }
  function aliveImp() { return S.crew.filter(c => c.alive && c.isImpostor); }
  function taskStats() {
    let total = 0, done = 0;
    for (const c of S.crew) if (!c.isImpostor) { total += c.tasks.length; done += c.tasksDone; }
    return { total, done };
  }

  function world() {
    return {
      crew: S.crew, corpses: S.corpses,
      accused: S._accused || null,
      kill: (killer, victim) => doKill(killer, victim),
      report: (reporter, body) => startMeeting(reporter, body),
      sabotageActive: !!S.sabotage.type,
    };
  }

  // ---------------------------------------------------------------- kills ---
  function doKill(killer, victim) {
    if (!victim.alive) return;
    victim.alive = false;
    S.corpses.push(new Corpse(victim));
    Sound.kill();
    if (victim.isPlayer) { S.hint = 'You were eliminated. You are now a ghost — finish your tasks.'; }
    checkWin();
  }

  function startMeeting(reporter, body) {
    if (S.phase === 'meeting' || S.phase === 'over') return;
    if (body) { Sound.body(); body.reported = true; }
    // clear active sabotage on meeting
    S.sabotage = { type: null, timer: 0 };
    // pick a soft "accused" for bot heuristics: a random living crewmate
    const alive = S.crew.filter(c => c.alive);
    S._accused = Util.pick(alive);
    S.phase = 'meeting';
    Tasks.close(false);
    Meeting.start({ reporter, body, crew: S.crew, accused: S._accused, onEnd: endMeeting });
  }

  function endMeeting(ejected) {
    if (ejected) ejected.alive = false;
    S.corpses = [];
    // reset cooldowns + regroup at cafeteria
    const spawn = { x: EMERGENCY_BTN.x - 60, y: EMERGENCY_BTN.y + 120 };
    S.crew.forEach((c, i) => {
      if (!c.alive) return;
      const ang = (i / CFG.NUM_PLAYERS) * Math.PI * 2;
      c.x = spawn.x + Math.cos(ang) * 100; c.y = spawn.y + Math.sin(ang) * 76;
      if (c.isImpostor) c.killCooldown = CFG.KILL_COOLDOWN;
      if (c.ai) { c.ai.path = []; c.ai.doing = 0; c.ai._task = null; }
    });
    if (checkWin()) return;
    S.phase = 'play';
  }

  // ------------------------------------------------------------- sabotage ---
  function triggerSabotage(type) {
    if (S.sabotage.type || S.sabotageCool > 0) return;
    S.sabotage.type = type;
    S.sabotage.timer = type === 'reactor' ? CFG.REACTOR_COUNTDOWN : 0;
    S.sabotageCool = CFG.SABOTAGE_COOLDOWN;
    Sound.sabotage();
    UI.toast(type === 'reactor' ? 'REACTOR MELTDOWN — fix it!' : 'LIGHTS SABOTAGED');
  }
  function fixSabotage() {
    if (!S.sabotage.type) return;
    S.sabotage = { type: null, timer: 0 };
    Sound.taskDone(); UI.toast('Systems restored');
  }

  // ----------------------------------------------------------------- win ---
  function checkWin() {
    if (S.phase === 'over') return true;
    const imp = aliveImp().length, crew = aliveCrew().length;
    const ts = taskStats();
    if (imp === 0) return endGame(true, 'Crewmates ejected all impostors!');
    if (ts.total > 0 && ts.done >= ts.total) return endGame(true, 'Crewmates finished every task!');
    if (imp >= crew) return endGame(false, 'Impostors reached the crew. They win.');
    return false;
  }
  function endGame(crewWon, text) {
    S.phase = 'over'; S.overWin = crewWon; S.overText = text;
    const playerWon = S.player.isImpostor ? !crewWon : crewWon;
    Sound[playerWon ? 'win' : 'lose']();
    UI.showHUD(false);
    UI.showOver(crewWon, text, playerWon, S.crew);
    return true;
  }

  // --------------------------------------------------------------- update ---
  function update(dt) {
    if (S.phase === 'role') { S.roleRevealT -= dt; if (S.roleRevealT <= 0) { UI.hideRole(); S.phase = 'play'; } return; }
    if (S.phase === 'meeting') { Meeting.update(dt); return; }
    if (S.phase !== 'play' && S.phase !== 'task') return;

    // Cooldowns.
    if (S.player.killCooldown > 0 && S.phase === 'play') {} // player cd handled below
    if (S.sabotageCool > 0) S.sabotageCool -= dt;
    if (S.emergencyCool > 0) S.emergencyCool -= dt;

    // Reactor countdown.
    if (S.sabotage.type === 'reactor') {
      S.sabotage.timer -= dt;
      if (S.sabotage.timer <= 0) { endGame(false, 'Reactor melted down. Impostors win.'); return; }
    }

    // Bot-driven sabotage occasionally.
    if (!S.sabotage.type && aliveImp().length > 0) {
      S.botSabotageTimer -= dt;
      if (S.botSabotageTimer <= 0) { triggerSabotage(Math.random() < 0.5 ? 'lights' : 'reactor'); S.botSabotageTimer = Util.rand(45, 80); }
    }

    // Player movement (frozen while a task minigame is open).
    if (S.phase === 'play') handlePlayer(dt);

    // Bots.
    const w = world();
    for (const c of S.crew) {
      if (c.isPlayer || !c.alive) continue;
      AI.update(c, dt, w);
    }

    // Player cooldown tick.
    if (S.player.isImpostor && S.player.killCooldown > 0) S.player.killCooldown -= dt;

    // Camera follow.
    S.cam.x = Util.clamp(S.player.x - VW / 2, 0, CFG.WORLD_W - VW);
    S.cam.y = Util.clamp(S.player.y - VH / 2, 0, CFG.WORLD_H - VH);

    if (checkWin()) return;
    UI.syncHUD(S);
    Input.clear();
  }

  function handlePlayer(dt) {
    const p = S.player;
    const ax = Input.axis();
    const ghost = !p.alive;
    const sp = CFG.MOVE_SPEED * (ghost ? 1.25 : 1);
    if (ax.x || ax.y) {
      if (ghost) { p.x += ax.x * sp * dt; p.y += ax.y * sp * dt; }
      else GameMap.move(p, ax.x * sp * dt, ax.y * sp * dt);
      p.moving = true; p.walkPhase += dt * 11;
      if (Math.abs(ax.x) > 0.05) p.facing = ax.x > 0 ? 1 : -1;
    } else p.moving = false;

    if (ghost) { Input.clear(); return; }

    // Determine context interactions.
    const near = context();
    S.hintCtx = near;

    if (Input.consume('use')) {
      if (near.task) openTask(near.task);
      else if (near.fix) fixSabotage();
      else if (near.vent && p.isImpostor) useVent(near.vent);
      else if (near.emergency && S.emergencyCool <= 0 && p.usedEmergency < CFG.EMERGENCY_USES && !S.sabotage.type) {
        p.usedEmergency++; startMeeting(p, null);
      }
    }
    if (Input.consume('report') && near.body) startMeeting(p, near.body);
    if (Input.consume('kill') && p.isImpostor && near.victim && p.killCooldown <= 0) {
      doKill(p, near.victim); p.killCooldown = CFG.KILL_COOLDOWN;
    }
    if (Input.consume('sabotage') && p.isImpostor) UI.toggleSabotageMenu(S);
  }

  function context() {
    const p = S.player;
    const out = { task: null, vent: null, body: null, victim: null, emergency: false, fix: null };
    // nearest own undone task in range
    let bt = Infinity;
    for (const t of p.tasks) if (!t.done) { const d = Util.dist(p.x, p.y, t.def.x, t.def.y); if (d < CFG.USE_RANGE && d < bt) { bt = d; out.task = t; } }
    // vent
    out.vent = GameMap.ventAt(p.x, p.y, CFG.INTERACT_RANGE);
    // body
    let bb = Infinity;
    for (const c of S.corpses) { const d = Util.dist(p.x, p.y, c.x, c.y); if (d < CFG.REPORT_RANGE && d < bb) { bb = d; out.body = c; } }
    // kill victim
    if (p.isImpostor) {
      let bv = Infinity;
      for (const c of S.crew) if (c.alive && !c.isImpostor) { const d = Util.dist(p.x, p.y, c.x, c.y); if (d < CFG.KILL_RANGE && d < bv) { bv = d; out.victim = c; } }
    }
    // emergency button
    out.emergency = Util.dist(p.x, p.y, EMERGENCY_BTN.x, EMERGENCY_BTN.y) < CFG.USE_RANGE;
    // sabotage fix points
    if (S.sabotage.type === 'lights') { const e = ROOMS.find(r => r.id === 'electric'); if (p.x > e.x && p.x < e.x + e.w && p.y > e.y && p.y < e.y + e.h) out.fix = 'lights'; }
    if (S.sabotage.type === 'reactor') { const e = ROOMS.find(r => r.id === 'reactor'); if (p.x > e.x && p.x < e.x + e.w && p.y > e.y && p.y < e.y + e.h) out.fix = 'reactor'; }
    return out;
  }

  function openTask(taskInst) {
    if (S.player.isImpostor) { UI.toast('Faking task…'); /* impostors fake */ }
    S.phase = 'task';
    Tasks.open(taskInst, (t) => {
      if (!S.player.isImpostor) { t.done = true; Sound.taskDone(); }
      S.phase = 'play';
      if (!checkWin()) UI.syncHUD(S);
    });
    // If player closes without finishing, Tasks calls done only on success; restore phase on close:
    S._taskWatch = true;
  }

  function useVent(vent) {
    const group = GameMap.vents.filter(v => v.group === vent.group);
    const idx = group.indexOf(vent);
    const next = group[(idx + 1) % group.length];
    S.player.x = next.x; S.player.y = next.y;
    Sound.use();
  }

  // --------------------------------------------------------------- render ---
  function loop(ts) {
    const dt = Math.min((ts - last) / 1000 || 0, 1 / 20);
    last = ts;
    // If a task minigame was closed (not via success), unfreeze.
    if (S.phase === 'task' && !Tasks.isOpen()) S.phase = 'play';
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function render() {
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, VW, VH);
    if (S.phase === 'menu') return;

    ctx.save();
    ctx.translate(-S.cam.x, -S.cam.y);

    GameMap.drawFloor(ctx);
    GameMap.drawVents(ctx);
    GameMap.drawEmergency(ctx);
    drawTaskMarkers();

    for (const c of S.corpses) c.draw(ctx);

    // Crewmates: impostors visible to the player only if player is impostor or they're the player.
    for (const c of S.crew) {
      if (!c.alive) continue;
      const showImp = c.isImpostor && (S.player.isImpostor || c.isPlayer);
      c.draw(ctx, { highlight: c.isPlayer ? 'me' : (showImp ? 'impostor' : null) });
    }

    ctx.restore();

    // Vision mask (skip for ghosts).
    if (S.player.alive && (S.phase === 'play' || S.phase === 'task')) drawVision();

    drawContextPrompt();
  }

  function drawTaskMarkers() {
    const p = S.player;
    for (const t of p.tasks) {
      if (t.done) continue;
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
      ctx.save();
      ctx.globalAlpha = 0.35 + pulse * 0.3;
      ctx.strokeStyle = p.isImpostor ? '#ff6b6b' : '#ffd24a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(t.def.x, t.def.y, 24, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = p.isImpostor ? '#ff6b6b' : '#ffd24a';
      ctx.font = '800 16px "Segoe UI"'; ctx.textAlign = 'center';
      ctx.fillText('!', t.def.x, t.def.y + 6);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  function drawVision() {
    const cx = S.player.x - S.cam.x, cy = S.player.y - S.cam.y;
    let radius = S.player.isImpostor ? CFG.VISION_IMPOSTOR : CFG.VISION_CREW;
    if (!S.player.isImpostor && S.sabotage.type === 'lights') radius = CFG.VISION_LIGHTS_OUT;
    const g = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius);
    g.addColorStop(0, 'rgba(3,5,12,0)');
    g.addColorStop(0.85, 'rgba(3,5,12,0.86)');
    g.addColorStop(1, 'rgba(3,5,12,0.97)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  }

  function drawContextPrompt() {
    if (S.phase !== 'play' || !S.player.alive) return;
    const c = S.hintCtx; if (!c) return;
    let label = null, key = 'E';
    if (c.task) label = 'Use';
    else if (c.fix) label = 'Fix';
    else if (c.vent && S.player.isImpostor) label = 'Vent';
    else if (c.emergency && S.player.usedEmergency < CFG.EMERGENCY_USES) label = 'Emergency';
    // Drawn by UI as buttons instead; keep canvas clean.
  }

  // ---------------------------------------------------------------- api ---
  return {
    init, startMatch, world,
    state: S,
    renderFrame: render,
    quitToMenu() { S.phase = 'menu'; UI.showHUD(false); UI.showMenu(); },
    taskStats, aliveImp, aliveCrew,
    triggerSabotage,
  };
})();
