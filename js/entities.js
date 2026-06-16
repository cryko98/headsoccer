/* ============================================================================
 *  entities.js — Ball, Player, Goal.
 *  Style target: classic "big-head" arcade footballers — a large expressive
 *  head over a very small kitted body (jersey, shorts, boots). Cool, focused
 *  faces (hair, brows, beard) rather than goofy. All procedural, no sprites.
 * ========================================================================== */

class Ball {
  constructor() { this.reset(); }

  reset(x = CONFIG.WIDTH / 2, y = 200) {
    this.x = x; this.y = y;
    this.prevX = x; this.prevY = y;
    this.vx = 0; this.vy = 0;
    this.r = CONFIG.BALL_RADIUS;
    this.rot = 0;
    this.lastTouch = null;
    this.restTimer = 0;
    this.trail = [];
  }

  update(dt) {
    this.prevX = this.x; this.prevY = this.y;

    this.vy += CONFIG.GRAVITY * dt;
    this.vx *= CONFIG.AIR_FRICTION;
    Physics.clampSpeed(this, CONFIG.MAX_BALL_SPEED);

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vx * dt * 0.05;

    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 440) {
      this.trail.push({ x: this.x, y: this.y, life: 1 });
      if (this.trail.length > 10) this.trail.shift();
    }
    for (const t of this.trail) t.life -= dt * 3.2;
    this.trail = this.trail.filter(t => t.life > 0);

    const onFloor = this.y + this.r >= CONFIG.GROUND_Y - 1;

    // Ground.
    if (this.y + this.r > CONFIG.GROUND_Y) {
      this.y = CONFIG.GROUND_Y - this.r;
      if (Math.abs(this.vy) > 55) { this.vy *= -CONFIG.BALL_RESTITUTION; Sound.bounce(); }
      else this.vy = 0;
      this.vx *= CONFIG.GROUND_FRICTION;
    }
    // Walls.
    if (this.x - this.r < CONFIG.WALL_PAD) { this.x = CONFIG.WALL_PAD + this.r; this.vx = Math.abs(this.vx) * CONFIG.BALL_RESTITUTION; Sound.wall(); }
    if (this.x + this.r > CONFIG.WIDTH - CONFIG.WALL_PAD) { this.x = CONFIG.WIDTH - CONFIG.WALL_PAD - this.r; this.vx = -Math.abs(this.vx) * CONFIG.BALL_RESTITUTION; Sound.wall(); }
    // Ceiling.
    if (this.y - this.r < CONFIG.HORIZON - 40) { this.y = CONFIG.HORIZON - 40 + this.r; this.vy = Math.abs(this.vy) * CONFIG.BALL_RESTITUTION; }

