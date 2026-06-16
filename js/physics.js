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

  /* Resolve an elastic-ish collision of the ball against a (heavier) circle
   * such as a player head. Pushes the ball out and reflects its velocity,
   * adding the player's own velocity so headers/kicks transfer momentum. */
  resolveBallCircle(ball, cx, cy, cr, cvx, cvy, restitution) {
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const minDist = ball.r + cr;
    let d = Math.sqrt(dx * dx + dy * dy);
    if (d >= minDist || d === 0) return false;

    const nx = dx / d;
    const ny = dy / d;

    // Positional correction — push ball to the circle's surface.
    const overlap = minDist - d;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    // Relative velocity along the normal.
    const rvx = ball.vx - cvx;
    const rvy = ball.vy - cvy;
    const velAlongNormal = rvx * nx + rvy * ny;
    if (velAlongNormal > 0) return true; // already separating

    const j = -(1 + restitution) * velAlongNormal;
    ball.vx += nx * j;
    ball.vy += ny * j;

    // Transfer a share of the mover's momentum (gives heads "weight").
    ball.vx += cvx * 0.45;
    ball.vy += cvy * 0.30;

    return true;
  },

  // Axis-aligned point-in-rect test.
  pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  },
};
