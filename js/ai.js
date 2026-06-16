/* ============================================================================
 *  ai.js — CPU opponent controller. Emits the same input shape as the player
 *  keyboard, plus `speedScale` (movement multiplier) and `wantKick`.
 * ========================================================================== */

class AIController {
  constructor(player, ball, difficulty) {
    this.p = player;
    this.ball = ball;
    this.cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.reactTimer = 0;
    this.target = player.x;
    this.jumpCool = 0;
  }

  setDifficulty(d) { this.cfg = DIFFICULTY[d] || DIFFICULTY.normal; }

  think(dt) {
    const c = this.cfg, p = this.p, ball = this.ball;
    this.reactTimer -= dt;
    this.jumpCool -= dt;

    const input = { left: false, right: false, jump: false, shoot: false, power: false, wantKick: false, speedScale: c.speedMult };

    const defendX = p.side === 'left' ? CONFIG.WIDTH * 0.26 : CONFIG.WIDTH * 0.74;
    const ourHalf = p.side === 'left' ? ball.x < CONFIG.WIDTH * 0.5 : ball.x > CONFIG.WIDTH * 0.5;

    // Predict ball a beat ahead; recompute target on the reaction clock.
    if (this.reactTimer <= 0) {
      this.reactTimer = c.reaction;
      const err = (Math.random() * 2 - 1) * c.errorPx;
      const predX = ball.x + ball.vx * 0.16;

      if (ourHalf) {
        // Get goal-side of the ball so a kick clears it away from our net.
        const goalSide = p.side === 'left' ? -p.r * 0.55 : p.r * 0.55;
        this.target = predX + goalSide + err;
      } else {
        // Hold a ready line, drift slightly toward play.
        this.target = Physics.lerp(defendX, predX, 0.30) + err;
      }
      this.target = Physics.clamp(this.target, p.r + 16, CONFIG.WIDTH - p.r - 16);
    }

    // Move toward target with a deadzone.
    const dx = this.target - p.x;
    if (dx < -16) input.left = true;
    else if (dx > 16) input.right = true;

    // Jump to meet a high ball or header it forward.
    const dHead = Physics.dist(p.x, p.y, ball.x, ball.y);
    const ballAbove = ball.y < p.y - p.r * 0.35;
    if (p.onGround && this.jumpCool <= 0 && ballAbove && dHead < p.r + ball.r + 70 &&
        Math.random() < c.jumpChance) {
      input.jump = true; this.jumpCool = 0.6;
    }

    // Are we positioned to push the ball toward the opponent goal?
    const goodSide = p.side === 'left' ? p.x <= ball.x + 12 : p.x >= ball.x - 12;
    const foot = Physics.dist(p.footX, p.footY, ball.x, ball.y);
    const reach = foot < CONFIG.KICK_RANGE || dHead < p.r + ball.r + 26;

    if (reach && goodSide) {
      input.wantKick = true;
      input.power = Math.random() < c.aggression * 0.6;
    } else if (foot < CONFIG.KICK_RANGE + 50 && goodSide) {
      input.shoot = true; // charge while closing in
    }

    if (!input.left && !input.right) p.facing = (p.side === 'left') ? 1 : -1;
    return input;
  }
}
