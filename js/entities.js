/* ============================================================================
 *  entities.js — Crewmate (player + bots) and Corpse, with cosmetic hats and
 *  pets. Original round-helmet astronaut art.
 * ========================================================================== */

class Crewmate {
  constructor(opts) {
    this.id = opts.id;
    this.name = opts.name;
    this.color = opts.color;
    this.hat = opts.hat || 'none';
    this.pet = opts.pet || 'none';
    this.isPlayer = !!opts.isPlayer;
    this.isImpostor = !!opts.isImpostor;
    this.x = opts.x; this.y = opts.y;
    this.petPos = { x: this.x - 36, y: this.y };
    this.alive = true;
    this.facing = 1;
    this.walkPhase = 0;
    this.moving = false;
    this.scanFx = 0;            // visual-task animation timer

    this.ai = opts.isPlayer ? null : {
      mode: 'task', target: null, path: [], pi: 0, doing: 0,
      killCool: Util.rand(6, 16), ventCool: 0, repathCool: 0, _lastVictim: null, _wander: null,
    };
    this.killCooldown = this.isImpostor ? (opts.killCooldown || 24) : 0;
    this.tasks = [];
    this.usedEmergency = 0;
    this.inVent = false;
  }

  get tasksDone() { return this.tasks.filter(t => t.done).length; }
  get tasksTotal() { return this.tasks.length; }

  updatePet(dt) {
    if (this.pet === 'none') return;
    const tx = this.x - this.facing * 38, ty = this.y + 10;
    this.petPos.x = Util.lerp(this.petPos.x, tx, Math.min(1, dt * 6));
    this.petPos.y = Util.lerp(this.petPos.y, ty, Math.min(1, dt * 6));
  }

  drawPet(ctx) {
    if (this.pet === 'none') return;
    const p = this.petPos, t = performance.now() / 300;
    ctx.save(); ctx.translate(p.x, p.y + Math.sin(t) * 2);
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, 16, 12, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    const c = this.color.hex;
    if (this.pet === 'cube') { ctx.fillStyle = c; this._rr(ctx, -9, -9, 18, 18, 4); ctx.fill(); ctx.fillStyle = '#0e1016'; ctx.fillRect(-5, -3, 4, 4); ctx.fillRect(2, -3, 4, 4); }
    else if (this.pet === 'orb') { const g = ctx.createRadialGradient(-3, -3, 2, 0, 0, 12); g.addColorStop(0, '#bfe6ff'); g.addColorStop(1, c); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = this._shade(c, -10); this._rr(ctx, -10, -8, 20, 16, 5); ctx.fill(); ctx.fillStyle = '#4ad7e0'; ctx.fillRect(-6, -3, 12, 5); ctx.fillStyle = c; ctx.fillRect(-2, -14, 4, 6); }
    ctx.restore();
  }

  draw(ctx, { dim = false, highlight = null } = {}) {
    const r = CFG.PLAYER_R;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (dim) ctx.globalAlpha = 0.5;

    ctx.save(); ctx.globalAlpha *= 0.3; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, r * 0.95, r * 0.85, r * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    const f = this.facing;
    const bob = this.moving ? Math.sin(this.walkPhase) * 2 : 0;
    const legColor = this._shade(this.color.hex, -50);
    const swing = this.moving ? Math.sin(this.walkPhase) * 5 : 0;
    ctx.fillStyle = legColor;
    this._rr(ctx, -r * 0.5 - swing * 0.3, r * 0.55, r * 0.42, r * 0.55, 5); ctx.fill();
    this._rr(ctx, r * 0.1 + swing * 0.3, r * 0.55, r * 0.42, r * 0.55, 5); ctx.fill();

    ctx.translate(0, bob);

    const bg = ctx.createLinearGradient(0, -r * 0.2, 0, r * 0.9);
    bg.addColorStop(0, this._shade(this.color.hex, 24)); bg.addColorStop(1, this._shade(this.color.hex, -12));
    ctx.fillStyle = bg;
    this._rr(ctx, -r * 0.62, -r * 0.1, r * 1.24, r * 0.95, r * 0.42); ctx.fill();
    ctx.strokeStyle = this._shade(this.color.hex, -40); ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = this._shade(this.color.hex, 40);
    ctx.beginPath(); ctx.arc(0, r * 0.4, r * 0.18, 0, Math.PI * 2); ctx.fill();

    const hg = ctx.createRadialGradient(-r * 0.25, -r * 0.5, r * 0.15, 0, -r * 0.35, r * 0.85);
    hg.addColorStop(0, this._shade(this.color.hex, 30)); hg.addColorStop(1, this._shade(this.color.hex, -6));
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.72, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = this._shade(this.color.hex, -40); ctx.lineWidth = 2; ctx.stroke();

    ctx.save();
    ctx.translate(f * r * 0.12, -r * 0.4);
    const vg = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.2);
    vg.addColorStop(0, '#bfe6ff'); vg.addColorStop(0.5, '#7fb6e8'); vg.addColorStop(1, '#3f6fa8');
    ctx.fillStyle = vg;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.46, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#21364f'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(-r * 0.16, -r * 0.08, r * 0.12, r * 0.07, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (highlight === 'impostor') { ctx.fillStyle = '#ff2b3b'; ctx.beginPath(); ctx.arc(f * r * 0.05, -r * 0.4, r * 0.07, 0, Math.PI * 2); ctx.fill(); }

