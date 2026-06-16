/* ============================================================================
 *  room.js — pure game-flow authority for online matches (no socket code, so
 *  it is unit-testable). Rooms manages many Room instances + a timer tick.
 * ========================================================================== */
'use strict';

function code4() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

class Room {
  constructor(code) {
    this.code = code;
    this.players = [];             // {id,conn,name,color,hat,pet,host,role,alive,tasksDone,tasksTotal,killCool,emergencyUses,vote,pos}
    this.phase = 'lobby';          // lobby | play | meeting | over
    this.settings = null;
    this.sabotage = { type: null, timer: 0, fixers: [] };
    this.meeting = null;           // {phase,timer,reporterId,bodyId}
  }
  get host() { return this.players.find(p => p.host); }
  alive() { return this.players.filter(p => p.alive); }
  aliveImp() { return this.players.filter(p => p.alive && p.role === 'impostor'); }
  aliveCrew() { return this.players.filter(p => p.alive && p.role !== 'impostor'); }
  pub() { return this.players.map(p => ({ id: p.id, name: p.name, color: p.color, hat: p.hat, pet: p.pet, host: p.host, alive: p.alive })); }
  taskPct() { let t = 0, d = 0; for (const p of this.players) if (p.role !== 'impostor') { t += p.tasksTotal; d += p.tasksDone; } return t ? Math.round(d / t * 100) : 0; }
  taskDoneAll() { let t = 0, d = 0; for (const p of this.players) if (p.role !== 'impostor') { t += p.tasksTotal; d += p.tasksDone; } return t > 0 && d >= t; }
}

class Rooms {
  constructor(broadcast, sendTo) {
    this.broadcast = broadcast; this.sendTo = sendTo;
    this.map = new Map();          // code -> Room
    this._t = setInterval(() => this.tick(0.1), 100);
  }

  find(code) { return this.map.get(code); }

  handle(conn, msg) {
    if (!conn) return;
    switch (msg.t) {
      case 'host': return this.host(conn, msg);
      case 'join': return this.join(conn, msg);
      case 'start': return this.start(conn, msg);
      case 'pos': return this.pos(conn, msg);
      case 'kill': return this.kill(conn, msg);
      case 'report': return this.report(conn, msg, true);
      case 'emergency': return this.report(conn, msg, false);
      case 'vote': return this.vote(conn, msg);
      case 'sabotage': return this.sabotage_(conn, msg);
      case 'fix': return this.fix(conn, msg);
      case 'task': return this.task(conn, msg);
      case 'leave': return this.leave(conn);
    }
  }

  _newPlayer(conn, msg, host) {
    return { id: conn.id, conn, name: (msg.name || 'Player').slice(0, 12), color: msg.color || 'red', hat: msg.hat || 'none', pet: msg.pet || 'none',
      host, role: 'crew', alive: true, tasksDone: 0, tasksTotal: 0, killCool: 0, emergencyUses: 0, vote: undefined, pos: null };
  }

  host(conn, msg) {
    let code; do { code = code4(); } while (this.map.has(code));
    const room = new Room(code); this.map.set(code, room);
    const p = this._newPlayer(conn, msg, true); room.players.push(p);
    conn.roomCode = code;
    this.sendTo(conn, { t: 'joined', code, you: p.id, host: true });
    this.lobby(room);
    return room;
  }

  join(conn, msg) {
    const room = this.map.get((msg.code || '').toUpperCase());
    if (!room) return this.sendTo(conn, { t: 'error', m: 'Room not found' });
    if (room.phase !== 'lobby') return this.sendTo(conn, { t: 'error', m: 'Game already started' });
    if (room.players.length >= 12) return this.sendTo(conn, { t: 'error', m: 'Room full' });
    const p = this._newPlayer(conn, msg, false); room.players.push(p);
    conn.roomCode = room.code;
    this.sendTo(conn, { t: 'joined', code: room.code, you: p.id, host: false });
    this.lobby(room);
    return room;
  }

  lobby(room) { this.broadcast(room, { t: 'lobby', code: room.code, players: room.pub() }); }

  leave(conn) {
    const room = this.map.get(conn.roomCode); if (!room) return;
    const wasHost = room.players.find(p => p.id === conn.id)?.host;
    room.players = room.players.filter(p => p.id !== conn.id);
    conn.roomCode = null;
    if (!room.players.length) { this.map.delete(room.code); return; }
    if (wasHost) room.players[0].host = true;
    if (room.phase === 'lobby') this.lobby(room);
    else { this.broadcast(room, { t: 'left', id: conn.id, players: room.pub() }); this.checkWin(room); }
  }

