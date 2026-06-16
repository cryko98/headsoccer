/* ============================================================================
 *  entities.js — Ball, Player and Goal. All art is procedurally drawn on the
 *  canvas (no sprite assets), themed per selected national team.
 * ========================================================================== */

class Ball {
  constructor() { this.reset(); }

  reset(x = CONFIG.WIDTH / 2, y = 180) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = CONFIG.BALL_RADIUS;
    this.rot = 0;
    this.lastTouch = null; // 'p1' | 'p2'
    this.trail = [];
  }

  update(dt) {
    this.vy += CONFIG.GRAVITY * dt;
    this.vx *= CONFIG.AIR_FRICTION;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vx * dt * 0.04;

    // Trail for fast shots.
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 600) {
      this.trail.push({ x: this.x, y: this.y, life: 1 });
      if (this.trail.length > 12) this.trail.shift();
    }
    for (const t of this.trail) t.life -= dt * 3;
    this.trail = this.trail.filter(t => t.life > 0);

    // Ground.
    if (this.y + this.r > CONFIG.GROUND_Y) {
      this.y = CONFIG.GROUND_Y - this.r;
      if (Math.abs(this.vy) > 60) { this.vy *= -CONFIG.BALL_RESTITUTION; Sound.bounce(); }
      else this.vy = 0;
      this.vx *= CONFIG.GROUND_FRICTION;
    }
    // Side walls.
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
    // Trail.
    for (const t of this.trail) {
      ctx.globalAlpha = t.life * 0.4;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.r * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(this.x, this.y);
    // Shadow on the pitch.
    const grndDist = CONFIG.GROUND_Y - this.y;
    const sScale = Physics.clamp(1 - grndDist / 600, 0.3, 1);
    ctx.save();
    ctx.translate(0, CONFIG.GROUND_Y - this.y);
    ctx.globalAlpha = 0.25 * sScale;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.r * sScale, this.r * 0.32 * sScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();

    ctx.rotate(this.rot);
    // Ball body.
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(-this.r * 0.3, -this.r * 0.3, this.r * 0.2, 0, 0, this.r);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#c9d2dc');
    ctx.fillStyle = grad; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#2b2f36'; ctx.stroke();
    // Pentagon pattern.
    ctx.fillStyle = '#1f2430';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const px = Math.cos(a) * this.r * 0.55;
      const py = Math.sin(a) * this.r * 0.55;
      ctx.beginPath(); ctx.arc(px, py, this.r * 0.16, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, this.r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

class Player {
  constructor(team, side, isAI) {
    this.team = team;
    this.side = side;            // 'left' | 'right'
    this.isAI = isAI;
    this.r = CONFIG.PLAYER_RADIUS;
    this.facing = side === 'left' ? 1 : -1;
    this.reset();
  }

  reset() {
    this.x = this.side === 'left' ? 230 : CONFIG.WIDTH - 230;
    this.y = CONFIG.GROUND_Y - this.r;
    this.vx = 0; this.vy = 0;
    this.onGround = true;
    this.kicking = 0;            // kick animation timer
    this.powerCharge = 0;        // 0..1
    this.legSwing = 0;
  }

  get footX() { return this.x + this.facing * this.r * 0.7; }
  get footY() { return this.y + this.r * 0.85; }

  update(dt, input) {
    // Horizontal movement.
    if (input.left)  this.vx = -CONFIG.MOVE_SPEED;
    else if (input.right) this.vx = CONFIG.MOVE_SPEED;
    else this.vx = 0;

    // Jump.
    if (input.jump && this.onGround) {
      this.vy = -CONFIG.JUMP_VELOCITY; this.onGround = false; Sound.jump();
    }

    // Power charge (hold shoot).
    if (input.shoot) this.powerCharge = Physics.clamp(this.powerCharge + dt / CONFIG.POWER_CHARGE_TIME, 0, 1);

    // Gravity.
    this.vy += CONFIG.GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Ground.
    if (this.y + this.r >= CONFIG.GROUND_Y) {
      this.y = CONFIG.GROUND_Y - this.r; this.vy = 0; this.onGround = true;
    }

    // Keep inside own half-ish bounds (full pitch allowed but not through walls).
    this.x = Physics.clamp(this.x, this.r + CONFIG.WALL_PAD, CONFIG.WIDTH - this.r - CONFIG.WALL_PAD);

    // Animations.
    if (this.kicking > 0) this.kicking -= dt;
    this.legSwing = this.kicking > 0 ? Physics.clamp(this.kicking / 0.22, 0, 1) : 0;
    if (Math.abs(this.vx) > 1) this.facing = this.vx > 0 ? 1 : -1;
  }

  // Try to kick the ball; returns the impulse applied (for SFX / FX).
  tryKick(ball, requestedPower) {
    const fx = this.footX, fy = this.footY;
    const d = Physics.dist(fx, fy, ball.x, ball.y);
    if (d > CONFIG.KICK_RANGE + ball.r) return 0;

    this.kicking = 0.22;
    let nx = ball.x - this.x;
    let ny = ball.y - this.y - this.r * 0.3;
    const mag = Math.hypot(nx, ny) || 1;
    nx /= mag; ny /= mag;

    // Bias the kick forward + up so it lifts toward goal.
    nx = nx * 0.6 + this.facing * 0.7;
    ny = ny * 0.5 - 0.6;
    const m2 = Math.hypot(nx, ny) || 1; nx /= m2; ny /= m2;

    const charged = requestedPower ? CONFIG.POWER_SHOT_MULT : 1;
    const power = CONFIG.KICK_POWER * charged * (0.85 + this.powerCharge * 0.6);
    ball.vx = nx * power;
    ball.vy = ny * power;
    ball.lastTouch = this.side === 'left' ? 'p1' : 'p2';

    const wasPower = requestedPower || this.powerCharge > 0.85;
    this.powerCharge = 0;
    return wasPower ? 2 : 1;
  }

  draw(ctx) {
    const t = this.team;
    ctx.save();
    ctx.translate(this.x, this.y);

    // Shadow.
    ctx.save();
    ctx.translate(0, CONFIG.GROUND_Y - this.y);
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.r * 0.95, this.r * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();

    // --- Cleat / boot (animated on kick) ---
    const swing = this.legSwing;
    const bootX = this.facing * (this.r * 0.55 + swing * 34);
    const bootY = this.r * 0.78 - swing * 18;
    ctx.save();
    ctx.translate(bootX, bootY);
    ctx.rotate(this.facing * swing * -0.7);
    ctx.fillStyle = '#10131a';
    ctx.beginPath();
    ctx.ellipse(this.facing * 8, 0, 22, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.accent;
    ctx.fillRect(-6, -4, 14, 5); // stripe
    ctx.restore();

    // --- Head (the body) ---
    // Jersey collar band beneath head.
    ctx.fillStyle = t.primary;
    ctx.beginPath();
    ctx.moveTo(-this.r * 0.9, this.r * 0.55);
    ctx.lineTo(this.r * 0.9, this.r * 0.55);
    ctx.lineTo(this.r * 0.7, this.r);
    ctx.lineTo(-this.r * 0.7, this.r);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = t.accent;
    ctx.fillRect(-this.r * 0.85, this.r * 0.55, this.r * 1.7, 6);

    // Skull.
    const skin = t.skin;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    const hg = ctx.createRadialGradient(-this.r * 0.3, -this.r * 0.4, this.r * 0.2, 0, 0, this.r);
    hg.addColorStop(0, this._lighten(skin, 18));
    hg.addColorStop(1, skin);
    ctx.fillStyle = hg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = this._darken(skin, 25); ctx.stroke();

    // Hair (team primary headband cap).
    ctx.fillStyle = this._darken(skin, 55);
    ctx.beginPath();
    ctx.arc(0, -this.r * 0.15, this.r, Math.PI * 1.08, Math.PI * 1.92);
    ctx.lineTo(this.r * 0.2, -this.r * 0.6);
    ctx.fill();
    // Team headband.
    ctx.fillStyle = t.primary;
    ctx.beginPath();
    ctx.arc(0, -this.r * 0.05, this.r * 0.98, Math.PI * 1.12, Math.PI * 1.88);
    ctx.lineWidth = 9; ctx.strokeStyle = t.primary; ctx.stroke();

    // Ear.
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(-this.facing * this.r * 0.92, this.r * 0.1, 7, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (look toward facing).
    const eo = this.facing * 6;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(this.facing * this.r * 0.18 + eo, -this.r * 0.05, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(this.facing * this.r * 0.5 + eo, -this.r * 0.05, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2a';
    ctx.beginPath(); ctx.arc(this.facing * this.r * 0.22 + eo, -this.r * 0.02, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(this.facing * this.r * 0.54 + eo, -this.r * 0.02, 4, 0, Math.PI * 2); ctx.fill();

    // Brow (determined look).
    ctx.strokeStyle = this._darken(skin, 55); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.facing * this.r * 0.05, -this.r * 0.28);
    ctx.lineTo(this.facing * this.r * 0.62, -this.r * 0.18);
    ctx.stroke();

    // Nose + mouth.
    ctx.strokeStyle = this._darken(skin, 35); ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.facing * this.r * 0.62, this.r * 0.05);
    ctx.lineTo(this.facing * this.r * 0.72, this.r * 0.22);
    ctx.lineTo(this.facing * this.r * 0.6, this.r * 0.26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(this.facing * this.r * 0.2, this.r * 0.5);
    ctx.quadraticCurveTo(this.facing * this.r * 0.5, this.r * 0.62, this.facing * this.r * 0.66, this.r * 0.46);
    ctx.stroke();

    // Power-charge aura.
    if (this.powerCharge > 0.05) {
      ctx.globalAlpha = this.powerCharge * 0.8;
      ctx.lineWidth = 3 + this.powerCharge * 4;
      ctx.strokeStyle = `hsl(${30 + this.powerCharge * 20}, 100%, 55%)`;
      ctx.beginPath();
      ctx.arc(0, 0, this.r + 8 + this.powerCharge * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  _lighten(hex, amt) { return this._shift(hex, amt); }
  _darken(hex, amt) { return this._shift(hex, -amt); }
  _shift(hex, amt) {
    const c = hex.replace('#', '');
    let r = parseInt(c.substr(0, 2), 16) + amt;
    let g = parseInt(c.substr(2, 2), 16) + amt;
    let b = parseInt(c.substr(4, 2), 16) + amt;
    r = Physics.clamp(r, 0, 255); g = Physics.clamp(g, 0, 255); b = Physics.clamp(b, 0, 255);
    return `rgb(${r|0},${g|0},${b|0})`;
  }
}

class Goal {
  constructor(side) {
    this.side = side;
    this.w = CONFIG.GOAL_WIDTH;
    this.h = CONFIG.GOAL_HEIGHT;
    this.x = side === 'left' ? CONFIG.WALL_PAD : CONFIG.WIDTH - CONFIG.WALL_PAD - this.w;
    this.y = CONFIG.GROUND_Y - this.h;
  }

  // The scoring mouth (inner area). A ball fully inside counts.
  contains(ball) {
    const innerX = this.side === 'left' ? this.x : this.x;
    return ball.x > this.x && ball.x < this.x + this.w &&
           ball.y > this.y && ball.y < CONFIG.GROUND_Y;
  }

  // Collide ball with the crossbar + back post so shots rattle the frame.
  collideFrame(ball) {
    const barY = this.y;
    // Crossbar (top of the net opening).
    if (ball.x > this.x - ball.r && ball.x < this.x + this.w + ball.r) {
      if (ball.y - ball.r < barY && ball.y > barY - 30 && ball.vy < 0) {
        ball.y = barY + ball.r; ball.vy = Math.abs(ball.vy) * 0.6; Sound.wall();
      }
    }
    // Back post (the vertical the net hangs from).
    const postX = this.side === 'left' ? this.x : this.x + this.w;
    if (ball.y > barY && Math.abs(ball.x - postX) < ball.r + 4) {
      // Only block from the field side so the ball can still enter the mouth.
    }
  }

  draw(ctx) {
    ctx.save();
    const x = this.x, y = this.y, w = this.w, h = this.h;
    // Net.
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= w; i += 9) {
      ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, CONFIG.GROUND_Y); ctx.stroke();
    }
    for (let j = 0; j <= h; j += 9) {
      ctx.beginPath(); ctx.moveTo(x, y + j); ctx.lineTo(x + w, y + j); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Frame (posts + crossbar).
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = 7; ctx.lineCap = 'round';
    const postX = this.side === 'left' ? x + w : x;     // front post (field side)
    const backX = this.side === 'left' ? x : x + w;     // back post (wall side)
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 6;
    // Crossbar.
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
    // Front post (the one that matters for the mouth).
    ctx.strokeStyle = '#ff4040';
    ctx.beginPath(); ctx.moveTo(postX, y); ctx.lineTo(postX, CONFIG.GROUND_Y); ctx.stroke();
    ctx.strokeStyle = '#f2f2f2';
    ctx.beginPath(); ctx.moveTo(backX, y); ctx.lineTo(backX, CONFIG.GROUND_Y); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
