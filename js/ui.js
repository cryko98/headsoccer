/* ============================================================================
 *  ui.js — DOM HUD + overlays: menu, settings, cosmetics, map select, role
 *  reveal, action buttons, sabotage menu, minimap, cameras, game-over.
 * ========================================================================== */

const UI = (() => {
  const $ = s => document.querySelector(s);
  let refs = {};

  function init() {
    refs = {
      menu: $('#menu'), hud: $('#hud'), role: $('#role-overlay'), over: $('#over-overlay'),
      toast: $('#toast'), sab: $('#sab-menu'), panel: $('#panel-overlay'),
      taskbar: $('#taskbar-fill'), taskpct: $('#taskbar-pct'), taskbarWrap: $('#taskbar'),
      tasklist: $('#tasklist'), actions: $('#actions'), alarm: $('#alarm'),
      minimap: $('#minimap'), cameras: $('#cameras-overlay'),
      admin: $('#admin-overlay'), vitals: $('#vitals-overlay'),
    };
    refs.mmCtx = refs.minimap.getContext('2d');
    $('#mute-btn').onclick = () => { const m = !Sound.isMuted(); Sound.setMuted(m); $('#mute-btn').textContent = m ? 'SOUND OFF' : 'SOUND ON'; };
    $('#menu-btn').onclick = () => Game.quitToMenu();

    // Online lobby network handlers.
    Net.on('joined', () => renderLobby());
    Net.on('lobby', () => { if (refs.panel.classList.contains('show')) renderLobby(); });
    Net.on('left', () => { if (refs.panel.classList.contains('show')) renderLobby(); });
    Net.on('error', m => { const el = document.getElementById('on-status'); if (el) el.textContent = m.m || 'Error'; else toast(m.m || 'Error'); });
    Net.on('start', data => { refs.panel.classList.remove('show'); Game.startOnline(data); });

    showMenu();
  }

  // --------------------------------------------------------------- menu ---
  function showMenu() {
    const map = Util.mapById(SETTINGS.mapId);
    refs.menu.innerHTML = `
      <div class="menu-bg"></div>
      <div class="menu-card">
        <div class="logo">
          <div class="logo-badge"><svg width="60" height="60" viewBox="0 0 64 64"><circle cx="32" cy="26" r="18" fill="#e2333a"/><ellipse cx="36" cy="24" rx="9" ry="7" fill="#9fd3ff"/><rect x="18" y="40" width="28" height="16" rx="8" fill="#b3262c"/></svg></div>
          <h1>IMPOSTOR<span>STATION</span></h1>
          <p class="tag">Social deduction — do tasks, find the impostors, survive</p>
        </div>

        <div class="map-select" id="mapsel">
          <div class="rp-label">MAP</div>
          <div class="map-row">${MAPS.map(m => `<button class="map-b ${m.id === SETTINGS.mapId ? 'sel' : ''}" data-m="${m.id}">
            <span class="map-name">${m.label}</span><span class="map-meta">${m.rooms.length} rooms</span></button>`).join('')}</div>
        </div>

        <div class="role-pref"><div class="rp-label">PLAY AS</div>
          <div class="rp-btns" id="rp">
            ${['random', 'crew', 'impostor'].map(r => `<button class="rp-b ${SETTINGS.rolePref === r ? 'sel' : ''}" data-r="${r}">${r[0].toUpperCase() + r.slice(1)}</button>`).join('')}
          </div></div>

        <button class="big-btn" id="play-btn">PLAY vs BOTS</button>
        <button class="big-btn online" id="online-btn">PLAY ONLINE</button>
        <div class="menu-sub">
          <button class="sub-btn" id="settings-btn">SETTINGS</button>
          <button class="sub-btn" id="cosmetics-btn">CUSTOMIZE</button>
        </div>
        <div class="controls"><b>Controls</b> WASD move · E use · R report · Q kill · F sabotage · M map</div>
      </div>`;
    refs.menu.classList.add('show'); showHUD(false);
    refs.menu.querySelectorAll('.map-b').forEach(b => b.onclick = () => { SETTINGS.mapId = b.dataset.m; Sound.click(); showMenu(); });
    refs.menu.querySelectorAll('.rp-b').forEach(b => b.onclick = () => { SETTINGS.rolePref = b.dataset.r; refs.menu.querySelectorAll('.rp-b').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); Sound.click(); });
    $('#play-btn').onclick = () => { Sound.init(); Sound.resume(); refs.menu.classList.remove('show'); Game.startMatch(); };
    $('#online-btn').onclick = () => { Sound.init(); Sound.resume(); showOnline(); };
    $('#settings-btn').onclick = showSettings;
    $('#cosmetics-btn').onclick = showCosmetics;
  }

  // -------------------------------------------------------------- online ---
  function profile() { return { name: (localStorage.getItem('is_name') || 'Player'), color: SETTINGS.color, hat: SETTINGS.hat, pet: SETTINGS.pet }; }

  function showOnline() {
    const url = localStorage.getItem('is_server') || 'ws://localhost:8080';
    const name = localStorage.getItem('is_name') || 'Player';
    refs.panel.innerHTML = `
      <div class="panel-card">
        <div class="panel-head"><span>PLAY ONLINE</span><button class="panel-x" id="pn-x">✕</button></div>
        <div class="online-form">
          <label>Your name</label><input id="on-name" maxlength="12" value="${name}">
          <label>Server address</label><input id="on-url" value="${url}">
          <div id="on-status" class="on-status"></div>
          <div class="online-actions">
            <button class="big-btn" id="on-host">HOST GAME</button>
            <div class="on-join"><input id="on-code" maxlength="4" placeholder="CODE" style="text-transform:uppercase">
              <button class="big-btn online" id="on-join">JOIN</button></div>
          </div>
          <div class="online-note">Run the bundled server first: <code>node server/server.js</code><br>Share the 4-letter code with friends on the same server.</div>
        </div>
      </div>`;
    refs.panel.classList.add('show');
    $('#pn-x').onclick = () => { refs.panel.classList.remove('show'); };
    const status = m => { const el = $('#on-status'); if (el) el.textContent = m; };

    async function go(joinCode) {
      const u = $('#on-url').value.trim(); const nm = $('#on-name').value.trim() || 'Player';
      localStorage.setItem('is_server', u); localStorage.setItem('is_name', nm);
      status('Connecting…');
      try { await Net.connect(u); } catch (e) { status('Could not reach server. Is it running?'); return; }
      if (joinCode) Net.join(joinCode, profile()); else Net.host(profile());
    }
    $('#on-host').onclick = () => go(null);
    $('#on-join').onclick = () => { const code = $('#on-code').value.trim().toUpperCase(); if (code.length !== 4) { status('Enter a 4-letter code'); return; } go(code); };
  }

  function renderLobby() {
    const s = Net.state;
    refs.panel.innerHTML = `
      <div class="panel-card">
        <div class="panel-head"><span>LOBBY · ${s.code}</span><button class="panel-x" id="pn-x">✕</button></div>
        <div class="lobby-players">${s.players.map(p => `<div class="lp-row">
          <span class="lp-av" style="--c:${(COLORS.find(c => c.id === p.color) || COLORS[0]).hex}"></span>
          <span class="lp-name">${p.name}${p.id === s.you ? ' (you)' : ''}</span>
          ${p.host ? '<span class="lp-host">HOST</span>' : ''}</div>`).join('')}</div>
        <div class="lobby-info">${s.players.length} player${s.players.length === 1 ? '' : 's'} · map: <b>${Util.mapById(SETTINGS.mapId).label}</b></div>
        ${s.isHost ? `<button class="big-btn" id="lobby-start">START GAME</button><div class="online-note">Adjust impostors/tasks in SETTINGS before starting.</div>`
                   : `<div class="online-note">Waiting for the host to start…</div>`}
        <button class="ghost-btn" id="lobby-leave">LEAVE</button>
      </div>`;
    refs.panel.classList.add('show');
    $('#pn-x').onclick = $('#lobby-leave').onclick = () => { Net.disconnect(); refs.panel.classList.remove('show'); showMenu(); };
    const sb = $('#lobby-start');
    if (sb) sb.onclick = () => Net.start({ ...SETTINGS });
  }

  // --------------------------------------------------------- online meeting ---
  let _nm = null;
  function showNetMeeting(m) {
    _nm = { players: m.players, body: m.body, reporterId: m.reporterId, phase: 'discuss', voted: false, ended: false };
    drawNetMeeting('Discuss');
  }
  function drawNetMeeting(phaseLabel, note) {
    const host = document.getElementById('meeting-overlay'); const s = Net.state;
    const me = Game.state.player;
    host.innerHTML = `
      <div class="meet-card">
        <div class="meet-head"><div class="meet-title">EMERGENCY MEETING</div>
          <div class="meet-sub">${_nm.body ? 'A body was reported' : 'Emergency meeting'}</div>
          <div class="meet-phase ${_nm.phase}">${phaseLabel}</div></div>
        <div class="meet-grid">${Game.state.crew.map(c => {
          const canVote = _nm.phase === 'vote' && c.alive && me.alive && !_nm.voted;
          return `<div class="seat ${c.isPlayer ? 'me' : ''} ${c.alive ? '' : 'dead'}" ${canVote ? `data-vote="${c.netId}"` : ''}>
            <div class="seat-av" style="--c:${c.color.hex}">${c.alive ? '' : '<span class="seat-x">✕</span>'}</div>
            <div class="seat-name">${c.name}${c.isPlayer ? ' (you)' : ''}</div></div>`;
        }).join('')}</div>
        <div class="meet-foot">${_nm.phase === 'vote' && me.alive && !_nm.voted ? `<button class="meet-skip" data-vote="skip">SKIP</button>` : ''}
          <div class="meet-note" id="meet-note">${note || (_nm.phase === 'vote' ? 'Tap a crewmate to vote' : 'Discuss…')}</div></div>
      </div>`;
    host.classList.add('show');
    host.querySelectorAll('[data-vote]').forEach(el => el.onclick = () => { if (_nm.voted) return; _nm.voted = true; Net.vote(el.dataset.vote); Sound.vote(); drawNetMeeting(phaseLabel, 'Vote locked. Waiting…'); });
  }
  function netMeetingVotePhase() { if (!_nm) return; _nm.phase = 'vote'; drawNetMeeting('Vote'); }
  function netMeetingVoted() { /* could show who voted; kept anonymous */ }
  function netMeetingResult(m) {
    if (!_nm) return;
    const ej = m.id ? Game.state.crew.find(c => c.netId === m.id) : null;
    let msg = !ej ? 'No one was ejected.' : (SETTINGS.confirmEjects ? `${ej.name} was ${m.wasImpostor ? 'An Impostor' : 'not an Impostor'}.` : `${ej.name} was ejected.`);
    _nm.phase = 'result'; drawNetMeeting('Results', msg);
    const card = document.querySelector('#meeting-overlay .meet-card');
    if (ej && card) { const fx = document.createElement('div'); fx.className = 'eject-anim'; fx.innerHTML = `<div class="eject-fig" style="--c:${ej.color.hex}"></div>`; card.appendChild(fx); }
    Sound.eject();
  }
  function hideNetMeeting() { _nm = null; document.getElementById('meeting-overlay').classList.remove('show'); }

  // ------------------------------------------------------------ settings ---
  function showSettings() {
    Sound.click();
    refs.panel.innerHTML = `
      <div class="panel-card">
        <div class="panel-head"><span>SETTINGS</span><button class="panel-x" id="pn-x">✕</button></div>
        <div class="panel-body">
          ${SETTING_DEFS.map(d => `<div class="set-row">
            <label>${d.label}</label>
            <input type="range" min="${d.min}" max="${d.max}" step="${d.step}" value="${SETTINGS[d.key]}" data-k="${d.key}">
            <span class="set-val" id="sv-${d.key}">${SETTINGS[d.key]}${d.suffix || ''}</span></div>`).join('')}
          ${SETTING_TOGGLES.map(t => `<div class="set-row toggle">
            <label>${t.label}</label>
            <button class="tg ${SETTINGS[t.key] ? 'on' : ''}" data-t="${t.key}">${SETTINGS[t.key] ? 'ON' : 'OFF'}</button></div>`).join('')}
        </div>
        <button class="big-btn" id="pn-done">DONE</button>
      </div>`;
    refs.panel.classList.add('show');
    refs.panel.querySelectorAll('input[type=range]').forEach(inp => inp.oninput = () => {
      let v = +inp.value; SETTINGS[inp.dataset.k] = v;
      const d = SETTING_DEFS.find(x => x.key === inp.dataset.k);
      $('#sv-' + inp.dataset.k).textContent = v + (d.suffix || '');
      // keep impostors sane vs players
      if (inp.dataset.k === 'numPlayers' || inp.dataset.k === 'numImpostors') clampImpostors();
    });
    refs.panel.querySelectorAll('.tg').forEach(b => b.onclick = () => { SETTINGS[b.dataset.t] = !SETTINGS[b.dataset.t]; b.classList.toggle('on'); b.textContent = SETTINGS[b.dataset.t] ? 'ON' : 'OFF'; Sound.click(); });
    $('#pn-x').onclick = $('#pn-done').onclick = () => { refs.panel.classList.remove('show'); };
  }
  function clampImpostors() { const maxImp = Math.max(1, Math.floor((SETTINGS.numPlayers - 1) / 2)); if (SETTINGS.numImpostors > maxImp) { SETTINGS.numImpostors = maxImp; const el = $('#sv-numImpostors'); if (el) el.textContent = maxImp; const inp = refs.panel.querySelector('input[data-k=numImpostors]'); if (inp) inp.value = maxImp; } }

  // ----------------------------------------------------------- cosmetics ---
  function showCosmetics() {
    Sound.click();
    const swatch = (arr, key, render) => arr.map(o => `<button class="cos-b ${SETTINGS[key] === o.id ? 'sel' : ''}" data-key="${key}" data-id="${o.id}">${render(o)}<span>${o.name}</span></button>`).join('');
    refs.panel.innerHTML = `
      <div class="panel-card">
        <div class="panel-head"><span>CUSTOMIZE</span><button class="panel-x" id="pn-x">✕</button></div>
        <div class="cos-preview" id="cos-preview"></div>
        <div class="panel-body cos">
          <div class="cos-group"><div class="rp-label">COLOR</div><div class="cos-grid">${swatch(COLORS, 'color', c => `<span class="cos-dot" style="background:${c.hex}"></span>`)}</div></div>
          <div class="cos-group"><div class="rp-label">HAT</div><div class="cos-grid">${swatch(HATS, 'hat', h => `<span class="cos-ico">${h.id === 'none' ? '—' : h.name[0]}</span>`)}</div></div>
          <div class="cos-group"><div class="rp-label">PET</div><div class="cos-grid">${swatch(PETS, 'pet', p => `<span class="cos-ico">${p.id === 'none' ? '—' : p.name[0]}</span>`)}</div></div>
        </div>
        <button class="big-btn" id="pn-done">DONE</button>
      </div>`;
    refs.panel.classList.add('show');
    drawCosPreview();
    refs.panel.querySelectorAll('.cos-b').forEach(b => b.onclick = () => {
      SETTINGS[b.dataset.key] = b.dataset.id;
      refs.panel.querySelectorAll(`.cos-b[data-key="${b.dataset.key}"]`).forEach(x => x.classList.remove('sel')); b.classList.add('sel');
      Sound.click(); drawCosPreview();
    });
    $('#pn-x').onclick = $('#pn-done').onclick = () => refs.panel.classList.remove('show');
  }
  function drawCosPreview() {
    const host = $('#cos-preview'); if (!host) return;
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 150;
    const c = cv.getContext('2d');
    const demo = new Crewmate({ id: 'demo', name: '', color: COLORS.find(x => x.id === SETTINGS.color), hat: SETTINGS.hat, pet: SETTINGS.pet, isPlayer: true, x: 80, y: 86 });
    if (SETTINGS.pet !== 'none') { demo.petPos = { x: 36, y: 96 }; demo.drawPet(c); }
    demo.draw(c, {});
    host.innerHTML = ''; host.appendChild(cv);
  }

  // --------------------------------------------------------- role reveal ---
  function showRole(p) {
    const imp = p.isImpostor;
    const mates = imp ? Game.state.crew.filter(c => c.isImpostor && c !== p) : [];
    refs.role.innerHTML = `
      <div class="role-card ${imp ? 'imp' : 'crew'}">
        <div class="role-word">${imp ? 'IMPOSTOR' : 'CREWMATE'}</div>
        <div class="role-figure"><svg width="120" height="120" viewBox="0 0 120 120">
          <ellipse cx="60" cy="104" rx="30" ry="8" fill="rgba(0,0,0,0.4)"/>
          <rect x="34" y="66" width="52" height="40" rx="18" fill="${p.color.hex}"/>
          <circle cx="60" cy="50" r="30" fill="${p.color.hex}"/>
          <ellipse cx="66" cy="46" rx="15" ry="11" fill="#9fd3ff"/>
          ${imp ? '<circle cx="60" cy="46" r="4" fill="#ff2b3b"/>' : ''}</svg></div>
        <div class="role-desc">${imp
          ? `Eliminate the crew without being caught.${mates.length ? `<br>Your team: <b>${mates.map(m => m.name).join(', ')}</b>` : ''}`
          : `Complete your <b>${p.tasks.length} tasks</b> and find the impostors.`}</div>
        <div class="role-map">${Util.mapById(SETTINGS.mapId).label}</div>
      </div>`;
    refs.role.classList.add('show');
  }
  function hideRole() { refs.role.classList.remove('show'); }

  // ---------------------------------------------------------------- hud ---
  function showHUD(b) { refs.hud.classList.toggle('show', b); }

  function syncHUD(S) {
    const p = S.player, ts = Game.taskStats(), pct = ts.total ? Math.round((ts.done / ts.total) * 100) : 0;
    refs.taskbar.style.width = pct + '%';
    refs.taskpct.textContent = `TASKS ${pct}%`;
    refs.hud.classList.toggle('ghost', !p.alive);

    // Comms down hides task list + minimap.
    const commsDown = S.commsDown;
    if (commsDown) { refs.tasklist.innerHTML = `<div class="tl-head" style="color:#ff5167">COMMS DISABLED</div><div class="tl-row">Task list offline</div>`; }
    else if (p.tasks.length) {
      refs.tasklist.innerHTML = `<div class="tl-head">${p.isImpostor ? 'FAKE TASKS' : 'TASKS'}</div>` +
        p.tasks.map(t => `<div class="tl-row ${t.done ? 'done' : ''}">
          <span class="tl-dot"></span>${t.def.name}${t.steps > 1 ? ` (${t.done ? t.steps : t.step}/${t.steps})` : ''} <i>· ${roomName(t.def.room)}</i></div>`).join('');
    }

    if (S.sabotage.type) {
      refs.alarm.classList.add('show');
      refs.alarm.innerHTML = S.sabotage.type === 'reactor'
        ? `<span class="al-r">⚠ REACTOR MELTDOWN</span> <b>${Math.ceil(Math.max(0, S.sabotage.timer))}s</b>`
        : S.sabotage.type === 'lights' ? `<span class="al-r">⚠ LIGHTS SABOTAGED</span>`
        : `<span class="al-r">⚠ COMMS DISABLED</span>`;
    } else refs.alarm.classList.remove('show');

    renderActions(S);
    renderMinimap(S, commsDown);

    // Console viewers.
    if (S.viewer !== 'cameras' && refs.cameras.classList.contains('show')) refs.cameras.classList.remove('show');
    if (S.viewer !== 'admin' && refs.admin.classList.contains('show')) refs.admin.classList.remove('show');
    if (S.viewer !== 'vitals' && refs.vitals.classList.contains('show')) refs.vitals.classList.remove('show');
    if (S.viewer === 'cameras') renderCameras(S);
    else if (S.viewer === 'admin') renderAdmin(S);
    else if (S.viewer === 'vitals') renderVitals(S);
  }

  function renderActions(S) {
    const p = S.player, c = S.hintCtx || {};
    if (!p.alive) { refs.actions.innerHTML = `<div class="ghost-tag">GHOST · finish tasks</div>`; return; }
    if (S.viewer) { refs.actions.innerHTML = `<button class="act use" data-act="use"><span class="act-l">CLOSE</span><span class="act-k">E</span></button>`; refs.actions.querySelector('[data-act]').onclick = () => Input.press('use'); return; }
    const btns = [];
    const useOn = !!(c.task || c.cameras || c.admin || c.vitals || (c.vent && p.isImpostor) || (c.emergency && p.usedEmergency < SETTINGS.emergencies));
    const useLabel = c.cameras ? 'CAMS' : c.admin ? 'ADMIN' : c.vitals ? 'VITALS' : (c.vent && p.isImpostor) ? 'VENT' : c.emergency ? 'MEETING' : 'USE';
    btns.push(actBtn('use', useLabel, 'E', useOn));
    btns.push(actBtn('report', 'REPORT', 'R', !!c.body, 'report'));
    if (p.isImpostor) {
      const cd = Math.ceil(Math.max(0, p.killCooldown));
      btns.push(actBtn('kill', cd > 0 ? cd + 's' : 'KILL', 'Q', !!c.victim && p.killCooldown <= 0, 'kill'));
      btns.push(actBtn('sabotage', 'SABOTAGE', 'F', S.sabotageCool <= 0 && !S.sabotage.type, 'sab'));
    }
    refs.actions.innerHTML = btns.join('');
    refs.actions.querySelectorAll('[data-act]').forEach(el => el.onclick = () => Input.press(el.dataset.act));
  }
  function actBtn(act, label, key, enabled, kind = 'use') { return `<button class="act ${kind} ${enabled ? '' : 'dis'}" data-act="${act}"><span class="act-l">${label}</span><span class="act-k">${key}</span></button>`; }
  function roomName(id) { const r = Util.mapById(SETTINGS.mapId).rooms.find(x => x.id === id); return r ? r.name : id; }

  // --------------------------------------------------------------- minimap ---
  function renderMinimap(S, commsDown) {
    if (!S.minimapOpen || commsDown) { refs.minimap.classList.remove('show'); return; }
    refs.minimap.classList.add('show');
    const ctx = refs.mmCtx, W = 300, H = 200, m = S.map, b = m.bounds;
    const sx = W / (b.maxX - b.minX), sy = H / (b.maxY - b.minY), s = Math.min(sx, sy);
    const ox = (W - (b.maxX - b.minX) * s) / 2, oy = (H - (b.maxY - b.minY) * s) / 2;
    const tx = x => ox + (x - b.minX) * s, ty = y => oy + (y - b.minY) * s;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,12,22,0.85)'; ctx.fillRect(0, 0, W, H);
    for (const r of m.rooms) { ctx.fillStyle = '#26324a'; ctx.fillRect(tx(r.x), ty(r.y), r.w * s, r.h * s); ctx.strokeStyle = '#4a5d82'; ctx.lineWidth = 1; ctx.strokeRect(tx(r.x), ty(r.y), r.w * s, r.h * s); }
    for (const cr of m.corridors) { ctx.fillStyle = '#1c2740'; ctx.fillRect(tx(cr.x), ty(cr.y), cr.w * s, cr.h * s); }
    // tasks
    for (const t of S.player.tasks) if (!t.done) { const tp = t.def.steps && t.def.stepRooms ? m.rooms.find(rr => rr.id === t.def.stepRooms[t.step]) : null; const px = tp ? tp.x + tp.w / 2 : t.def.x, py = tp ? tp.y + tp.h / 2 : t.def.y; ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(tx(px), ty(py), 3, 0, Math.PI * 2); ctx.fill(); }
    // player
    ctx.fillStyle = S.player.color.hex; ctx.beginPath(); ctx.arc(tx(S.player.x), ty(S.player.y), 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  // --------------------------------------------------------------- cameras ---
  function renderCameras(S) {
    if (!refs.cameras.classList.contains('show')) {
      refs.cameras.innerHTML = `<div class="cams-card"><div class="cams-head">SECURITY CAMERAS <button class="cams-x" id="cams-x">CLOSE (E)</button></div>
        <div class="cams-grid">${S.map.cameraSpots.map((c, i) => `<div class="cam-cell"><canvas id="cam-${i}" width="300" height="190"></canvas><span>${roomName(c.room)}</span></div>`).join('')}</div></div>`;
      refs.cameras.classList.add('show');
      $('#cams-x').onclick = () => Input.press('use');
    }
    S.map.cameraSpots.forEach((spot, i) => { const cv = $('#cam-' + i); if (cv) Game.renderCamera(cv.getContext('2d'), spot, 300, 190); });
  }

  // ----------------------------------------------------------------- admin ---
  let _adminCv = null;
  function renderAdmin(S) {
    if (!refs.admin.classList.contains('show')) {
      refs.admin.innerHTML = `<div class="cams-card"><div class="cams-head" style="color:#7dd3fc">ADMIN MAP — live room headcount <button class="cams-x" id="adm-x">CLOSE (E)</button></div>
        <canvas id="adm-cv" width="640" height="380"></canvas></div>`;
      refs.admin.classList.add('show'); _adminCv = $('#adm-cv'); $('#adm-x').onclick = () => Input.press('use');
    }
    const m = S.map, ctx = _adminCv.getContext('2d'), W = 640, H = 380, b = m.bounds;
    const s = Math.min(W / (b.maxX - b.minX), H / (b.maxY - b.minY));
    const ox = (W - (b.maxX - b.minX) * s) / 2, oy = (H - (b.maxY - b.minY) * s) / 2;
    const tx = x => ox + (x - b.minX) * s, ty = y => oy + (y - b.minY) * s;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#070d18'; ctx.fillRect(0, 0, W, H);
    for (const cr of m.corridors) { ctx.fillStyle = '#16203a'; ctx.fillRect(tx(cr.x), ty(cr.y), cr.w * s, cr.h * s); }
    for (const r of m.rooms) {
      const count = S.crew.filter(c => c.alive && c.x >= r.x && c.x <= r.x + r.w && c.y >= r.y && c.y <= r.y + r.h).length;
      ctx.fillStyle = count ? '#22406a' : '#1b283f'; ctx.fillRect(tx(r.x), ty(r.y), r.w * s, r.h * s);
      ctx.strokeStyle = '#3a4d72'; ctx.lineWidth = 1; ctx.strokeRect(tx(r.x), ty(r.y), r.w * s, r.h * s);
      ctx.fillStyle = '#9fb4d6'; ctx.font = '700 9px "Segoe UI"'; ctx.textAlign = 'center';
      ctx.fillText(r.name, tx(r.x + r.w / 2), ty(r.y) + 14);
      if (count) { ctx.fillStyle = '#7dd3fc'; ctx.font = '900 22px "Segoe UI"'; ctx.fillText(count, tx(r.x + r.w / 2), ty(r.y + r.h / 2) + 8); }
    }
    ctx.textAlign = 'left';
  }

  // ---------------------------------------------------------------- vitals ---
  function renderVitals(S) {
    refs.vitals.innerHTML = `<div class="vit-card"><div class="cams-head" style="color:#5af0a0">VITALS — crew status <button class="cams-x" id="vit-x">CLOSE (E)</button></div>
      <div class="vit-grid">${S.crew.map(c => `<div class="vit-row ${c.alive ? 'alive' : 'dead'}">
        <span class="vit-av" style="--c:${c.color.hex}"></span>
        <span class="vit-name">${c.name}${c.isPlayer ? ' (you)' : ''}</span>
        <span class="vit-stat">${c.alive ? 'ALIVE' : 'DEAD'}</span></div>`).join('')}</div></div>`;
    refs.vitals.classList.add('show');
    $('#vit-x').onclick = () => Input.press('use');
  }

  // ------------------------------------------------------- sabotage menu ---
  function toggleSabotageMenu(S) {
    if (refs.sab.classList.contains('show')) { refs.sab.classList.remove('show'); return; }
    if (S.sabotageCool > 0) { toast('Sabotage on cooldown'); return; }
    refs.sab.innerHTML = `
      <div class="sab-card">
        <div class="sab-title">SABOTAGE</div>
        <button class="sab-b" data-s="reactor" ${S.sabotage.type ? 'disabled' : ''}>Reactor Meltdown<span>${SETTINGS.reactorCountdown}s · two consoles</span></button>
        <button class="sab-b" data-s="lights" ${S.sabotage.type ? 'disabled' : ''}>Kill the Lights<span>Blind the crew</span></button>
        <button class="sab-b" data-s="comms" ${S.sabotage.type ? 'disabled' : ''}>Disable Comms<span>No task list / map</span></button>
        <button class="sab-b" data-s="doors">Seal Doors<span>Trap this room (12s)</span></button>
        <button class="sab-x" data-s="cancel">Cancel</button>
      </div>`;
    refs.sab.classList.add('show');
    refs.sab.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const s = b.dataset.s; refs.sab.classList.remove('show'); if (s !== 'cancel') Game.triggerSabotage(s); });
  }

  function toast(msg) { refs.toast.textContent = msg; refs.toast.classList.remove('show'); void refs.toast.offsetWidth; refs.toast.classList.add('show'); clearTimeout(refs.toast._t); refs.toast._t = setTimeout(() => refs.toast.classList.remove('show'), 2400); }

  // ---------------------------------------------------------------- over ---
  function showOver(crewWon, text, playerWon, crew) {
    const imps = crew.filter(c => c.isImpostor);
    refs.over.innerHTML = `
      <div class="over-card ${crewWon ? 'crew' : 'imp'}">
        <div class="over-word">${crewWon ? 'CREWMATES WIN' : 'IMPOSTORS WIN'}</div>
        <div class="over-you ${playerWon ? 'won' : 'lost'}">${playerWon ? 'VICTORY' : 'DEFEAT'}</div>
        <div class="over-text">${text}</div>
        <div class="over-imps">Impostors: <b>${imps.map(i => i.name).join(', ')}</b></div>
        <div class="over-actions"><button class="big-btn" id="over-again">PLAY AGAIN</button><button class="ghost-btn" id="over-menu">MENU</button></div>
      </div>`;
    refs.over.classList.add('show');
    $('#over-again').onclick = () => { refs.over.classList.remove('show'); Game.startMatch(); };
    $('#over-menu').onclick = () => { refs.over.classList.remove('show'); Game.quitToMenu(); };
  }

  return { init, showMenu, showRole, hideRole, showHUD, syncHUD, toast, toggleSabotageMenu, showOver,
           showNetMeeting, netMeetingVotePhase, netMeetingVoted, netMeetingResult, hideNetMeeting };
})();
