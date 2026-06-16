/* ============================================================================
 *  ai.js — CPU opponent controller. Produces an input object identical in
 *  shape to player keyboard input so the Player class stays agnostic.
 * ========================================================================== */

class AIController {
  constructor(player, ball, difficulty) {
    this.p = player;
    this.ball = ball;
    this.cfg = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.reactTimer = 0;
    this.target = player.x;
    this.kickCooldown = 0;
  }

  setDifficulty(d) { this.cfg = DIFFICULTY[d] || DIFFICULTY.normal; }

  /* Returns { left, right, jump, shoot, power } and may directly request a
   * kick via game callback. We expose desired kick through `wantKick`. */
  think(dt) {
    const c = this.cfg;
    this.reactTimer -= dt;
    this.kickCooldown -= dt;

    const input = { left: false, right: false, jump: false, shoot: false, power: false, wantKick: false };
    const ball = this.ball;
    const ownGoalX = this.p.side === 'left' ? 0 : CONFIG.WIDTH; // defends this side
    const oppGoalX = this.p.side === 'left' ? CONFIG.WIDTH : 0;

    // Predict where the ball will be a moment ahead.
    const lead = 0.18;
    const predX = ball.x + ball.vx * lead;

    // Re-evaluate target only every reaction interval (simulates human delay).
    if (this.reactTimer <= 0) {
      this.reactTimer = c.reaction;
      const err = (Math.random() * 2 - 1) * c.errorPx;

      // Defensive: if the ball is heading toward our goal and is on our side, intercept.
      const onOurSide = this.p.side === 'left' ? ball.x < CONFIG.WIDTH * 0.45 : ball.x > CONFIG.WIDTH * 0.55;
      const ballComingHome = this.p.side === 'left' ? ball.vx < -40 : ball.vx > 40;

      if (onOurSide || ballComingHome) {
        // Get goal-side of the ball to clear it away.
        const goalSideOffset = this.p.side === 'left' ? -this.p.r * 0.4 : this.p.r * 0.4;
        this.target = predX + goalSideOffset + err;
      } else {
        // Ball on opponent half: hold a ready position a bit ahead of our goal.
        const homeX = this.p.side === 'left' ? CONFIG.WIDTH * 0.28 : CONFIG.WIDTH * 0.72;
        this.target = Physics.lerp(homeX, predX, 0.35) + err;
      }
      this.target = Physics.clamp(this.target, this.p.r + 20, CONFIG.WIDTH - this.p.r - 20);
    }

    // Move toward target.
    const dx = this.target - this.p.x;
    const dead = 14;
    if (dx < -dead) input.left = true;
    else if (dx > dead) input.right = true;

    // Speed scaling: temporarily nudge velocity via input only (Player applies MOVE_SPEED);
    // we emulate speedMult by sometimes skipping movement when slower than 1.
    if (c.speedMult < 1 && Math.random() > c.speedMult) { input.left = false; input.right = false; }

    // Jump logic: ball above and close, or to head a high ball toward goal.
    const dHead = Physics.dist(this.p.x, this.p.y, ball.x, ball.y);
    const ballAbove = ball.y < this.p.y - this.p.r * 0.4;
    if (this.p.onGround && ballAbove && dHead < this.p.r + ball.r + 60 && Math.random() < c.jumpChance) {
      input.jump = true;
    }

    // Kick logic: in range + roughly between ball and our goal → smash toward opp goal.
    const foot = Physics.dist(this.p.footX, this.p.footY, ball.x, ball.y);
    const facingRight = oppGoalX > this.p.x;
    // Make sure we are on the correct side of the ball to push it the right way.
    const goodSide = this.p.side === 'left' ? this.p.x <= ball.x + 10 : this.p.x >= ball.x - 10;

    if (foot < CONFIG.KICK_RANGE + ball.r && this.kickCooldown <= 0 && goodSide) {
      input.wantKick = true;
      // Power shot when there's a clear lane and decent reaction tier.
      input.power = Math.random() < (1 - c.kickWindow);
      this.kickCooldown = 0.3;
    } else if (foot < CONFIG.KICK_RANGE + ball.r + 40 && goodSide) {
      // Charge power while approaching.
      input.shoot = true;
    }

    // Ensure facing toward opponent goal when settled.
    if (!input.left && !input.right) {
      this.p.facing = facingRight ? 1 : -1;
    }

    return input;
  }
}
