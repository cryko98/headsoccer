/* ============================================================================
 *  ui.js — DOM overlays: main menu, team select, HUD, results, wallet panel.
 *  Keeps all DOM concerns out of the canvas engine.
 * ========================================================================== */

const UI = (() => {
  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  let refs = {};

  function cache() {
    refs = {
      menu: $('#menu'),
      hud: $('#hud'),
      overlay: $('#overlay'),
      hudP1: $('#hud-p1'),
      hudP2: $('#hud-p2'),
      hudScore: $('#hud-score'),
      hudTime: $('#hud-time'),
      hudPower: $('#hud-power-fill'),
      hudStage: $('#hud-stage'),
      walletBtn: $('#wallet-btn'),
      walletPanel: $('#wallet-panel'),
      toast: $('#toast'),
      rewardFloat: $('#reward-float'),
      goalBalance: $('#goal-balance'),
    };
  }

  // ------------------------------------------------------------- wallet ---
  function refreshWalletButton() {
    const connected = Wallet.isConnected();
    refs.walletBtn.innerHTML = connected
      ? `<span class="wdot"></span> ${Wallet.shortAddr()} · <b>${Wallet.pending()} ${CONFIG.TOKEN.SYMBOL}</b>`
      : `🔗 Connect Wallet`;
    refs.walletBtn.classList.toggle('connected', connected);
    if (refs.goalBalance) refs.goalBalance.textContent = Wallet.pending();
  }

  function openWalletPanel() {
    Sound.click();
    const w = Wallet.state;
    const connected = Wallet.isConnected();
    const hist = Wallet.history().slice(0, 8).map(h =>
      `<div class="wrow ${h.claim ? 'claim' : ''}"><span>${h.reason}</span><b>${h.claim ? '−' : '+'}${h.amount}</b></div>`).join('') || '<div class="wempty">No activity yet — score some goals!</div>';

    refs.walletPanel.innerHTML = `
      <div class="wp-card">
        <div class="wp-head">
          <div>
            <div class="wp-title">${CONFIG.TOKEN.NAME} <span class="wp-sym">${CONFIG.TOKEN.SYMBOL}</span></div>
            <div class="wp-net">⛓ ${CONFIG.TOKEN.NETWORK}</div>
          </div>
          <button class="wp-close" id="wp-close">✕</button>
        </div>

        <div class="wp-balances">
          <div class="wp-bal"><span>Pending</span><b>${Wallet.pending()}</b></div>
          <div class="wp-bal"><span>Claimed</span><b>${Wallet.claimed()}</b></div>
        </div>

        ${connected
          ? `<div class="wp-addr">👛 ${Wallet.shortAddr()}</div>`
          : `<button class="wp-btn primary" id="wp-connect">🔗 Connect Phantom</button>`}

        <div class="wp-actions">
          <button class="wp-btn" id="wp-daily" ${Wallet.canClaimDaily() ? '' : 'disabled'}>
            🎁 Daily +${CONFIG.TOKEN.DAILY_REWARD}</button>
          <button class="wp-btn primary" id="wp-claim" ${connected && Wallet.pending() > 0 ? '' : 'disabled'}>
            💸 Claim to Wallet</button>
        </div>
        ${connected ? `<button class="wp-btn ghost" id="wp-disc">Disconnect</button>` : ''}

        <div class="wp-hist-title">Recent activity</div>
        <div class="wp-hist">${hist}</div>

        <div class="wp-note">Rewards accrue off-chain and settle to your wallet on claim.
        Mint: <code>${CONFIG.TOKEN.MINT.slice(0, 10)}…</code></div>
      </div>`;
    refs.walletPanel.classList.add('show');

    $('#wp-close').onclick = closeWalletPanel;
    refs.walletPanel.onclick = e => { if (e.target === refs.walletPanel) closeWalletPanel(); };

    const connectBtn = $('#wp-connect');
    if (connectBtn) connectBtn.onclick = async () => {
      connectBtn.textContent = 'Connecting…';
      const r = await Wallet.connect();
      if (r.ok) { toast(r.demo ? 'Demo wallet connected' : 'Phantom connected'); openWalletPanel(); refreshWalletButton(); }
      else { toast(r.error || 'Connection failed'); connectBtn.textContent = '🔗 Connect Phantom'; }
    };

    const daily = $('#wp-daily');
    if (daily) daily.onclick = () => {
      const got = Wallet.claimDaily();
      if (got) { toast(`Daily reward +${got} ${CONFIG.TOKEN.SYMBOL}`); openWalletPanel(); refreshWalletButton(); }
    };

    const claim = $('#wp-claim');
    if (claim) claim.onclick = async () => {
      claim.textContent = 'Settling…'; claim.disabled = true;
      const r = await Wallet.claimToChain();
      if (r.ok) { toast(`Claimed ${r.amount} ${CONFIG.TOKEN.SYMBOL} ✅`); openWalletPanel(); refreshWalletButton(); }
      else { toast(r.error); openWalletPanel(); }
    };

    const disc = $('#wp-disc');
    if (disc) disc.onclick = async () => { await Wallet.disconnect(); toast('Wallet disconnected'); openWalletPanel(); refreshWalletButton(); };
  }
  function closeWalletPanel() { refs.walletPanel.classList.remove('show'); Sound.click(); }

  // --------------------------------------------------------------- menu ---
  function showMenu() {
    let p1 = Game.state.p1Team, p2 = Game.state.p2Team, diff = 'normal';

    const teamChips = (selectedId, group) => TEAMS.map(t =>
      `<button class="team-chip ${t.id === selectedId ? 'sel' : ''}" data-group="${group}" data-id="${t.id}"
        style="--c:${t.primary};--c2:${t.accent}">
        <span class="tflag">${t.flag}</span><span class="tname">${t.name}</span></button>`).join('');

    refs.menu.innerHTML = `
      <div class="menu-bg"></div>
      <div class="menu-card">
        <div class="brand">
          <div class="brand-cup">🏆</div>
          <h1>WORLD CUP <span>2026</span></h1>
          <div class="brand-sub">HEAD SOCCER · <span class="p2e">$GOAL PLAY-TO-EARN</span></div>
        </div>

        <div class="select-row">
          <div class="select-col">
            <div class="sel-label">YOUR NATION</div>
            <div class="team-grid" id="grid-p1">${teamChips(p1.id, 'p1')}</div>
          </div>
          <div class="vs">VS</div>
          <div class="select-col">
            <div class="sel-label">OPPONENT</div>
            <div class="team-grid" id="grid-p2">${teamChips(p2.id, 'p2')}</div>
          </div>
        </div>

        <div class="diff-row" id="diff-row">
          ${Object.keys(DIFFICULTY).map(d =>
            `<button class="diff-btn ${d === diff ? 'sel' : ''}" data-d="${d}">${DIFFICULTY[d].label}</button>`).join('')}
        </div>

        <div class="play-row">
          <button class="play-btn quick" id="btn-quick">⚡ QUICK MATCH</button>
          <button class="play-btn tour" id="btn-tour">🏆 ROAD TO GLORY</button>
        </div>

        <div class="controls-hint">
          <b>Controls</b> &nbsp; ◀ ▶ move · ▲ / Space jump · X / Z shoot (hold to charge power)
        </div>
      </div>`;
    refs.menu.classList.add('show');
    showHUD(false);

    // Team selection.
    refs.menu.querySelectorAll('.team-chip').forEach(chip => {
      chip.onclick = () => {
        const group = chip.dataset.group;
        const team = TEAMS.find(t => t.id === chip.dataset.id);
        if (group === 'p1') p1 = team; else p2 = team;
        refs.menu.querySelectorAll(`.team-chip[data-group="${group}"]`).forEach(c => c.classList.remove('sel'));
        chip.classList.add('sel');
        Sound.click();
      };
    });
    refs.menu.querySelectorAll('.diff-btn').forEach(b => {
      b.onclick = () => { diff = b.dataset.d; refs.menu.querySelectorAll('.diff-btn').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); Sound.click(); };
    });

    $('#btn-quick').onclick = () => {
      if (p1.id === p2.id) { toast('Pick two different nations'); return; }
      Game.state.p1Team = p1; Game.state.p2Team = p2;
      hideMenu();
      Game.startMatch({ mode: 'quick', difficulty: diff, p1Team: p1, p2Team: p2 });
    };
    $('#btn-tour').onclick = () => {
      Game.state.p1Team = p1;
      Game.state.stageIndex = 0;
      const pool = TEAMS.filter(t => t.id !== p1.id);
      const opp = pool[Math.floor(Math.random() * pool.length)];
      hideMenu();
      Game.startMatch({ mode: 'tournament', difficulty: 'easy', p1Team: p1, p2Team: opp });
    };
  }
  function hideMenu() { refs.menu.classList.remove('show'); }

  // ---------------------------------------------------------------- hud ---
  function showHUD(show) { refs.hud.classList.toggle('show', show); }

  function syncHUD(s) {
    refs.hudP1.querySelector('.h-flag').textContent = s.p1Team.flag;
    refs.hudP1.querySelector('.h-name').textContent = s.p1Team.name;
    refs.hudP2.querySelector('.h-flag').textContent = s.p2Team.flag;
    refs.hudP2.querySelector('.h-name').textContent = s.p2Team.name;
    refs.hudScore.textContent = `${s.score.p1} - ${s.score.p2}`;
    refs.hudTime.textContent = s.suddenDeath ? 'SD' : Math.ceil(s.timeLeft);
    refs.hudTime.classList.toggle('danger', !s.suddenDeath && s.timeLeft <= 10);
    if (refs.hudStage) {
      refs.hudStage.textContent = s.mode === 'tournament' ? TOURNAMENT_STAGES[s.stageIndex] : '';
      refs.hudStage.style.display = s.mode === 'tournament' ? 'block' : 'none';
    }
    // Power meter from the live player object (read via global if present).
    const charge = window.__p1Charge || 0;
    refs.hudPower.style.width = (charge * 100) + '%';
  }

  function floatReward(text) {
    if (!text) return;
    const f = refs.rewardFloat;
    f.textContent = text;
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  }

  function toast(msg) {
    const t = refs.toast;
    t.textContent = msg;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ------------------------------------------------------------ result ---
  function showResult(summary, s) {
    const title = summary.draw ? 'DRAW' : summary.won ? 'VICTORY!' : 'DEFEATED';
    const cls = summary.draw ? 'draw' : summary.won ? 'win' : 'lose';
    const rewardRows = summary.rewards.map(([k, v]) =>
      `<div class="res-rrow"><span>${k}</span><b>+${v}</b></div>`).join('');
    const isTour = s.mode === 'tournament';
    const advance = summary.won && isTour;

    refs.overlay.innerHTML = `
      <div class="res-card ${cls}">
        <div class="res-title">${title}</div>
        <div class="res-score">
          <span>${s.p1Team.flag} ${summary.score.p1}</span>
          <span class="dash">–</span>
          <span>${summary.score.p2} ${s.p2Team.flag}</span>
        </div>
        ${isTour ? `<div class="res-stage">${TOURNAMENT_STAGES[s.stageIndex]}</div>` : ''}

        <div class="res-rewards">
          <div class="res-rhead">💰 $GOAL EARNED</div>
          <div class="res-rrow total"><span>Goals + bonuses</span><b>+${summary.goalCoins}</b></div>
          ${rewardRows}
          <div class="res-pending">Wallet pending: <b>${Wallet.pending()} ${CONFIG.TOKEN.SYMBOL}</b></div>
        </div>

        <div class="res-actions">
          ${advance
            ? `<button class="play-btn tour" id="res-next">▶ NEXT: ${TOURNAMENT_STAGES[Math.min(s.stageIndex + 1, TOURNAMENT_STAGES.length - 1)]}</button>`
            : `<button class="play-btn quick" id="res-again">🔄 ${isTour ? 'RETRY STAGE' : 'REMATCH'}</button>`}
          <button class="play-btn ghost" id="res-wallet">👛 Wallet</button>
          <button class="play-btn ghost" id="res-menu">🏠 Menu</button>
        </div>
      </div>`;
    refs.overlay.classList.add('show');

    const next = $('#res-next');
    if (next) next.onclick = () => { refs.overlay.classList.remove('show'); Game.nextTournamentMatch(); };
    const again = $('#res-again');
    if (again) again.onclick = () => {
      refs.overlay.classList.remove('show');
      Game.startMatch({ mode: s.mode, difficulty: s.difficulty, p1Team: s.p1Team, p2Team: s.p2Team });
    };
    $('#res-wallet').onclick = openWalletPanel;
    $('#res-menu').onclick = () => { refs.overlay.classList.remove('show'); Game.quitToMenu(); };
    refreshWalletButton();
  }

  function showChampion(s) {
    refs.overlay.innerHTML = `
      <div class="res-card win champion">
        <div class="champ-cup">🏆</div>
        <div class="res-title">WORLD CHAMPIONS</div>
        <div class="champ-team">${s.p1Team.flag} ${s.p1Team.name}</div>
        <div class="champ-sub">2026 World Cup winners!</div>
        <div class="res-rewards">
          <div class="res-rhead">💰 CHAMPION JACKPOT</div>
          <div class="res-rrow total"><span>Trophy bonus</span><b>+${CONFIG.TOKEN.TOURNAMENT_WIN_BONUS}</b></div>
          <div class="res-pending">Wallet pending: <b>${Wallet.pending()} ${CONFIG.TOKEN.SYMBOL}</b></div>
        </div>
        <div class="res-actions">
          <button class="play-btn quick" id="champ-claim">💸 Open Wallet & Claim</button>
          <button class="play-btn ghost" id="champ-menu">🏠 Menu</button>
        </div>
      </div>`;
    refs.overlay.classList.add('show');
    Sound.win();
    $('#champ-claim').onclick = openWalletPanel;
    $('#champ-menu').onclick = () => { refs.overlay.classList.remove('show'); Game.quitToMenu(); };
    refreshWalletButton();
  }

  // ---------------------------------------------------------------- init ---
  function init() {
    cache();
    refs.walletBtn.onclick = openWalletPanel;
    $('#home-btn').onclick = () => { refs.overlay.classList.remove('show'); Game.quitToMenu(); };
    $('#mute-btn').onclick = () => {
      const m = !Sound.isMuted(); Sound.setMuted(m);
      $('#mute-btn').textContent = m ? '🔇' : '🔊';
    };
    refreshWalletButton();
    // Offer daily reward hint.
    if (Wallet.canClaimDaily()) setTimeout(() => toast('🎁 Daily reward available — open Wallet'), 1500);
    showMenu();
  }

  return { init, showMenu, hideMenu, showHUD, syncHUD, showResult, showChampion, floatReward, toast, refreshWalletButton, openWalletPanel };
})();