    this._drawHat(ctx, r, f);

    // Visual-task scan ring.
    if (this.scanFx > 0) {
      const k = 1 - this.scanFx / 2.2;
      ctx.strokeStyle = `rgba(120,230,255,${0.7 * this.scanFx / 2.2})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r + 6 + k * 40, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    if (!dim || highlight) {
      ctx.save();
      ctx.font = '700 13px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center';
      const tw = ctx.measureText(this.name).width;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; this._rr(ctx, this.x - tw / 2 - 6, this.y - r * 2.3, tw + 12, 18, 6); ctx.fill();
      ctx.fillStyle = highlight === 'me' ? '#ffe14a' : '#eef2fb';
      ctx.fillText(this.name, this.x, this.y - r * 2.3 + 13);
      ctx.textAlign = 'left'; ctx.restore();
    }
  }

  _drawHat(ctx, r, f) {
    const top = -r * 1.05;
    ctx.save();
    switch (this.hat) {
      case 'cap':
        ctx.fillStyle = '#e23b3b'; this._rr(ctx, -r * 0.5, top + 4, r, r * 0.4, 6); ctx.fill();
        ctx.fillStyle = '#b32a2a'; this._rr(ctx, f * r * 0.2, top + 16, f * r * 0.6, r * 0.18, 4); ctx.fill(); break;
      case 'tophat':
        ctx.fillStyle = '#1a1a22'; ctx.fillRect(-r * 0.7, top + 14, r * 1.4, 5);
        ctx.fillRect(-r * 0.34, top - 16, r * 0.68, 32); break;
      case 'band':
        ctx.fillStyle = '#33b14b'; this._rr(ctx, -r * 0.62, top + 12, r * 1.24, 8, 3); ctx.fill();
        ctx.fillStyle = '#e8ecf5'; ctx.fillRect(-r * 0.1, top + 12, 6, 8); break;
      case 'antenna':
        ctx.strokeStyle = '#888'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, top + 12); ctx.lineTo(0, top - 10); ctx.stroke();
        ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, top - 12, 5, 0, Math.PI * 2); ctx.fill(); break;
      case 'crown':
        ctx.fillStyle = '#ffd24a'; ctx.beginPath();
        ctx.moveTo(-r * 0.5, top + 16); ctx.lineTo(-r * 0.5, top - 2); ctx.lineTo(-r * 0.25, top + 8);
        ctx.lineTo(0, top - 8); ctx.lineTo(r * 0.25, top + 8); ctx.lineTo(r * 0.5, top - 2); ctx.lineTo(r * 0.5, top + 16);
        ctx.closePath(); ctx.fill(); break;
      case 'horn':
        ctx.fillStyle = '#e8ddc8'; ctx.beginPath(); ctx.moveTo(-4, top + 12); ctx.lineTo(4, top + 12); ctx.lineTo(0, top - 14); ctx.closePath(); ctx.fill(); break;
    }
    ctx.restore();
  }

  _shade(hex, amt) { const c = hex.replace('#', ''); let r = parseInt(c.substr(0, 2), 16) + amt, g = parseInt(c.substr(2, 2), 16) + amt, b = parseInt(c.substr(4, 2), 16) + amt; r = Util.clamp(r, 0, 255); g = Util.clamp(g, 0, 255); b = Util.clamp(b, 0, 255); return `rgb(${r|0},${g|0},${b|0})`; }
  _rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}

class Corpse {
  constructor(crew) { this.x = crew.x; this.y = crew.y; this.color = crew.color; this.id = crew.id; this.reported = false; }
  draw(ctx) {
    const r = CFG.PLAYER_R;
    ctx.save(); ctx.translate(this.x, this.y); ctx.globalAlpha = 0.95;
    ctx.fillStyle = 'rgba(140,20,28,0.5)'; ctx.beginPath(); ctx.ellipse(0, r * 0.4, r * 1.3, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(0.5);
    ctx.fillStyle = this._shade(this.color.hex, 6); this._rr(ctx, -r * 0.6, -r * 0.4, r * 1.1, r * 0.8, r * 0.4); ctx.fill();
    ctx.fillStyle = this._shade(this.color.hex, 20); ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.05, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e9edf4'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.1); ctx.lineTo(-r * 1.1, -r * 0.5); ctx.stroke();
    ctx.restore();
  }
  _shade(hex, amt) { const c = hex.replace('#', ''); let r = parseInt(c.substr(0, 2), 16) + amt, g = parseInt(c.substr(2, 2), 16) + amt, b = parseInt(c.substr(4, 2), 16) + amt; r = Util.clamp(r, 0, 255); g = Util.clamp(g, 0, 255); b = Util.clamp(b, 0, 255); return `rgb(${r|0},${g|0},${b|0})`; }
  _rr(ctx, x, y, w, h, rr) { ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath(); }
}
