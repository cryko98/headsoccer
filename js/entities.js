/* ============================================================================
 *  entities.js — Ball, Player and Goal.
 *  Players are drawn as caricatured-but-realistic footballers: detailed head
 *  (skin shading, hairstyle, expressive face) over a kitted body with a number,
 *  shorts, socks and boots. All procedural — no sprite assets.
 * ========================================================================== */

class Ball {
  constructor() { this.reset(); }

  reset(x = CONFIG.WIDTH / 2, y = 170) {
    this.x = x; this.y = y;
    this.prevX = x; this.prevY = y;
    this.vx = 0; this.vy = 0;
    this.r = CONFIG.BALL_RADIUS;
    this.rot = 0;
    this.lastTouch = null;
    this.trail = [];
  }

  update(dt) {
    this.prevX = this.x; this.prevY = this.y;

    this.vy += CONFIG.GRAVITY * dt;
    this.vx *= CONFIG.AIR_FRICTION;
    Physics.clampSpeed(this, CONFIG.MAX_BALL_SPEED);

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vx * dt * 0.045;

    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 460) {
      this.trail.push({ x: this.x, y: this.y, life: 1 });
      if (this.trail.length > 10) this.trail.shift();
    }
    for (const t of this.trail) t.life -= dt * 3.2;
    this.trail = this.trail.filter(t => t.life > 0);

    // Ground.
    if (this.y + this.r > CONFIG.GROUND_Y) {
      this.y = CONFIG.GROUND_Y - this.r;
      if (Math.abs(this.vy) > 55) { this.vy *= -CONFIG.BALL_RESTITUTION; Sound.bounce(); }
      else this.vy = 0;
      this.vx *= CONFIG.GROUND_FRICTION;
    }
    // Walls.
    if (this.x - this.r < CONFIG.WALL_PAD) {
      this.x = CONFIG.WALL_PAD + this.r; this.vx = Math.abs(this.vx) * CONFIG.BALL_RESTITUTION; Sound.wall();
    }
    if (this.x + this.r > CONFIG.WIDTH - CONFIG.WALL_PAD) {
      this.x = CONFIG.WIDTH - CONFIG.WALL_PAD - this.r; this.vx = -Math.abs(this.vx) * CONFIG.BALL_RESTITUTION; Sound.wall();
    }
    // Ceiling.
    if (this.y - this.r < CONFIG.WALL_PAD) {
      this.y = CONFIG.WALL_PAD + this.r; this.vy = Math.abs(this.vy) * CONFIG.BALL_RESTITUTION;
    }
  }

  draw(ctx) {
    for (const t of this.trail) {
      ctx.globalAlpha = t.life * 0.30;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.r * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Shadow.
    const grndDist = CONFIG.GROUND_Y - this.y;
    const sScale = Physics.clamp(1 - grndDist / 620, 0.3, 1);
    ctx.save();
    ctx.translate(this.x, CONFIG.GROUND_Y - 2);
    ctx.globalAlpha = 0.22 * sScale;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.r * sScale, this.r * 0.28 * sScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(-this.r * 0.35, -this.r * 0.35, this.r * 0.2, 0, 0, this.r);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.7, '#eef1f5'); grad.addColorStop(1, '#c2cad6');
    ctx.fillStyle = grad; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(40,44,52,0.55)'; ctx.stroke();
    // Classic panels.
    ctx.fillStyle = '#222834';
    const cr = this.r * 0.34;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * cr, py = Math.sin(a) * cr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#222834';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * cr, Math.sin(a) * cr);
      ctx.lineTo(Math.cos(a) * this.r * 0.92, Math.sin(a) * this.r * 0.92);
      ctx.stroke();
    }
    ctx.restore();
  }
}

class Player {
  constructor(team, side, isAI) {
    this.team = team;
    this.side = side;
    this.isAI = isAI;
    this.r = CONFIG.PLAYER_RADIUS;
    this.facing = side === 'left' ? 1 : -1;
    this.number = side === 'left' ? 10 : 9;
    this.reset();
  }

  reset() {
    this.x = this.side === 'left' ? 250 : CONFIG.WIDTH - 250;
    this.y = CONFIG.GROUND_Y - this.r;
    this.vx = 0; this.vy = 0;
    this.onGround = true;
    this.kicking = 0;
    this.powerCharge = 0;
    this.runPhase = 0;
    this.kickCool = 0;
  }