    // Liveliness: never let the ball sit dead — nudge it back into play.
    if (onFloor && speed < 36) {
      this.restTimer += dt;
      if (this.restTimer > CONFIG.BALL_LIVELINESS) {
        const toCenter = this.x < CONFIG.WIDTH / 2 ? 1 : -1;
        this.vx += toCenter * 150;
        this.vy = -230;
        this.restTimer = 0;
      }
    } else this.restTimer = 0;
  }

  draw(ctx) {
    for (const t of this.trail) {
      ctx.globalAlpha = t.life * 0.28;
      ctx.beginPath(); ctx.arc(t.x, t.y, this.r * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
    }
    ctx.globalAlpha = 1;

    const grndDist = CONFIG.GROUND_Y - this.y;
    const sScale = Physics.clamp(1 - grndDist / 560, 0.3, 1);
    ctx.save();
    ctx.translate(this.x, CONFIG.GROUND_Y - 2);
    ctx.globalAlpha = 0.22 * sScale;
    ctx.beginPath(); ctx.ellipse(0, 0, this.r * sScale, this.r * 0.26 * sScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(-this.r * 0.35, -this.r * 0.35, this.r * 0.2, 0, 0, this.r);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.7, '#eef1f5'); grad.addColorStop(1, '#bfc8d4');
    ctx.fillStyle = grad; ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(40,44,52,0.5)'; ctx.stroke();
    ctx.fillStyle = '#222834';
    const cr = this.r * 0.36;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; const px = Math.cos(a) * cr, py = Math.sin(a) * cr; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#222834';
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * cr, Math.sin(a) * cr); ctx.lineTo(Math.cos(a) * this.r * 0.92, Math.sin(a) * this.r * 0.92); ctx.stroke(); }
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

  get groundY() { return CONFIG.GROUND_Y - this.r - CONFIG.BODY_H; }

  reset() {
    this.x = this.side === 'left' ? 250 : CONFIG.WIDTH - 250;
    this.y = this.groundY;
    this.vx = 0; this.vy = 0;
    this.onGround = true;
    this.kicking = 0;
    this.powerCharge = 0;
    this.runPhase = 0;
    this.kickCool = 0;
  }

  get footX() { return this.x + this.facing * this.r * 0.8; }
  get footY() { return CONFIG.GROUND_Y - 10; }

  update(dt, input) {
    const scale = input.speedScale != null ? input.speedScale : 1;
    if (input.left) this.vx = -CONFIG.MOVE_SPEED * scale;
    else if (input.right) this.vx = CONFIG.MOVE_SPEED * scale;
    else this.vx = 0;

    if (input.jump && this.onGround) { this.vy = -CONFIG.JUMP_VELOCITY; this.onGround = false; Sound.jump(); }
    if (input.shoot) this.powerCharge = Physics.clamp(this.powerCharge + dt / CONFIG.POWER_CHARGE_TIME, 0, 1);

    this.vy += CONFIG.GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.y >= this.groundY) { this.y = this.groundY; this.vy = 0; this.onGround = true; }
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

    this.kicking = 0.26;
    this.kickCool = CONFIG.KICK_COOLDOWN;

    let nx = this.facing * 0.8 + (ball.x - this.x) / 120 * 0.3;
    let ny = -0.6 + (ball.y - this.y) / 200 * 0.2;
    const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;

    const charged = requestedPower ? CONFIG.POWER_SHOT_MULT : 1;
    const power = CONFIG.KICK_POWER * charged * (0.9 + this.powerCharge * 0.5);
    ball.vx = nx * power; ball.vy = ny * power;
    Physics.clampSpeed(ball, CONFIG.MAX_BALL_SPEED);
    ball.lastTouch = this.side === 'left' ? 'p1' : 'p2';

    const wasPower = requestedPower || this.powerCharge > 0.8;
    this.powerCharge = 0;
    return wasPower ? 2 : 1;
  }

  // ----------------------------------------------------------------- draw ---
  draw(ctx) {
    const t = this.team, r = this.r, f = this.facing;
    const bob = this.onGround ? Math.sin(this.runPhase) * 1.5 : 0;
    const kick = this.kicking > 0 ? Physics.clamp(this.kicking / 0.26, 0, 1) : 0;

    ctx.save();
    ctx.translate(this.x, this.y + bob);

    // Ground shadow.
    ctx.save();
    ctx.translate(0, (r + CONFIG.BODY_H));
    ctx.globalAlpha = 0.28;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.86, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();

    this._drawBody(ctx, t, r, f, kick);
    this._drawHead(ctx, t, r, f);

    if (this.powerCharge > 0.05) {
      ctx.globalAlpha = this.powerCharge * 0.7;
      ctx.lineWidth = 2 + this.powerCharge * 4;
      ctx.strokeStyle = `hsl(${42 - this.powerCharge * 30}, 100%, 55%)`;
      ctx.beginPath(); ctx.arc(0, 0, r + 6 + this.powerCharge * 7, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // Tiny kitted body under the head: feet rest at local y = r + BODY_H.
  _drawBody(ctx, t, r, f, kick) {
    const feetY = r + CONFIG.BODY_H;       // local ground
    const torsoTop = r * 0.74;
    const torsoBot = feetY - 6;
    const shoulderW = r * 0.92;

    // Legs (short stubs). Front leg swings on kick.
    const sock = t.primary, boot = '#15171d';
    this._leg(ctx, -f * r * 0.22, torsoBot - 2, -f * r * 0.16, feetY, sock, boot, 0);
    const sw = kick;
    this._leg(ctx, f * r * 0.22, torsoBot - 2, f * (r * 0.22 + sw * r * 0.5), feetY - sw * 8, sock, boot, sw);

    // Shorts.
    ctx.fillStyle = this._shade(t.primary, -36);
    this._roundRect(ctx, -shoulderW * 0.5, torsoBot - r * 0.28, shoulderW, r * 0.34, 5); ctx.fill();

    // Jersey torso.
    const jg = ctx.createLinearGradient(0, torsoTop, 0, torsoBot);
    jg.addColorStop(0, this._shade(t.primary, 18)); jg.addColorStop(1, this._shade(t.primary, -10));
    ctx.fillStyle = jg;
    ctx.beginPath();
    ctx.moveTo(-shoulderW * 0.5, torsoTop + 3);
    ctx.quadraticCurveTo(-shoulderW * 0.52, torsoTop - 5, -shoulderW * 0.34, torsoTop - 4);
    ctx.lineTo(shoulderW * 0.34, torsoTop - 4);
    ctx.quadraticCurveTo(shoulderW * 0.52, torsoTop - 5, shoulderW * 0.5, torsoTop + 3);
    ctx.lineTo(shoulderW * 0.42, torsoBot - r * 0.18);
    ctx.quadraticCurveTo(0, torsoBot - r * 0.1, -shoulderW * 0.42, torsoBot - r * 0.18);
    ctx.closePath(); ctx.fill();

    // Side accent stripes + collar + tiny number.
    ctx.fillStyle = t.accent;
    ctx.fillRect(-shoulderW * 0.5, torsoTop, 4, r * 0.5);
    ctx.fillRect(shoulderW * 0.5 - 4, torsoTop, 4, r * 0.5);
    ctx.strokeStyle = t.secondary; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, torsoTop, r * 0.2, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke();
    ctx.fillStyle = this._readable(t.primary);
    ctx.font = `900 ${Math.round(r * 0.3)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(this.number), 0, torsoTop + r * 0.28);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    // Neck.
    ctx.fillStyle = this._shade(t.skin, -16);
    ctx.fillRect(-r * 0.14, r * 0.6, r * 0.28, r * 0.2);
  }

  _leg(ctx, hipX, hipY, footX, footY, sock, boot, kick) {
    ctx.save();
    ctx.strokeStyle = sock; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(footX, footY - 4); ctx.stroke();
    ctx.fillStyle = boot;
    ctx.beginPath(); ctx.ellipse(footX + this.facing * 5, footY, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = this.team.accent;
    ctx.fillRect(footX - 3, footY - 2, 7, 2.5);
    ctx.restore();
  }

  _drawHead(ctx, t, r, f) {
    ctx.save();

    // Skull (slight egg shape, chin toward bottom).
    const sg = ctx.createRadialGradient(-f * r * 0.28, -r * 0.35, r * 0.25, 0, 0, r * 1.06);
    sg.addColorStop(0, this._shade(t.skin, 22));
    sg.addColorStop(0.72, t.skin);
    sg.addColorStop(1, this._shade(t.skin, -28));
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.88, r * 0.98, 0, 0, Math.PI * 2);
    ctx.fillStyle = sg; ctx.fill();

    // Cheek/jaw soft shadow.
    ctx.globalAlpha = 0.10; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(-f * r * 0.08, r * 0.42, r * 0.62, r * 0.36, 0, 0, Math.PI); ctx.fill();
    ctx.globalAlpha = 1;

    // Ear (back side) with inner detail.
    ctx.fillStyle = t.skin;
    ctx.beginPath(); ctx.ellipse(-f * r * 0.84, r * 0.06, 6.5, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = this._shade(t.skin, -34); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(-f * r * 0.84, r * 0.06, 3.4, Math.PI * 0.2, Math.PI * 1.4); ctx.stroke();

    this._drawHair(ctx, t, r, f);
    if (t.beard) this._drawBeard(ctx, t, r, f);

    // Eyebrow — angled, focused.
    ctx.strokeStyle = this._shade(t.hair, -6); ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(f * r * 0.08, -r * 0.26);
    ctx.quadraticCurveTo(f * r * 0.32, -r * 0.34, f * r * 0.56, -r * 0.24);
    ctx.stroke();
    // Far brow hint.
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-f * r * 0.16, -r * 0.24);
    ctx.lineTo(-f * r * 0.02, -r * 0.27);
    ctx.stroke();

    // Eyes — almond, modest size, focused forward.
    this._eye(ctx, f * r * 0.36, -r * 0.06, 1.0, f);
    this._eye(ctx, -f * r * 0.04, -r * 0.05, 0.72, f);

    // Nose — shaded, projecting toward facing.
    ctx.strokeStyle = this._shade(t.skin, -30); ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(f * r * 0.46, -r * 0.02);
    ctx.lineTo(f * r * 0.56, r * 0.16);
    ctx.lineTo(f * r * 0.42, r * 0.2);
    ctx.stroke();
    ctx.globalAlpha = 0.12; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(f * r * 0.5, r * 0.16, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Mouth — firm, determined.
    ctx.strokeStyle = this._shade(t.skin, -44); ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(f * r * 0.06, r * 0.46);
    ctx.quadraticCurveTo(f * r * 0.3, r * 0.5, f * r * 0.5, r * 0.42);
    ctx.stroke();

    ctx.restore();
  }

  _eye(ctx, cx, cy, s, f) {
    ctx.save();
    ctx.translate(cx, cy);
    // sclera (almond)
    ctx.fillStyle = '#f7f7fb';
    ctx.beginPath();
    ctx.ellipse(0, 0, 9 * s, 6.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    // iris + pupil toward facing
    ctx.fillStyle = '#5a3b22';
    ctx.beginPath(); ctx.arc(f * 2.5 * s, 0.5 * s, 4.4 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0e1016';
    ctx.beginPath(); ctx.arc(f * 3 * s, 0.5 * s, 2.4 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(f * 1.6 * s, -1.6 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
    // upper lid line
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(0, -0.5 * s, 9 * s, 6.5 * s, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.restore();
  }

  _drawHair(ctx, t, r, f) {
    const hc = t.hair, style = t.hairStyle;
    if (style === 4) return; // bald
    const dark = this._shade(hc, -16), lite = this._shade(hc, 24);

    ctx.save();
    ctx.fillStyle = hc; ctx.strokeStyle = dark; ctx.lineWidth = 1;

    if (style === 3) { // afro / curly
      ctx.beginPath();
      for (let a = -Math.PI * 1.02; a <= Math.PI * 0.02; a += 0.16) {
        const rr = r * (1.0 + 0.11 * Math.sin(a * 7));
        const px = Math.cos(a) * rr, py = -r * 0.05 + Math.sin(a) * rr;
        a === -Math.PI * 1.02 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    } else if (style === 5) { // long
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, r * 0.55);
      ctx.quadraticCurveTo(-r * 1.04, -r * 0.7, 0, -r * 1.0);
      ctx.quadraticCurveTo(r * 1.04, -r * 0.7, r * 0.9, r * 0.55);
      ctx.quadraticCurveTo(r * 0.66, -r * 0.08, 0, -r * 0.18);
      ctx.quadraticCurveTo(-r * 0.66, -r * 0.08, -r * 0.9, r * 0.55);
      ctx.closePath(); ctx.fill();
    } else {
      // 0 short, 1 buzz, 2 swept — crown cap with a natural hairline + fringe.
      const drop = style === 1 ? 0.12 : 0.2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.86, -r * 0.04);
      ctx.quadraticCurveTo(-r * 0.9, -r * 0.92, 0, -r * 1.0);
      ctx.quadraticCurveTo(r * 0.9, -r * 0.92, r * 0.86, -r * 0.04);
      if (style === 2) { // side-swept fringe toward facing
        ctx.quadraticCurveTo(f * r * 0.5, -r * 0.42, f * r * 0.72, -r * 0.12);
        ctx.quadraticCurveTo(f * r * 0.2, -r * (0.42 - drop), -f * r * 0.1, -r * (0.5 - drop));
        ctx.quadraticCurveTo(-f * r * 0.5, -r * (0.46 - drop), -f * r * 0.78, -r * 0.18);
      } else {
        ctx.quadraticCurveTo(f * r * 0.5, -r * (0.5 - drop), f * r * 0.5, -r * (0.5 - drop));
        ctx.quadraticCurveTo(0, -r * (0.62 - drop), -f * r * 0.5, -r * (0.5 - drop));
      }
      ctx.closePath(); ctx.fill();
    }
    // Highlight sheen.
    ctx.globalAlpha = 0.18; ctx.fillStyle = lite;
    ctx.beginPath(); ctx.ellipse(f * r * 0.2, -r * 0.6, r * 0.34, r * 0.16, -f * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Sideburn.
    ctx.fillStyle = hc;
    ctx.fillRect(f * r * 0.74, -r * 0.1, f * 5, r * 0.26);
    ctx.fillRect(-f * r * 0.82, -r * 0.1, -f * 5, r * 0.3);
    ctx.restore();
  }

  _drawBeard(ctx, t, r, f) {
    ctx.save();
    ctx.fillStyle = this._shade(t.hair, -4);
    // Jaw-framing beard.
    ctx.beginPath();
    ctx.moveTo(-r * 0.78, r * 0.06);
    ctx.quadraticCurveTo(-r * 0.7, r * 0.72, 0, r * 0.92);
    ctx.quadraticCurveTo(r * 0.7, r * 0.72, r * 0.78, r * 0.06);
    ctx.quadraticCurveTo(r * 0.5, r * 0.34, 0, r * 0.36);
    ctx.quadraticCurveTo(-r * 0.5, r * 0.34, -r * 0.78, r * 0.06);
    ctx.closePath(); ctx.fill();
    // Mustache.
    ctx.fillRect(-r * 0.32, r * 0.34, r * 0.64, r * 0.1);
    ctx.restore();
  }

  // helpers
  _shade(hex, amt) {
    const c = hex.replace('#', '');
    let r = parseInt(c.substr(0, 2), 16) + amt, g = parseInt(c.substr(2, 2), 16) + amt, b = parseInt(c.substr(4, 2), 16) + amt;
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

class Goal {
  constructor(side) {
    this.side = side;
    this.w = CONFIG.GOAL_WIDTH;
    this.h = CONFIG.GOAL_HEIGHT;
    this.depth = CONFIG.GOAL_DEPTH;
    this.x = side === 'left' ? CONFIG.WALL_PAD : CONFIG.WIDTH - CONFIG.WALL_PAD - this.w;
    this.y = CONFIG.GROUND_Y - this.h; // crossbar
  }

  contains(ball) {
    return ball.x > this.x + 3 && ball.x < this.x + this.w - 3 &&
           ball.y > this.y + 4 && ball.y < CONFIG.GROUND_Y;
  }

  collideFrame(ball) {
    const barY = this.y;
    const inSpan = ball.x > this.x - 2 && ball.x < this.x + this.w + 2;
    if (inSpan && ball.vy > 0 && ball.y - ball.r < barY && ball.prevY - ball.r <= barY - 2) {
      ball.y = barY - ball.r; ball.vy = -Math.abs(ball.vy) * 0.4; Sound.wall();
    }
  }

  // 3D-ish net standing on the green pitch.
  draw(ctx) {
    const x = this.x, y = this.y, w = this.w, g = CONFIG.GROUND_Y;
    const dx = this.side === 'left' ? -this.depth : this.depth; // depth toward the wall
    const dy = -16;
    const frontX = this.side === 'left' ? x + w : x;  // field-side post (mouth)
    const backX  = this.side === 'left' ? x : x + w;  // wall-side post

    ctx.save();

    // Back panel of the net (receding).
    ctx.fillStyle = 'rgba(8,14,22,0.30)';
    ctx.beginPath();
    ctx.moveTo(backX, y); ctx.lineTo(backX + dx, y + dy);
    ctx.lineTo(backX + dx, g + dy); ctx.lineTo(backX, g);
    ctx.closePath(); ctx.fill();

    // Top panel.
    ctx.fillStyle = 'rgba(20,30,44,0.22)';
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w, y);
    ctx.lineTo(x + w + dx, y + dy); ctx.lineTo(x + dx, y + dy);
    ctx.closePath(); ctx.fill();

    // Net mesh on the front opening.
    ctx.strokeStyle = 'rgba(255,255,255,0.42)'; ctx.lineWidth = 1;
    for (let i = 0; i <= w; i += 8) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, g); ctx.stroke(); }
    for (let j = 0; j <= this.h; j += 8) { ctx.beginPath(); ctx.moveTo(x, y + j); ctx.lineTo(x + w, y + j); ctx.stroke(); }
    // Diagonal hint on the receding back.
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    for (let j = 0; j <= this.h; j += 14) { ctx.beginPath(); ctx.moveTo(backX, y + j); ctx.lineTo(backX + dx, y + j + dy); ctx.stroke(); }

    // Frame.
    ctx.lineCap = 'round'; ctx.lineWidth = 6;
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
    // Back uprights + crossbar (white).
    ctx.strokeStyle = '#e7ebf0';
    ctx.beginPath(); ctx.moveTo(backX + dx, y + dy); ctx.lineTo(backX + dx, g + dy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(backX, y); ctx.lineTo(backX + dx, y + dy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(backX, y); ctx.lineTo(backX, g); ctx.stroke();
    // Crossbar (front).
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
    // Front post (red, the scoring mouth).
    ctx.strokeStyle = '#ff4d5e'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(frontX, y); ctx.lineTo(frontX, g); ctx.stroke();
    ctx.shadowBlur = 0;

    // Base contact shadow on the grass.
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse((x + w / 2), g, w * 0.7, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
