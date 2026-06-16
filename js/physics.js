/* ============================================================================
 *  physics.js — lightweight 2D math + collision helpers
 * ========================================================================== */

const Physics = {
  clamp(v, min, max) { return v < min ? min : v > max ? max : v; },
  lerp(a, b, t) { return a + (b - a) * t; },

  dist(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  },

  // Cap a ball's speed so shots stay readable and never tunnel through walls.
  clampSpeed(ball, max) {
    const s = Math.hypot(ball.vx, ball.vy);
    if (s > max) { const k = max / s; ball.vx *= k; ball.vy *= k; }
  },

  /* Resolve the ball against a heavier moving circle (a player head).
   * Pushes the ball to the surface and reflects velocity, transferring a
   * measured share of the mover's momentum so headers feel weighty without
   * launching the ball off-screen. Returns true on contact. */
  resolveBallCircle(ball, cx, cy, cr, cvx, cvy, restitution) {
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const minDist = ball.r + cr;
    let d = Math.sqrt(dx * dx + dy * dy);
    if (d >= minDist) return false;

    // Degenerate exact-overlap: push straight up.
    let nx, ny;
    if (d < 0.0001) { nx = 0; ny = -1; d = 0.0001; }
    else { nx = dx / d; ny = dy / d; }

    // Positional correction.
    const overlap = minDist - d;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    // Relative velocity along the contact normal.
    const rvx = ball.vx - cvx;
    const rvy = ball.vy - cvy;
    const velAlongNormal = rvx * nx + rvy * ny;

    if (velAlongNormal < 0) {
      const j = -(1 + restitution) * velAlongNormal;
      ball.vx += nx * j;
      ball.vy += ny * j;
    }

    // Transfer a modest share of the player's motion (gentle, tuned).
    ball.vx += cvx * 0.22;
    ball.vy += cvy * 0.14;

    // Anti-stick: guarantee a small separating velocity so the ball never
    // gets pinned inside the head.
    const sep = ball.vx * nx + ball.vy * ny;
    if (sep < 30) { ball.vx += nx * (30 - sep); ball.vy += ny * (30 - sep); }

    return true;
  },

  pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  },
};