  get footX() { return this.x + this.facing * this.r * 0.85; }
  get footY() { return CONFIG.GROUND_Y - 14; }

  update(dt, input) {
    const scale = input.speedScale != null ? input.speedScale : 1;
    if (input.left)  this.vx = -CONFIG.MOVE_SPEED * scale;
    else if (input.right) this.vx = CONFIG.MOVE_SPEED * scale;
    else this.vx = 0;

    if (input.jump && this.onGround) { this.vy = -CONFIG.JUMP_VELOCITY; this.onGround = false; Sound.jump(); }

    if (input.shoot) this.powerCharge = Physics.clamp(this.powerCharge + dt / CONFIG.POWER_CHARGE_TIME, 0, 1);

    this.vy += CONFIG.GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.y + this.r >= CONFIG.GROUND_Y) { this.y = CONFIG.GROUND_Y - this.r; this.vy = 0; this.onGround = true; }
    this.x = Physics.clamp(this.x, this.r + CONFIG.WALL_PAD, CONFIG.WIDTH - this.r - CONFIG.WALL_PAD);

    if (this.kicking > 0) this.kicking -= dt;
    if (this.kickCool > 0) this.kickCool -= dt;
    if (Math.abs(this.vx) > 1 && this.onGround) this.runPhase += dt * 12;
    else this.runPhase = Physics.lerp(this.runPhase, 0, dt * 8);
    if (Math.abs(this.vx) > 1) this.facing = this.vx > 0 ? 1 : -1;
  }

  tryKick(ball, requestedPower) {
    if (this.kickCool > 0) return 0;
    const d = Physics.dist(this.footX, this.footY, ball.x, ball.y);
    const dHead = Physics.dist(this.x, this.y, ball.x, ball.y);
    if (d > CONFIG.KICK_RANGE && dHead > this.r + ball.r + 30) return 0;

    this.kicking = 0.24;
    this.kickCool = CONFIG.KICK_COOLDOWN;

    // Direction: forward + lift, blended toward the ball.
    let nx = this.facing * 0.78 + (ball.x - this.x) / 120 * 0.3;
    let ny = -0.62 + (ball.y - this.y) / 200 * 0.2;
    const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;

    const charged = requestedPower ? CONFIG.POWER_SHOT_MULT : 1;
    const power = CONFIG.KICK_POWER * charged * (0.9 + this.powerCharge * 0.5);
    ball.vx = nx * power;
    ball.vy = ny * power;
    Physics.clampSpeed(ball, CONFIG.MAX_BALL_SPEED);
    ball.lastTouch = this.side === 'left' ? 'p1' : 'p2';

    const wasPower = requestedPower || this.powerCharge > 0.8;
    this.powerCharge = 0;
    return wasPower ? 2 : 1;
  }

  // ----------------------------------------------------------------- draw ---
  draw(ctx) {
    const t = this.team, r = this.r;
    const f = this.facing;
    const bob = this.onGround ? Math.sin(this.runPhase) * 2 : 0;
    const kick = this.kicking > 0 ? Physics.clamp(this.kicking / 0.24, 0, 1) : 0;

    ctx.save();
    ctx.translate(this.x, this.y + bob);

    // Ground shadow.
    ctx.save();
    ctx.translate(0, CONFIG.GROUND_Y - (this.y + bob));
    ctx.globalAlpha = 0.26;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.0, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();

    this._drawBody(ctx, t, r, f, kick);
    this._drawHead(ctx, t, r, f);

    // Power aura.
    if (this.powerCharge > 0.05) {
      ctx.globalAlpha = this.powerCharge * 0.7;
      ctx.lineWidth = 2 + this.powerCharge * 4;
      ctx.strokeStyle = `hsl(${42 - this.powerCharge * 30}, 100%, 55%)`;
      ctx.beginPath(); ctx.arc(0, -r * 0.15, r + 7 + this.powerCharge * 7, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  _drawBody(ctx, t, r, f, kick) {
    const torsoTop = r * 0.55;
    const torsoBottom = r * 1.65;
    const hipY = torsoBottom;
    const shoulderW = r * 1.18;

    // --- Legs (back leg static, front leg kicks) ---
    const legColor = '#2a2f3a';
    const sockColor = t.primary;
    const boot = '#15171d';

    // Back leg.
    this._leg(ctx, -f * r * 0.30, hipY, -f * r * 0.18, sockColor, boot, 0);
    // Front leg (kick swing).
    const swing = kick * 1.1;
    this._leg(ctx, f * r * 0.30, hipY, f * (r * 0.30 + swing * r * 0.7), sockColor, boot, -swing * 0.5 * f, kick);

    // Shorts.
    ctx.fillStyle = this._shade(t.primary, -34);
    this._roundRect(ctx, -r * 0.62, hipY - r * 0.32, r * 1.24, r * 0.55, 7); ctx.fill();
    ctx.fillStyle = t.secondary;
    ctx.fillRect(-r * 0.62, hipY - r * 0.05, r * 1.24, 4);

    // Torso (jersey).
    ctx.save();
    const jg = ctx.createLinearGradient(0, torsoTop, 0, hipY);
    jg.addColorStop(0, this._shade(t.primary, 16));
    jg.addColorStop(1, this._shade(t.primary, -10));
    ctx.fillStyle = jg;
    ctx.beginPath();
    ctx.moveTo(-shoulderW * 0.5, torsoTop + 4);
    ctx.quadraticCurveTo(-shoulderW * 0.5, torsoTop - 4, -shoulderW * 0.42, torsoTop - 2);
    ctx.lineTo(shoulderW * 0.42, torsoTop - 2);
    ctx.quadraticCurveTo(shoulderW * 0.5, torsoTop - 4, shoulderW * 0.5, torsoTop + 4);
    ctx.lineTo(r * 0.66, hipY - r * 0.28);
    ctx.quadraticCurveTo(0, hipY - r * 0.16, -r * 0.66, hipY - r * 0.28);
    ctx.closePath(); ctx.fill();

    // Side accent stripe.
    ctx.fillStyle = t.accent;
    ctx.fillRect(-shoulderW * 0.5, torsoTop, 5, r * 1.0);
    ctx.fillRect(shoulderW * 0.5 - 5, torsoTop, 5, r * 1.0);

    // Sleeves.
    ctx.fillStyle = this._shade(t.primary, -6);
    this._roundRect(ctx, -shoulderW * 0.5 - 6, torsoTop, 13, r * 0.5, 4); ctx.fill();
    this._roundRect(ctx, shoulderW * 0.5 - 7, torsoTop, 13, r * 0.5, 4); ctx.fill();
    ctx.fillStyle = t.accent;
    ctx.fillRect(-shoulderW * 0.5 - 6, torsoTop + r * 0.5 - 4, 13, 4);
    ctx.fillRect(shoulderW * 0.5 - 7, torsoTop + r * 0.5 - 4, 13, 4);

    // Collar.
    ctx.strokeStyle = t.secondary; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, torsoTop + 2, r * 0.24, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();

    // Jersey number.
    ctx.fillStyle = this._readable(t.primary);
    ctx.font = `900 ${Math.round(r * 0.5)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(this.number), 0, torsoTop + r * 0.62);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.restore();

    // Neck.
    ctx.fillStyle = this._shade(t.skin, -14);
    ctx.fillRect(-r * 0.16, r * 0.42, r * 0.32, r * 0.2);
  }

  _leg(ctx, hipX, hipY, footX, sock, boot, rot, kick = 0) {
    ctx.save();
    ctx.translate(hipX, hipY - r0(this) * 0);
    ctx.rotate(rot);
    const len = this.r * 0.42;
    // Sock.
    ctx.strokeStyle = sock; ctx.lineWidth = 11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo((footX - hipX) * 0.5, len * 0.7); ctx.lineTo(footX - hipX, len); ctx.stroke();
    // Sock band.
    ctx.strokeStyle = this.team.secondary; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo((footX - hipX) * 0.12, len * 0.16); ctx.stroke();
    // Boot.
    ctx.fillStyle = boot;
    ctx.save();
    ctx.translate(footX - hipX, len);
    ctx.beginPath();
    ctx.ellipse(this.facing * 6, 2, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.team.accent;
    ctx.fillRect(this.facing * -4, -2, 9, 3);
    ctx.restore();
    ctx.restore();
  }

  _drawHead(ctx, t, r, f) {
    ctx.save();
    // Head skull with skin gradient.
    const sg = ctx.createRadialGradient(-f * r * 0.3, -r * 0.4, r * 0.25, 0, -r * 0.05, r * 1.05);
    sg.addColorStop(0, this._shade(t.skin, 20));
    sg.addColorStop(0.7, t.skin);
    sg.addColorStop(1, this._shade(t.skin, -26));
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.08, r * 0.94, r, 0, 0, Math.PI * 2);
    ctx.fillStyle = sg; ctx.fill();

    // Jaw / cheek subtle shading.
    ctx.globalAlpha = 0.12; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(-f * r * 0.1, r * 0.45, r * 0.7, r * 0.4, 0, 0, Math.PI); ctx.fill();
    ctx.globalAlpha = 1;

    // Ear (back side).
    ctx.fillStyle = t.skin;
    ctx.beginPath(); ctx.ellipse(-f * r * 0.9, r * 0.02, 7, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = this._shade(t.skin, -30); ctx.lineWidth = 1.5; ctx.stroke();

    this._drawHair(ctx, t, r, f);

    // Eyebrow.
    ctx.strokeStyle = this._shade(t.hair, -10); ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(f * r * 0.06, -r * 0.30);
    ctx.quadraticCurveTo(f * r * 0.34, -r * 0.40, f * r * 0.62, -r * 0.28);
    ctx.stroke();

    // Eye (white + iris + pupil tracking forward).
    const ex = f * r * 0.4, ey = -r * 0.08;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(ex, ey, 11, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a3320';
    ctx.beginPath(); ctx.arc(ex + f * 3, ey + 1, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10131a';
    ctx.beginPath(); ctx.arc(ex + f * 4, ey + 1, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex + f * 2, ey - 2, 1.4, 0, Math.PI * 2); ctx.fill();
    // Far eye hint.
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(f * r * 0.04, ey + 1, 6, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10131a';
    ctx.beginPath(); ctx.arc(f * r * 0.06, ey + 2, 2.4, 0, Math.PI * 2); ctx.fill();

    // Nose.
    ctx.strokeStyle = this._shade(t.skin, -34); ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(f * r * 0.66, r * 0.0);
    ctx.lineTo(f * r * 0.78, r * 0.2);
    ctx.lineTo(f * r * 0.62, r * 0.26);
    ctx.stroke();

    // Mouth (slight grit).
    ctx.strokeStyle = this._shade(t.skin, -42); ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(f * r * 0.14, r * 0.52);
    ctx.quadraticCurveTo(f * r * 0.44, r * 0.6, f * r * 0.66, r * 0.46);
    ctx.stroke();

    // Light stubble shadow for darker-haired players.
    if (this.team.hairStyle !== 4) {
      ctx.globalAlpha = 0.10; ctx.fillStyle = this.team.hair;
      ctx.beginPath(); ctx.ellipse(f * r * 0.28, r * 0.55, r * 0.5, r * 0.26, 0, 0, Math.PI); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  _drawHair(ctx, t, r, f) {
    const hc = t.hair, style = t.hairStyle;
    ctx.fillStyle = hc;
    ctx.strokeStyle = this._shade(hc, -18);
    ctx.lineWidth = 1;
    if (style === 4) return; // bald

    if (style === 3) { // curly / afro — bumpy crown
      ctx.beginPath();
      for (let a = -Math.PI * 0.98; a <= Math.PI * 0.02; a += 0.18) {
        const rr = r * (1.02 + 0.10 * Math.sin(a * 7));
        const px = Math.cos(a) * rr, py = -r * 0.08 + Math.sin(a) * rr;
        a === -Math.PI * 0.98 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      return;
    }

    if (style === 5) { // long — comes down the sides
      ctx.beginPath();
      ctx.moveTo(-r * 0.96, r * 0.5);
      ctx.quadraticCurveTo(-r * 1.05, -r * 0.7, 0, -r * 1.02);
      ctx.quadraticCurveTo(r * 1.05, -r * 0.7, r * 0.96, r * 0.5);
      ctx.quadraticCurveTo(r * 0.7, -r * 0.1, 0, -r * 0.2);
      ctx.quadraticCurveTo(-r * 0.7, -r * 0.1, -r * 0.96, r * 0.5);
      ctx.closePath(); ctx.fill();
      return;
    }

    // 0 short, 1 buzz, 2 swept — a crown cap with a fringe.
    const thick = style === 1 ? 0.06 : 0.16;
    ctx.beginPath();
    ctx.arc(0, -r * 0.08, r * 0.96, Math.PI * 1.04, Math.PI * 1.96);
    // fringe edge
    if (style === 2) {
      ctx.quadraticCurveTo(f * r * 0.5, -r * 0.5, f * r * 0.86, -r * 0.18);
      ctx.quadraticCurveTo(f * r * 0.4, -r * (0.5 - thick), 0, -r * (0.55 - thick));
    } else {
      ctx.lineTo(r * 0.0, -r * (0.62 - thick));
    }
    ctx.closePath(); ctx.fill();
    // Sideburn.
    ctx.fillRect(-f * r * 0.86, -r * 0.1, f * 5, r * 0.3);
  }

  // --- color + shape helpers ---
  _shade(hex, amt) {
    const c = hex.replace('#', '');
    let r = parseInt(c.substr(0, 2), 16) + amt;
    let g = parseInt(c.substr(2, 2), 16) + amt;
    let b = parseInt(c.substr(4, 2), 16) + amt;
    r = Physics.clamp(r, 0, 255); g = Physics.clamp(g, 0, 255); b = Physics.clamp(b, 0, 255);
    return `rgb(${r|0},${g|0},${b|0})`;
  }
  _readable(bgHex) {
    const c = bgHex.replace('#', '');
    const lum = 0.299 * parseInt(c.substr(0, 2), 16) + 0.587 * parseInt(c.substr(2, 2), 16) + 0.114 * parseInt(c.substr(4, 2), 16);
    return lum > 150 ? '#1a1a1a' : '#ffffff';
  }
  _roundRect(ctx, x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
}

// tiny helper so _leg can read player radius without a closure rewrite.
function r0(p) { return p.r; }

class Goal {
  constructor(side) {
    this.side = side;
    this.w = CONFIG.GOAL_WIDTH;
    this.h = CONFIG.GOAL_HEIGHT;
    this.x = side === 'left' ? CONFIG.WALL_PAD : CONFIG.WIDTH - CONFIG.WALL_PAD - this.w;
    this.y = CONFIG.GROUND_Y - this.h;
  }

  contains(ball) {
    return ball.x > this.x + 3 && ball.x < this.x + this.w - 3 &&
           ball.y > this.y + 4 && ball.y < CONFIG.GROUND_Y;
  }

  // Crossbar acts as a solid lip: blocks balls dropping in from directly above.
  collideFrame(ball) {
    const barY = this.y;
    const inSpan = ball.x > this.x - 2 && ball.x < this.x + this.w + 2;
    if (inSpan && ball.vy > 0 &&
        ball.y - ball.r < barY && ball.prevY - ball.r <= barY - 2) {
      ball.y = barY - ball.r;
      ball.vy = -Math.abs(ball.vy) * 0.4;
      Sound.wall();
    }
  }

  draw(ctx) {
    ctx.save();
    const x = this.x, y = this.y, w = this.w;
    // Net.
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= w; i += 8) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, CONFIG.GROUND_Y); ctx.stroke(); }
    for (let j = 0; j <= this.h; j += 8) { ctx.beginPath(); ctx.moveTo(x, y + j); ctx.lineTo(x + w, y + j); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // Frame.
    ctx.lineCap = 'round'; ctx.lineWidth = 6;
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 6;
    const frontX = this.side === 'left' ? x + w : x;
    const backX = this.side === 'left' ? x : x + w;
    ctx.strokeStyle = '#eef1f5';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();    // crossbar
    ctx.beginPath(); ctx.moveTo(backX, y); ctx.lineTo(backX, CONFIG.GROUND_Y); ctx.stroke();
    ctx.strokeStyle = '#ff4d5e';
    ctx.beginPath(); ctx.moveTo(frontX, y); ctx.lineTo(frontX, CONFIG.GROUND_Y); ctx.stroke(); // front post
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
