/* ============================================================================
 *  input.js — keyboard state for movement + action edge events.
 * ========================================================================== */

const Input = (() => {
  const keys = {};
  const edges = {};   // one-shot action flags consumed by the game loop

  function down(code) {
    if (!keys[code]) {
      // rising edge
      if (code === 'KeyE' || code === 'Space') edges.use = true;
      if (code === 'KeyQ') edges.kill = true;
      if (code === 'KeyR') edges.report = true;
      if (code === 'KeyF') edges.sabotage = true;
      if (code === 'KeyM') edges.map = true;
      if (code === 'Tab') edges.tasks = true;
      if (code === 'Escape') edges.escape = true;
    }
    keys[code] = true;
  }
  function up(code) { keys[code] = false; }

  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    down(e.code);
  });
  window.addEventListener('keyup', e => up(e.code));
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  return {
    axis() {
      let x = 0, y = 0;
      if (keys.ArrowLeft || keys.KeyA) x -= 1;
      if (keys.ArrowRight || keys.KeyD) x += 1;
      if (keys.ArrowUp || keys.KeyW) y -= 1;
      if (keys.ArrowDown || keys.KeyS) y += 1;
      if (x && y) { const m = Math.SQRT1_2; x *= m; y *= m; }
      return { x, y };
    },
    consume(name) { if (edges[name]) { edges[name] = false; return true; } return false; },
    press(name) { edges[name] = true; },   // HUD buttons mirror keyboard actions
    clear() { for (const k in edges) edges[k] = false; },
  };
})();
