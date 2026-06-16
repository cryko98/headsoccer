/* ============================================================================
 *  ui.js — DOM HUD + overlays (menu, role reveal, action buttons, sabotage
 *  menu, game-over). The canvas stays purely the world view.
 * ========================================================================== */

const UI = (() => {
  const $ = s => document.querySelector(s);
  let refs = {};

  function init() {
    refs = {
      menu: $('#menu'), hud: $('#hud'), role: $('#role-overlay'),
      over: $('#over-overlay'), toast: $('#toast'), sab: $('#sab-menu'),
      taskbar: $('#taskbar-fill'), taskpct: $('#taskbar-pct'),
      tasklist: $('#tasklist'), actions: $('#actions'),
      alarm: $('#alarm'),
    };
    $('#mute-btn').onclick = () => { const m = !Sound.isMuted(); Sound.setMuted(m); $('#mute-btn').textContent = m ? 'SOUND OFF' : 'SOUND ON'; };
    $('#menu-btn').onclick = () => Game.quitToMenu();
    showMenu();
  }

  // --------------------------------------------------------------- menu ---
  function showMenu() {
    refs.menu.innerHTML = `
      <div class="menu-bg"></div>
      <div class="menu-card">
        <div class="logo">
          <div class="logo-badge">
            <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="26" r="18" fill="#e2333a"/><ellipse cx="36" cy="24" rx="9" ry="7" fill="#9fd3ff"/><rect x="18" y="40" width="28" height="16" rx="8" fill="#b3262c"/></svg>
          </div>
          <h1>IMPOSTOR<span>STATION</span></h1>
          <p class="tag">A social-deduction game · find the impostors before they get you</p>
        </div>

        <div class="role-pref">
          <div class="rp-label">PLAY AS</div>
          <div class="rp-btns" id="rp">
            <button class="rp-b sel" data-r="random">Random</button>
            <button class="rp-b" data-r="crew">Crewmate</button>
            <button class="rp-b" data-r="impostor">Impostor</button>
          </div>
        </div>

        <button class="big-btn" id="play-btn">PLAY</button>

        <div class="how">
          <div class="how-col">
            <b>Crewmate</b>
            <span>Finish all tasks, or vote out every impostor.</span>
          </div>
          <div class="how-col">
            <b>Impostor</b>
            <span>Eliminate the crew, sabotage, and don't get caught.</span>
          </div>
        </div>
        <div class="controls">
          <b>Controls</b>&nbsp; WASD / Arrows move · E use · R report · Q kill · F sabotage
        </div>
      </div>`;
    refs.menu.classList.add('show');
    showHUD(false);
    let pref = 'random';
    refs.menu.querySelectorAll('.rp-b').forEach(b => b.onclick = () => {
      pref = b.dataset.r; refs.menu.querySelectorAll('.rp-b').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); Sound.click();
    });
    $('#play-btn').onclick = () => { Sound.init(); Sound.resume(); refs.menu.classList.remove('show'); Game.startMatch(pref); };
  }

  // --------------------------------------------------------- role reveal ---
  function showRole(p) {
    const imp = p.isImpostor;
    const mates = imp ? Game.state.crew.filter(c => c.isImpostor && c !== p) : [];
    refs.role.innerHTML = `
      <div class="role-card ${imp ? 'imp' : 'crew'}">
        <div class="role-word">${imp ? 'IMPOSTOR' : 'CREWMATE'}</div>
        <div class="role-figure" style="--c:${p.color.hex}">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <ellipse cx="60" cy="104" rx="30" ry="8" fill="rgba(0,0,0,0.4)"/>
            <rect x="34" y="66" width="52" height="40" rx="18" fill="${p.color.hex}"/>
            <circle cx="60" cy="50" r="30" fill="${p.color.hex}"/>
            <ellipse cx="66" cy="46" rx="15" ry="11" fill="#9fd3ff"/>
            ${imp ? '<circle cx="60" cy="46" r="4" fill="#ff2b3b"/>' : ''}
          </svg>
        </div>
        <div class="role-desc">${imp
          ? `Eliminate the crew without being caught.${mates.length ? `<br>Your team: <b>${mates.map(m => m.name).join(', ')}</b>` : ''}`
          : `Complete <b>${p.tasks.length} tasks</b> and find the impostors.`}</div>
      </div>`;
    refs.role.classList.add('show');
  }
  function hideRole() { refs.role.classList.remove('show'); }

  // ---------------------------------------------------------------- hud ---
  function showHUD(b) { refs.hud.classList.toggle('show', b); }

  function syncHUD(S) {
    const p = S.player;
    // Task bar (crew progress, always visible — impostors see the crew's progress too).
    const ts = Game.taskStats();
    const pct = ts.total ? Math.round((ts.done / ts.total) * 100) : 0;
    refs.taskbar.style.width = pct + '%';
    refs.taskpct.textContent = `TASKS ${pct}%`;

    // Ghost banner.
    refs.hud.classList.toggle('ghost', !p.alive);

    // Task list.
    if (p.tasks.length) {
      refs.tasklist.innerHTML = `<div class="tl-head">${p.isImpostor ? 'FAKE TASKS' : 'TASKS'}</div>` +
        p.tasks.map(t => `<div class="tl-row ${t.done ? 'done' : ''}">
          <span class="tl-dot"></span>${t.def.name} <i>· ${roomName(t.def.room)}</i></div>`).join('');
    }

    // Alarm (sabotage).
    if (S.sabotage.type) {
      refs.alarm.classList.add('show');
      refs.alarm.innerHTML = S.sabotage.type === 'reactor'
        ? `<span class="al-r">⚠ REACTOR MELTDOWN</span> <b>${Math.ceil(Math.max(0, S.sabotage.timer))}s</b>`
        : `<span class="al-r">⚠ LIGHTS SABOTAGED</span>`;
    } else refs.alarm.classList.remove('show');

    // Action buttons.
    renderActions(S);
  }

  function renderActions(S) {
    const p = S.player, c = S.hintCtx || {};
    if (!p.alive) { refs.actions.innerHTML = `<div class="ghost-tag">GHOST · finish tasks</div>`; return; }
    const btns = [];
    btns.push(actBtn('use', 'USE', 'E', !!(c.task || c.fix || (c.vent && p.isImpostor) || (c.emergency && p.usedEmergency < CFG.EMERGENCY_USES))));
    btns.push(actBtn('report', 'REPORT', 'R', !!c.body, 'report'));
    if (p.isImpostor) {
      const cd = Math.ceil(Math.max(0, p.killCooldown));
      btns.push(actBtn('kill', cd > 0 ? cd + 's' : 'KILL', 'Q', !!c.victim && p.killCooldown <= 0, 'kill'));
      btns.push(actBtn('sabotage', 'SABOTAGE', 'F', S.sabotageCool <= 0 && !S.sabotage.type, 'sab'));
    }
    refs.actions.innerHTML = btns.join('');
    refs.actions.querySelectorAll('[data-act]').forEach(el => el.onclick = () => Input.press(el.dataset.act));
  }
  function actBtn(act, label, key, enabled, kind = 'use') {
    return `<button class="act ${kind} ${enabled ? '' : 'dis'}" data-act="${act}">
        <span class="act-l">${label}</span><span class="act-k">${key}</span></button>`;
  }
  function roomName(id) { const r = ROOMS.find(x => x.id === id); return r ? r.name : id; }

  // ------------------------------------------------------- sabotage menu ---
  function toggleSabotageMenu(S) {
    if (refs.sab.classList.contains('show')) { refs.sab.classList.remove('show'); return; }
    if (S.sabotageCool > 0 || S.sabotage.type) { toast('Sabotage on cooldown'); return; }
    refs.sab.innerHTML = `
      <div class="sab-card">
        <div class="sab-title">SABOTAGE</div>
        <button class="sab-b" data-s="lights">Kill the Lights<span>Blind the crew</span></button>
        <button class="sab-b" data-s="reactor">Reactor Meltdown<span>${CFG.REACTOR_COUNTDOWN}s to fix</span></button>
        <button class="sab-x" data-s="cancel">Cancel</button>
      </div>`;
    refs.sab.classList.add('show');
    refs.sab.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
      const s = b.dataset.s; refs.sab.classList.remove('show');
      if (s !== 'cancel') Game.triggerSabotage(s);
    });
  }

  // --------------------------------------------------------------- toast ---
  function toast(msg) {
    refs.toast.textContent = msg;
    refs.toast.classList.remove('show'); void refs.toast.offsetWidth; refs.toast.classList.add('show');
    clearTimeout(refs.toast._t); refs.toast._t = setTimeout(() => refs.toast.classList.remove('show'), 2400);
  }

  // ---------------------------------------------------------------- over ---
  function showOver(crewWon, text, playerWon, crew) {
    const imps = crew.filter(c => c.isImpostor);
    refs.over.innerHTML = `
      <div class="over-card ${crewWon ? 'crew' : 'imp'}">
        <div class="over-word">${crewWon ? 'CREWMATES WIN' : 'IMPOSTORS WIN'}</div>
        <div class="over-you ${playerWon ? 'won' : 'lost'}">${playerWon ? 'VICTORY' : 'DEFEAT'}</div>
        <div class="over-text">${text}</div>
        <div class="over-imps">Impostors were: <b>${imps.map(i => i.name).join(', ')}</b></div>
        <div class="over-actions">
          <button class="big-btn" id="over-again">PLAY AGAIN</button>
          <button class="ghost-btn" id="over-menu">MENU</button>
        </div>
      </div>`;
    refs.over.classList.add('show');
    $('#over-again').onclick = () => { refs.over.classList.remove('show'); Game.startMatch(); };
    $('#over-menu').onclick = () => { refs.over.classList.remove('show'); Game.quitToMenu(); };
  }

  return { init, showMenu, showRole, hideRole, showHUD, syncHUD, toast, toggleSabotageMenu, showOver };
})();
