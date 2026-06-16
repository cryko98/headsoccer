/* ============================================================================
 *  map.js — station floor: rendering, collision, vents, and a waypoint graph
 *  used by bot navigation.
 * ========================================================================== */

const GameMap = (() => {
  const rects = [...ROOMS, ...CORRIDORS];
  let nodes = [];     // {x,y,rect,adj:[indices]}
  const vents = [];   // {x,y,room,group}

  function build() {
    nodes = rects.map(r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2, rect: r, adj: [] }));
    const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++)
        if (overlap(rects[i], rects[j])) { nodes[i].adj.push(j); nodes[j].adj.push(i); }

    vents.length = 0;
    VENT_GROUPS.forEach((g, gi) => g.forEach(v => vents.push({ x: v.x, y: v.y, room: v.room, group: gi })));
  }

  function nodeIndexAt(x, y) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const r = nodes[i].rect;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        const d = Util.dist(x, y, nodes[i].x, nodes[i].y);
        if (d < bd) { bd = d; best = i; }
      }
    }
    if (best >= 0) return best;
    // fall back to nearest node centre
    for (let i = 0; i < nodes.length; i++) { const d = Util.dist(x, y, nodes[i].x, nodes[i].y); if (d < bd) { bd = d; best = i; } }
    return best;
  }

  // BFS path of waypoint coords from (sx,sy) to (tx,ty).
  function path(sx, sy, tx, ty) {
    const s = nodeIndexAt(sx, sy), t = nodeIndexAt(tx, ty);
    if (s < 0 || t < 0) return [{ x: tx, y: ty }];
    const prev = new Array(nodes.length).fill(-2); prev[s] = -1;
    const q = [s];
    while (q.length) {
      const c = q.shift();
      if (c === t) break;
      for (const n of nodes[c].adj) if (prev[n] === -2) { prev[n] = c; q.push(n); }
    }
    if (prev[t] === -2) return [{ x: tx, y: ty }];
    const chain = [];
    for (let c = t; c !== -1; c = prev[c]) chain.unshift(nodes[c]);
    const pts = chain.map(n => ({ x: n.x, y: n.y }));
    pts.push({ x: tx, y: ty });
    return pts;
  }

  // Move an entity by (dx,dy) with wall sliding.
  function move(e, dx, dy) {
    if (Util.inWalkable(e.x + dx, e.y + dy)) { e.x += dx; e.y += dy; return; }
    if (Util.inWalkable(e.x + dx, e.y)) { e.x += dx; return; }
    if (Util.inWalkable(e.x, e.y + dy)) { e.y += dy; return; }
  }

  function ventAt(x, y, range = CFG.INTERACT_RANGE) {
    return vents.find(v => Util.dist(x, y, v.x, v.y) < range);
  }

  // ---------------------------------------------------------------- render ---
  function drawFloor(ctx) {
    // Outer glow / hull.
    for (const r of rects) {
      ctx.fillStyle = '#0c1220';
      roundRect(ctx, r.x - 10, r.y - 10, r.w + 20, r.h + 20, 22); ctx.fill();
    }
    // Floor panels.
    for (const r of rects) {
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, '#26324a'); g.addColorStop(1, '#1c2740');
      ctx.fillStyle = g;
      roundRect(ctx, r.x, r.y, r.w, r.h, 14); ctx.fill();
    }
    // Floor tile lines (rooms only).
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (const r of ROOMS) {
      for (let x = r.x + 40; x < r.x + r.w; x += 40) { ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); }
      for (let y = r.y + 40; y < r.y + r.h; y += 40) { ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke(); }
    }
    // Wall outlines.
    ctx.strokeStyle = '#4a5d82'; ctx.lineWidth = 4;
    for (const r of rects) { roundRect(ctx, r.x, r.y, r.w, r.h, 14); ctx.stroke(); }

    // Room labels.
    ctx.fillStyle = 'rgba(180,200,240,0.5)';
    ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const r of ROOMS) ctx.fillText(r.name.toUpperCase(), r.x + r.w / 2, r.y + 34);
    ctx.textAlign = 'left';
  }

  function drawVents(ctx) {
    for (const v of vents) {
      ctx.save(); ctx.translate(v.x, v.y);
      ctx.fillStyle = '#11161f'; roundRect(ctx, -20, -16, 40, 32, 5); ctx.fill();
      ctx.strokeStyle = '#3a4860'; ctx.lineWidth = 2;
      for (let i = -12; i <= 12; i += 6) { ctx.beginPath(); ctx.moveTo(i, -14); ctx.lineTo(i, 14); ctx.stroke(); }
      ctx.restore();
    }
  }

  function drawEmergency(ctx) {
    const b = EMERGENCY_BTN;
    ctx.save(); ctx.translate(b.x, b.y);
    ctx.fillStyle = '#1a2238'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#586a90'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#e2333a'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '800 11px "Segoe UI"'; ctx.textAlign = 'center';
    ctx.fillText('SOS', 0, 4); ctx.textAlign = 'left';
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return { build, path, move, ventAt, vents, drawFloor, drawVents, drawEmergency, roundRect, nodeIndexAt };
})();
