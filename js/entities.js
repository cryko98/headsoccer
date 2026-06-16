/* ============================================================================
 *  entities.js — Crewmate (player + bots) and Corpse.
 *  Original character: a round-helmeted little astronaut (own design).
 * ========================================================================== */

class Crewmate {
  constructor(opts) {
    this.id = opts.id;
    this.name = opts.name;
    this.color = opts.color;        // {id,name,hex}
    this.isPlayer = !!opts.isPlayer;
    this.isImpostor = !!opts.isImpostor;
    this.x = opts.x; this.y = opts.y;
    this.alive = true;
    this.facing = 1;
    this.walkPhase = 0;
    this.moving = false;

    // bot state
    this.ai = opts.isPlayer ? null : {
      mode: 'task', target: null, path: [], pi: 0,
      taskList: [], doing: 0, killCool: Util.rand(6, 16),
      ventCool: 0, repathCool: 0, suspicion: {}, sawBodyAt: null,
    };
    this.killCooldown = this.isImpostor ? CFG.KILL_COOLDOWN : 0;
    this.tasks = [];                // assigned task instances {def, done}
    this.usedEmergency = 0;
    this.inVent = false;
  }

  get tasksDone() { return this.tasks.filter(t => t.done).length; }
  get tasksTotal() { return this.tasks.length; }

  draw(ctx, { dim = false, highlight = null } = {}) {
    const r = CFG.PLAYER_R;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (dim) ctx.globalAlpha = 0.5;

    // Shadow.
    ctx.save(); ctx.globalAlpha *= 0.3;
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, r * 0.95, r * 0.85, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    const f = this.facing;
    const bob = this.moving ? Math.sin(this.walkPhase) * 2 : 0;

    // Legs.
    const legColor = this._shade(this.color.hex, -50);
    ctx.fillStyle = legColor;
    const swing = this.moving ? Math.sin(this.walkPhase) * 5 : 0;
    this._roundRect(ctx, -r * 0.5 - swing * 0.3, r * 0.55, r * 0.42, r * 0.55, 5); ctx.fill();
    this._roundRect(ctx, r * 0.1 + swing * 0.3, r * 0.55, r * 0.42, r * 0.55, 5); ctx.fill();

    ctx.translate(0, bob);

    // Body / suit.
    const bg = ctx.createLinearGradient(0, -r * 0.2, 0, r * 0.9);
    bg.addColorStop(0, this._shade(this.color.hex, 24));
    bg.addColorStop(1, this._shade(this.color.hex, -12));
    ctx.fillStyle = bg;
    this._roundRect(ctx, -r * 0.62, -r * 0.1, r * 1.24, r * 0.95, r * 0.42); ctx.fill();
    ctx.strokeStyle = this._shade(this.color.hex, -40); ctx.lineWidth = 2; ctx.stroke();
    // Chest emblem.
    ctx.fillStyle = this._shade(this.color.hex, 40);
    ctx.beginPath(); ctx.arc(0, r * 0.4, r * 0.18, 0, Math.PI * 2); ctx.fill();

    // Helmet.
    const hg = ctx.createRadialGradient(-r * 0.25, -r * 0.5, r * 0.15, 0, -r * 0.35, r * 0.85);
    hg.addColorStop(0, this._shade(this.color.hex, 30));
    hg.addColorStop(1, this._shade(this.color.hex, -6));
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.72, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = this._shade(this.color.hex, -40); ctx.lineWidth = 2; ctx.stroke();

    // Visor.
    ctx.save();
    ctx.translate(f * r * 0.12, -r * 0.4);
    const vg = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.2);
    vg.addColorStop(0, '#bfe6ff'); vg.addColorStop(0.5, '#7fb6e8'); vg.addColorStop(1, '#3f6fa8');
    ctx.fillStyle = vg;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.46, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#21364f'; ctx.lineWidth = 2; ctx.stroke();
    // Visor glare.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(-r * 0.16, -r * 0.08, r * 0.12, r * 0.07, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Impostor eyes hint when revealed (player only knows own role; game passes highlight).
    if (highlight === 'impostor') {
      ctx.fillStyle = '#ff2b3b';
      ctx.beginPath(); ctx.arc(f * r * 0.05, -r * 0.4, r * 0.07, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();

    // Name tag.
    if (!dim || highlight) {
      ctx.save();
      ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(this.name).width;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      this._roundRect(ctx, this.x - tw / 2 - 6, this.y - r * 2.1, tw + 12, 18, 6); ctx.fill();
      ctx.fillStyle = highlight === 'me' ? '#ffe14a' : '#eef2fb';
      ctx.fillText(this.name, this.x, this.y - r * 2.1 + 13);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  _shade(hex, amt) {
    const c = hex.replace('#', '');
    let r = parseInt(c.substr(0, 2), 16) + amt, g = parseInt(c.substr(2, 2), 16) + amt, b = parseInt(c.substr(4, 2), 16) + amt;
    r = Util.clamp(r, 0, 255); g = Util.clamp(g, 0, 255); b = Util.clamp(b, 0, 255);
    return `rgb(${r|0},${g|0},${b|0})`;
  }
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

class Corpse {
  constructor(crew) {
    this.x = crew.x; this.y = crew.y;
    this.color = crew.color;
    this.id = crew.id;
    this.reported = false;
  }
  draw(ctx) {
    const r = CFG.PLAYER_R;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = 0.95;
    // Pool.
    ctx.fillStyle = 'rgba(140,20,28,0.5)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.4, r * 1.3, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    // Fallen body (lying).
    ctx.rotate(0.5);
    const bg = this._shade(this.color.hex, 6);
    ctx.fillStyle = bg;
    this._roundRect(ctx, -r * 0.6, -r * 0.4, r * 1.1, r * 0.8, r * 0.4); ctx.fill();
    ctx.fillStyle = this._shade(this.color.hex, 20);
    ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.05, r * 0.5, 0, Math.PI * 2); ctx.fill();
    // little bone sticking up for the classic look.
    ctx.strokeStyle = '#e9edf4'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.1); ctx.lineTo(-r * 1.1, -r * 0.5); ctx.stroke();
    ctx.restore();
  }
  _shade(hex, amt) {
    const c = hex.replace('#', '');
    let r = parseInt(c.substr(0, 2), 16) + amt, g = parseInt(c.substr(2, 2), 16) + amt, b = parseInt(c.substr(4, 2), 16) + amt;
    r = Util.clamp(r, 0, 255); g = Util.clamp(g, 0, 255); b = Util.clamp(b, 0, 255);
    return `rgb(${r|0},${g|0},${b|0})`;
  }
  _roundRect(ctx, x, y, w, h, rr) {
    ctx.beginPath(); ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
  }
}
