/* ============================================================================
 *  IMPOSTOR STATION — online multiplayer server.
 *  Dependency-free: a minimal RFC-6455 WebSocket server on Node built-ins only
 *  (http + crypto). Run with:  node server/server.js   (PORT env optional)
 *
 *  Authority split: the server owns game flow (roles, kills, meetings, votes,
 *  sabotage, win conditions); clients own their own movement + which specific
 *  task minigames they run. Movement is relayed; everything decisive is here.
 * ========================================================================== */
'use strict';
const http = require('http');
const crypto = require('crypto');
const { Room, Rooms } = require('./room.js');

const PORT = process.env.PORT || 8080;
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// ---- minimal WebSocket transport -----------------------------------------
function accept(key) { return crypto.createHash('sha1').update(key + GUID).digest('base64'); }

function sendFrame(socket, str) {
  const data = Buffer.from(str, 'utf8');
  const len = data.length;
  let header;
  if (len < 126) { header = Buffer.from([0x81, len]); }
  else if (len < 65536) { header = Buffer.from([0x81, 126, (len >> 8) & 255, len & 255]); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeUInt32BE(0, 2); header.writeUInt32BE(len, 6); }
  try { socket.write(Buffer.concat([header, data])); } catch (e) {}
}

function parseFrames(buf) {
  const out = [];
  let off = 0;
  while (off + 2 <= buf.length) {
    const b0 = buf[off], b1 = buf[off + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let p = off + 2;
    if (len === 126) { if (p + 2 > buf.length) break; len = buf.readUInt16BE(p); p += 2; }
    else if (len === 127) { if (p + 8 > buf.length) break; len = Number(buf.readBigUInt64BE(p)); p += 8; }
    let mask = null;
    if (masked) { if (p + 4 > buf.length) break; mask = buf.slice(p, p + 4); p += 4; }
    if (p + len > buf.length) break;
    let payload = buf.slice(p, p + len);
    if (masked) { const u = Buffer.alloc(len); for (let i = 0; i < len; i++) u[i] = payload[i] ^ mask[i & 3]; payload = u; }
    out.push({ opcode, payload }); off = p + len;
  }
  return { frames: out, rest: buf.slice(off) };
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Impostor Station server is running. Connect a game client via WebSocket.');
});

const rooms = new Rooms(broadcast, sendTo);
const conns = new Map(); // socket -> {id, roomCode}

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade',
    'Sec-WebSocket-Accept: ' + accept(key), '\r\n'].join('\r\n'));

  const id = crypto.randomBytes(6).toString('hex');
  conns.set(socket, { id, socket, roomCode: null });
  let buffer = Buffer.alloc(0);

  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    const { frames, rest } = parseFrames(buffer); buffer = rest;
    for (const f of frames) {
      if (f.opcode === 0x8) { cleanup(); return; }
      if (f.opcode === 0x9) { socket.write(Buffer.from([0x8a, 0])); continue; } // pong
      if (f.opcode !== 0x1) continue;
      let msg; try { msg = JSON.parse(f.payload.toString('utf8')); } catch (e) { continue; }
      rooms.handle(conns.get(socket), msg);
    }
  });
  socket.on('error', cleanup);
  socket.on('close', cleanup);
  function cleanup() { const c = conns.get(socket); if (c) { rooms.leave(c); conns.delete(socket); } try { socket.destroy(); } catch (e) {} }
});

function sendTo(conn, obj) { if (conn && conn.socket) sendFrame(conn.socket, JSON.stringify(obj)); }
function broadcast(room, obj, exceptId) { for (const p of room.players) if (p.conn && p.id !== exceptId) sendFrame(p.conn.socket, JSON.stringify(obj)); }

server.listen(PORT, () => console.log('Impostor Station server listening on :' + PORT));
