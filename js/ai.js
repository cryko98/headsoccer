/* ============================================================================
 *  ai.js — bot behaviour for crewmates and impostors.
 *  AI.update(bot, dt, world) drives one bot and may call world.kill / world.report.
 * ========================================================================== */

const AI = (() => {

  function navigate(bot, tx, ty, dt, speed) {
    const a = bot.ai;
    a.repathCool -= dt;
    if (!a.path.length || a.repathCool <= 0 || a._tx !== tx || a._ty !== ty) {
      a.path = GameMap.path(bot.x, bot.y, tx, ty);
      a.pi = 0; a.repathCool = 1.2; a._tx = tx; a._ty = ty;
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

  function nextTaskSpot(bot) {
    const undone = bot.tasks.find(t => !t.done);
    if (undone) return { x: undone.def.x, y: undone.def.y, task: undone };
    return null;
  }

  function wanderSpot(bot) {
    const a = bot.ai;
    if (!a._wander || Util.dist(bot.x, bot.y, a._wander.x, a._wander.y) < 50) {
      const r = Util.pick(ROOMS);
      a._wander = { x: r.x + Util.rand(40, r.w - 40), y: r.y + Util.rand(40, r.h - 40) };
    }
    return a._wander;
  }

  function update(bot, dt, world) {
    if (!bot.alive) return;
    const a = bot.ai;
    if (bot.killCooldown > 0) bot.killCooldown -= dt;
    bot.moving = false;

    // Crewmate (and impostor) report nearby unreported bodies — but impostors
    // avoid self-reporting their own fresh kills.
    for (const c of world.corpses) {
      if (c.reported) continue;
      const dd = Util.dist(bot.x, bot.y, c.x, c.y);
      if (dd < CFG.REPORT_RANGE) {
        if (!bot.isImpostor || (c.id !== a._lastVictim)) { world.report(bot, c); return; }
      }
    }

    if (bot.isImpostor) updateImpostor(bot, dt, world);
    else updateCrew(bot, dt, world);
  }

  function updateCrew(bot, dt, world) {
    const a = bot.ai;
    if (a.doing > 0) { a.doing -= dt; bot.moving = false; if (a.doing <= 0 && a._task) { a._task.done = true; a._task = null; } return; }
    const spot = nextTaskSpot(bot);
    if (spot) {
      const arrived = navigate(bot, spot.x, spot.y, dt, CFG.BOT_SPEED);
      if (arrived) { a.doing = Util.rand(1.8, 3.2); a._task = spot.task; }
    } else {
      const w = wanderSpot(bot); navigate(bot, w.x, w.y, dt, CFG.BOT_SPEED * 0.8);
    }
  }

  function updateImpostor(bot, dt, world) {
    const a = bot.ai;
    a.ventCool -= dt;

    // Find nearest living crewmate target.
    let target = null, bd = Infinity;
    for (const c of world.crew) {
      if (!c.alive || c.isImpostor || c === bot) continue;
      const d = Util.dist(bot.x, bot.y, c.x, c.y);
      if (d < bd) { bd = d; target = c; }
    }

    if (target) {
      // Count nearby witnesses (other crew besides the target).
      let witnesses = 0;
      for (const c of world.crew) {
        if (!c.alive || c.isImpostor || c === bot || c === target) continue;
        if (Util.dist(bot.x, bot.y, c.x, c.y) < 260) witnesses++;
      }
      navigate(bot, target.x, target.y, dt, CFG.BOT_SPEED * 1.04);

      if (bd < CFG.KILL_RANGE && bot.killCooldown <= 0 && witnesses === 0) {
        a._lastVictim = target.id;
        world.kill(bot, target);
        bot.killCooldown = CFG.KILL_COOLDOWN;
        // Try to slip into a vent to escape.
        if (a.ventCool <= 0) { const v = GameMap.ventAt(bot.x, bot.y, 140); if (v) a.ventCool = 8; }
        return;
      }
    } else {
      const w = wanderSpot(bot); navigate(bot, w.x, w.y, dt, CFG.BOT_SPEED * 0.85);
    }
  }

  /* Voting heuristic used during meetings. Returns a crewmate id to vote for,
   * or null to skip. */
  function vote(bot, world) {
    const alive = world.crew.filter(c => c.alive);
    if (bot.isImpostor) {
      // Vote a non-impostor, preferably the reporter or someone "accused".
      const targets = alive.filter(c => !c.isImpostor && c !== bot);
      if (world.accused && world.accused.alive && !world.accused.isImpostor) return world.accused.id;
      return targets.length ? Util.pick(targets).id : null;
    }
    // Crewmate: vote the accused/suspected, else often skip.
    if (world.accused && world.accused !== bot && world.accused.alive && Math.random() < 0.6) return world.accused.id;
    if (Math.random() < 0.4) { const others = alive.filter(c => c !== bot); return others.length ? Util.pick(others).id : null; }
    return null; // skip
  }

  return { update, vote };
})();