  start(conn, msg) {
    const room = this.map.get(conn.roomCode); if (!room) return;
    const p = room.players.find(x => x.id === conn.id); if (!p || !p.host) return;
    if (room.players.length < 3) return this.sendTo(conn, { t: 'error', m: 'Need at least 3 players' });
    const s = room.settings = msg.settings || {};
    const np = room.players.length;
    const ni = Math.max(1, Math.min(s.numImpostors || 1, Math.floor((np - 1) / 2)));
    const order = shuffle(room.players);
    order.forEach((pl, i) => {
      pl.role = i < ni ? 'impostor' : 'crew';
      pl.alive = true; pl.tasksDone = 0; pl.tasksTotal = pl.role === 'impostor' ? 0 : (s.tasksPerCrew || 5);
      pl.killCool = pl.role === 'impostor' ? (s.killCooldown || 24) : 0; pl.emergencyUses = 0; pl.vote = undefined;
    });
    room.phase = 'play'; room.sabotage = { type: null, timer: 0, fixers: [] };
    const impIds = room.players.filter(x => x.role === 'impostor').map(x => x.id);
    for (const pl of room.players) {
      this.sendTo(pl.conn, { t: 'start', mapId: s.mapId || 'orbital', settings: s,
        role: pl.role, tasks: pl.tasksTotal, mates: pl.role === 'impostor' ? impIds : [],
        players: room.pub() });
    }
  }

  pos(conn, msg) {
    const room = this.map.get(conn.roomCode); if (!room || room.phase !== 'play') return;
    const p = room.players.find(x => x.id === conn.id); if (!p || !p.alive) return;
    p.pos = { x: msg.x, y: msg.y };
    this.broadcast(room, { t: 'pos', id: p.id, x: msg.x, y: msg.y, f: msg.f, m: msg.m }, p.id);
  }

  kill(conn, msg) {
    const room = this.map.get(conn.roomCode); if (!room || room.phase !== 'play') return;
    const k = room.players.find(x => x.id === conn.id);
    const v = room.players.find(x => x.id === msg.victimId);
    if (!k || !v || k.role !== 'impostor' || !k.alive || !v.alive || v.role === 'impostor') return;
    if (k.killCool > 0) return;
    v.alive = false; k.killCool = (room.settings.killCooldown || 24);
    this.broadcast(room, { t: 'killed', victimId: v.id, x: v.pos ? v.pos.x : 0, y: v.pos ? v.pos.y : 0 });
    this.checkWin(room);
  }

  report(conn, msg, isBody) {
    const room = this.map.get(conn.roomCode); if (!room || room.phase !== 'play') return;
    const p = room.players.find(x => x.id === conn.id); if (!p || !p.alive) return;
    if (!isBody) { if (p.emergencyUses >= (room.settings.emergencies ?? 1)) return; p.emergencyUses++; }
    room.sabotage = { type: null, timer: 0, fixers: [] };
    room.phase = 'meeting';
    room.players.forEach(x => x.vote = undefined);
    room.meeting = { phase: 'discuss', timer: room.settings.discussTime || 14, reporterId: p.id, bodyId: msg.bodyId || null };
    this.broadcast(room, { t: 'meeting', reporterId: p.id, body: isBody, players: room.pub(),
      discuss: room.settings.discussTime || 14, vote: room.settings.voteTime || 18 });
  }

  vote(conn, msg) {
    const room = this.map.get(conn.roomCode); if (!room || room.phase !== 'meeting' || !room.meeting || room.meeting.phase !== 'vote') return;
    const p = room.players.find(x => x.id === conn.id); if (!p || !p.alive || p.vote !== undefined) return;
    p.vote = msg.target || 'skip';
    this.broadcast(room, { t: 'voted', id: p.id });
    // end early if everyone alive has voted
    if (room.alive().every(x => x.vote !== undefined)) room.meeting.timer = 0;
  }

