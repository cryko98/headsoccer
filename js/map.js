/* ============================================================================
 *  map.js — active-map floor: rendering, collision, vents, doors, waypoint
 *  graph for bots. Works on whichever map is loaded via GameMap.load(map).
 * ========================================================================== */

const GameMap = (() => {
  let M = null;            // active map
  let rects = [];
  let nodes = [];
  let vents = [];
  let closedDoors = [];    // {room, timer} sabotaged-closed rooms

  function load(map) {
    M = map;
    rects = [...M.rooms, ...M.corridors];
    nodes = rects.map(r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2, rect: r, adj: [] }));
    const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++)
        if (overlap(rects[i], rects[j])) { nodes[i].adj.push(j); nodes[j].adj.push(i); }
    vents = [];
    M.ventGroups.forEach((g, gi) => g.forEach(v => vents.push({ x: v.x, y: v.y, room: v.room, group: gi })));
    closedDoors = [];
  }

  function map() { return M; }
  function inWalkable(x, y) {
    for (const r of rects) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
    return false;
  }
  function roomAt(x, y) { return M.rooms.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h); }

  function nodeIndexAt(x, y) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const r = nodes[i].rect;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { const d = Util.dist(x, y, nodes[i].x, nodes[i].y); if (d < bd) { bd = d; best = i; } }
    }
    if (best >= 0) return best;
    for (let i = 0; i < nodes.length; i++) { const d = Util.dist(x, y, nodes[i].x, nodes[i].y); if (d < bd) { bd = d; best = i; } }
    return best;
  }

  function path(sx, sy, tx, ty) {
    const s = nodeIndexAt(sx, sy), t = nodeIndexAt(tx, ty);
    if (s < 0 || t < 0) return [{ x: tx, y: ty }];
    const prev = new Array(nodes.length).fill(-2); prev[s] = -1;
    const q = [s];
    while (q.length) { const c = q.shift(); if (c === t) break; for (const n of nodes[c].adj) if (prev[n] === -2) { prev[n] = c; q.push(n); } }
    if (prev[t] === -2) return [{ x: tx, y: ty }];
    const chain = []; for (let c = t; c !== -1; c = prev[c]) chain.unshift(nodes[c]);
    const pts = chain.map(n => ({ x: n.x, y: n.y })); pts.push({ x: tx, y: ty });
    return pts;
  }

  // Move with wall sliding + closed-door blocking (can't leave a closed room).
  function move(e, dx, dy) {
    const room = roomAt(e.x, e.y);
    const blockedRoom = closedDoors.find(d => room && d.room === room.id);
    const allowed = (nx, ny) => {
      if (!inWalkable(nx, ny)) return false;
      if (blockedRoom) { const r = M.rooms.find(rr => rr.id === blockedRoom.room); if (!(nx > r.x && nx < r.x + r.w && ny > r.y && ny < r.y + r.h)) return false; }
      return true;
    };
    if (allowed(e.x + dx, e.y + dy)) { e.x += dx; e.y += dy; return; }
    if (allowed(e.x + dx, e.y)) { e.x += dx; return; }
    if (allowed(e.x, e.y + dy)) { e.y += dy; return; }
  }

  function ventAt(x, y, range = CFG.INTERACT_RANGE) { return vents.find(v => Util.dist(x, y, v.x, v.y) < range); }

  function closeDoors(roomId, secs) { closedDoors = closedDoors.filter(d => d.room !== roomId); closedDoors.push({ room: roomId, timer: secs }); }
  function updateDoors(dt) { for (const d of closedDoors) d.timer -= dt; closedDoors = closedDoors.filter(d => d.timer > 0); }
  function doorsOf() { return closedDoors; }

  // ---------------------------------------------------------------- render ---
  function drawFloor(ctx) {
    for (const r of rects) { ctx.fillStyle = '#0c1220'; roundRect(ctx, r.x - 10, r.y - 10, r.w + 20, r.h + 20, 22); ctx.fill(); }
    for (const r of rects) {
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, '#26324a'); g.addColorStop(1, '#1c2740');
      ctx.fillStyle = g; roundRect(ctx, r.x, r.y, r.w, r.h, 14); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (const r of M.rooms) {
      for (let x = r.x + 40; x < r.x + r.w; x += 40) { ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); }
      for (let y = r.y + 40; y < r.y + r.h; y += 40) { ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke(); }
    }
    ctx.strokeStyle = '#4a5d82'; ctx.lineWidth = 4;
    for (const r of rects) { roundRect(ctx, r.x, r.y, r.w, r.h, 14); ctx.stroke(); }
    ctx.fillStyle = 'rgba(180,200,240,0.5)'; ctx.font = '700 22px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center';
    for (const r of M.rooms) ctx.fillText(r.name.toUpperCase(), r.x + r.w / 2, r.y + 34);
    ctx.textAlign = 'left';

    // Closed doors (red barriers across room edges).
    for (const d of closedDoors) {
      const r = M.rooms.find(rr => rr.id === d.room); if (!r) continue;
      ctx.strokeStyle = 'rgba(255,70,90,0.85)'; ctx.lineWidth = 7;
      roundRect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 14); ctx.stroke();
    }
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

  function drawDevices(ctx, sab) {
    // Emergency buttons.
    for (const b of M.buttonSpots) {
      ctx.save(); ctx.translate(b.x, b.y);
      ctx.fillStyle = '#1a2238'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#586a90'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#e2333a'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '800 11px "Segoe UI"'; ctx.textAlign = 'center'; ctx.fillText('SOS', 0, 4); ctx.textAlign = 'left';
      ctx.restore();
    }
    // Security console.
    const sr = M.rooms.find(r => r.id === M.securityRoom);
    if (sr) { ctx.save(); ctx.translate(sr.x + sr.w - 40, sr.y + sr.h - 36);
      ctx.fillStyle = '#11202c'; roundRect(ctx, -26, -18, 52, 36, 6); ctx.fill();
      ctx.strokeStyle = '#3aa6c4'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#4ad7e0'; ctx.font = '700 9px "Segoe UI"'; ctx.textAlign = 'center'; ctx.fillText('CAMS', 0, 3); ctx.textAlign = 'left';
      ctx.restore(); M._secConsole = { x: sr.x + sr.w - 40, y: sr.y + sr.h - 36 };
    }
    // Sabotage fix consoles (lit when active).
    const litRooms = sab && sab.type === 'reactor' ? M.reactorRooms : sab && sab.type === 'lights' ? [M.lightsRoom] : sab && sab.type === 'comms' ? [M.commsRoom] : [];
    for (const rid of litRooms) {
      const r = M.rooms.find(x => x.id === rid); if (!r) continue;
      const fx = r.x + 44, fy = r.y + r.h - 34;
      ctx.save(); ctx.translate(fx, fy);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      ctx.fillStyle = `rgba(255,70,90,${0.5 + pulse * 0.5})`; roundRect(ctx, -22, -16, 44, 32, 6); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  return { load, map, path, move, ventAt, vents: () => vents, inWalkable, roomAt,
           closeDoors, updateDoors, doorsOf, drawFloor, drawVents, drawDevices, roundRect };
})();
