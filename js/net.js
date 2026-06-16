/* ============================================================================
 *  net.js — browser WebSocket client for online multiplayer. Thin wrapper over
 *  the server protocol with a tiny event bus.
 * ========================================================================== */

const Net = (() => {
  let ws = null;
  const handlers = {};
  const state = { you: null, code: null, isHost: false, players: [], connected: false, url: null };

  function on(t, fn) { (handlers[t] = handlers[t] || []).push(fn); }
  function emit(t, d) { (handlers[t] || []).forEach(fn => { try { fn(d); } catch (e) { console.error(e); } }); }

  function connect(url) {
    return new Promise((res, rej) => {
      try { ws = new WebSocket(url); } catch (e) { return rej(e); }
      state.url = url;
      let settled = false;
      ws.onopen = () => { state.connected = true; settled = true; res(); };
      ws.onerror = () => { if (!settled) { settled = true; rej(new Error('Cannot reach server')); } };
      ws.onclose = () => { state.connected = false; emit('close'); };
      ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } route(m); };
    });
  }

  function route(m) {
    if (m.t === 'joined') { state.you = m.you; state.code = m.code; state.isHost = m.host; }
    else if (m.t === 'lobby') { state.players = m.players; }
    else if (m.t === 'left') { state.players = m.players; }
    emit(m.t, m);
  }

  function send(o) { if (ws && state.connected) ws.send(JSON.stringify(o)); }

  return {
    connect, send, on, state,
    isOnline: () => !!ws && state.connected,
    disconnect() { if (ws) { try { ws.close(); } catch (e) {} ws = null; } state.connected = false; },
    host: p => send({ t: 'host', ...p }),
    join: (code, p) => send({ t: 'join', code: (code || '').toUpperCase(), ...p }),
    start: settings => send({ t: 'start', settings }),
    pos: (x, y, f, m) => send({ t: 'pos', x: Math.round(x), y: Math.round(y), f, m }),
    kill: victimId => send({ t: 'kill', victimId }),
    report: bodyId => send({ t: 'report', bodyId }),
    emergency: () => send({ t: 'emergency' }),
    vote: target => send({ t: 'vote', target }),
    sabotage: (kind, room) => send({ t: 'sabotage', kind, room }),
    fix: kind => send({ t: 'fix', kind }),
    task: () => send({ t: 'task' }),
  };
})();
