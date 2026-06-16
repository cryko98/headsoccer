/* ============================================================================
 *  ai.js — bot behaviour (crew + impostor) and meeting voting. Reads live
 *  SETTINGS; crew bots respond to sabotages by covering fix consoles.
 * ========================================================================== */

const AI = (() => {
  const BOT_SPEED = () => SETTINGS.moveSpeed * 0.9;

  function navigate(bot, tx, ty, dt, speed) {
    const a = bot.ai;
    a.repathCool -= dt;
    if (!a.path.length || a.repathCool <= 0 || a._tx !== tx || a._ty !== ty) {
      a.path = GameMap.path(bot.x, bot.y, tx, ty); a.pi = 0; a.repathCool = 1.0; a._tx = tx; a._ty = ty;
    }
    if (a.pi >= a.path.length) return true;
    const wp = a.path[a.pi];
    const d = Util.dist(bot.x, bot.y, wp.x, wp.y);
    if (d < 22) { a.pi++; if (a.pi >= a.path.length) return true; }
    const nx = (wp.x - bot.x) / (d || 1), ny = (wp.y - bot.y) / (d || 1);
    GameMap.move(bot, nx * speed * dt, ny * speed * dt);
    bot.moving = true; bot.walkPhase += dt * 11;
    if (Math.abs(nx) > 0.05) bot.facing = nx > 0 ? 1 : -1;
    return Util.dist(bot.x, bot.y, tx, ty) < 40;
  }

  function wanderSpot(bot) {
    const a = bot.ai, rooms = GameMap.map().rooms;
    if (!a._wander || Util.dist(bot.x, bot.y, a._wander.x, a._wander.y) < 50) {
      const r = Util.pick(rooms);
      a._wander = { x: r.x + Util.rand(40, r.w - 40), y: r.y + Util.rand(40, r.h - 40) };
    }
    return a._wander;
  }

  function update(bot, dt, world) {
    if (!bot.alive) return;
    const a = bot.ai;
    if (bot.killCooldown > 0) bot.killCooldown -= dt;
    bot.moving = false;

    // Report nearby unreported bodies (impostors avoid self-reporting fresh kills).
    for (const c of world.corpses) {
      if (c.reported) continue;
      if (Util.dist(bot.x, bot.y, c.x, c.y) < CFG.REPORT_RANGE) {
        if (!bot.isImpostor || c.id !== a._lastVictim) { world.report(bot, c); return; }
      }
    }

    // Crew bots prioritise fixing an active sabotage.
    if (!bot.isImpostor && world.sabotage.type) {
      const fp = nearestFix(bot, world);
      if (fp) { navigate(bot, fp.x, fp.y, dt, SETTINGS.moveSpeed); return; }
    }

    if (bot.isImpostor) updateImpostor(bot, dt, world);
    else updateCrew(bot, dt, world);
  }

  function nearestFix(bot, world) {
    let best = null, bd = Infinity;
    for (const fp of world.sabotage.fixPoints || []) { const d = Util.dist(bot.x, bot.y, fp.x, fp.y); if (d < bd) { bd = d; best = fp; } }
    return best;
  }

  function updateCrew(bot, dt, world) {
    const a = bot.ai;
    if (a.doing > 0) { a.doing -= dt; bot.moving = false; if (a.doing <= 0 && a._task) { a._task.done = true; a._task = null; } return; }
    const undone = bot.tasks.find(t => !t.done);
    if (undone) {
      const arrived = navigate(bot, undone.def.x, undone.def.y, dt, BOT_SPEED());
      if (arrived) { a.doing = Util.rand(1.6, 3.0); a._task = undone; }
    } else { const w = wanderSpot(bot); navigate(bot, w.x, w.y, dt, BOT_SPEED() * 0.8); }
  }

  function updateImpostor(bot, dt, world) {
    const a = bot.ai; a.ventCool -= dt;
    let target = null, bd = Infinity;
    for (const c of world.crew) { if (!c.alive || c.isImpostor || c === bot) continue; const d = Util.dist(bot.x, bot.y, c.x, c.y); if (d < bd) { bd = d; target = c; } }
    if (target) {
      let witnesses = 0;
      for (const c of world.crew) { if (!c.alive || c.isImpostor || c === bot || c === target) continue; if (Util.dist(bot.x, bot.y, c.x, c.y) < 260) witnesses++; }
      navigate(bot, target.x, target.y, dt, SETTINGS.moveSpeed * 1.02);
      if (bd < SETTINGS.killRange && bot.killCooldown <= 0 && witnesses === 0) {
        a._lastVictim = target.id; world.kill(bot, target); bot.killCooldown = SETTINGS.killCooldown;
        if (a.ventCool <= 0) { const v = GameMap.ventAt(bot.x, bot.y, 150); if (v) a.ventCool = 8; }
        return;
      }
    } else { const w = wanderSpot(bot); navigate(bot, w.x, w.y, dt, BOT_SPEED() * 0.85); }
  }

  function vote(bot, world) {
    const alive = world.crew.filter(c => c.alive);
    if (bot.isImpostor) {
      if (world.accused && world.accused.alive && !world.accused.isImpostor) return world.accused.id;
      const targets = alive.filter(c => !c.isImpostor && c !== bot);
      return targets.length ? Util.pick(targets).id : null;
    }
    if (world.accused && world.accused !== bot && world.accused.alive && Math.random() < 0.55) return world.accused.id;
    if (Math.random() < 0.4) { const others = alive.filter(c => c !== bot); return others.length ? Util.pick(others).id : null; }
    return null;
  }

  return { update, vote };
})();