  resolveMeeting(room) {
    const tally = {}; let skips = 0;
    for (const p of room.alive()) { const v = p.vote === undefined ? 'skip' : p.vote; if (v === 'skip') skips++; else tally[v] = (tally[v] || 0) + 1; }
    let top = null, n = 0, tie = false;
    for (const id in tally) { if (tally[id] > n) { n = tally[id]; top = id; tie = false; } else if (tally[id] === n) tie = true; }
    let ejected = (!top || tie || skips >= n) ? null : room.players.find(p => p.id === top);
    if (ejected) ejected.alive = false;
    this.broadcast(room, { t: 'ejected', id: ejected ? ejected.id : null, wasImpostor: ejected ? ejected.role === 'impostor' : false, tally, skips });
    room.meeting = null;
    if (this.checkWin(room)) return;
    room.phase = 'play';
    for (const p of room.players) if (p.role === 'impostor') p.killCool = room.settings.killCooldown || 24;
    this.broadcast(room, { t: 'resume' });
  }

  sabotage_(conn, msg) {
    const room = this.map.get(conn.roomCode); if (!room || room.phase !== 'play') return;
    const p = room.players.find(x => x.id === conn.id); if (!p || !p.alive || p.role !== 'impostor') return;
    if (room.sabotage.type) return;
    if (msg.kind === 'doors') { this.broadcast(room, { t: 'doors', room: msg.room }); return; }
    room.sabotage = { type: msg.kind, timer: msg.kind === 'reactor' ? (room.settings.reactorCountdown || 35) : 0, fixers: [] };
    this.broadcast(room, { t: 'sabotage', kind: msg.kind, timer: room.sabotage.timer });
  }

  fix(conn, msg) {
    const room = this.map.get(conn.roomCode); if (!room || !room.sabotage.type) return;
    const p = room.players.find(x => x.id === conn.id); if (!p || !p.alive) return;
    const need = room.sabotage.type === 'reactor' ? 2 : 1;
    if (!room.sabotage.fixers.includes(p.id)) room.sabotage.fixers.push(p.id);
    // expire single fixers after a short window for reactor (handled in tick)
    room.sabotage._fixAt = 0;
    if (room.sabotage.fixers.length >= need) {
      room.sabotage = { type: null, timer: 0, fixers: [] };
      this.broadcast(room, { t: 'fixed' });
    }
  }

  task(conn) {
    const room = this.map.get(conn.roomCode); if (!room || room.phase !== 'play') return;
    const p = room.players.find(x => x.id === conn.id); if (!p || p.role === 'impostor') return;
    if (p.tasksDone < p.tasksTotal) p.tasksDone++;
    this.broadcast(room, { t: 'tasks', pct: room.taskPct() });
    this.checkWin(room);
  }

  checkWin(room) {
    if (room.phase === 'over') return true;
    const imp = room.aliveImp().length, crew = room.aliveCrew().length;
    let res = null;
    if (imp === 0) res = { crewWon: true, text: 'All impostors ejected!' };
    else if (room.taskDoneAll()) res = { crewWon: true, text: 'Crew finished every task!' };
    else if (imp >= crew) res = { crewWon: false, text: 'Impostors reached the crew.' };
    if (res) { room.phase = 'over'; const imps = room.players.filter(p => p.role === 'impostor').map(p => p.id); this.broadcast(room, { t: 'over', ...res, impostors: imps }); return true; }
    return false;
  }

  tick(dt) {
    for (const room of this.map.values()) {
      if (room.phase === 'meeting' && room.meeting) {
        room.meeting.timer -= dt;
        if (room.meeting.phase === 'discuss' && room.meeting.timer <= 0) { room.meeting.phase = 'vote'; room.meeting.timer = room.settings.voteTime || 18; this.broadcast(room, { t: 'votePhase', time: room.meeting.timer }); }
        else if (room.meeting.phase === 'vote' && room.meeting.timer <= 0) this.resolveMeeting(room);
      } else if (room.phase === 'play') {
        for (const p of room.players) if (p.killCool > 0) p.killCool = Math.max(0, p.killCool - dt);
        if (room.sabotage.type === 'reactor') {
          room.sabotage.timer -= dt;
          // reactor needs two fixers within a window, else fixers reset
          if (room.sabotage.fixers.length === 1) { room.sabotage._fixAt = (room.sabotage._fixAt || 0) + dt; if (room.sabotage._fixAt > 4) { room.sabotage.fixers = []; room.sabotage._fixAt = 0; } }
          if (room.sabotage.timer <= 0) { room.phase = 'over'; const imps = room.players.filter(p => p.role === 'impostor').map(p => p.id); this.broadcast(room, { t: 'over', crewWon: false, text: 'Reactor melted down.', impostors: imps }); }
        }
      }
    }
  }
}

module.exports = { Room, Rooms };
