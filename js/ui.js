/* ============================================================================
 *  ui.js — DOM overlays: menu, team select, HUD, results, wallet panel.
 *  All glyphs are inline SVG (ICON) or procedural flags (Flags) — no emoji.
 * ========================================================================== */

const UI = (() => {
  const $ = sel => document.querySelector(sel);

  let refs = {};

  function cache() {
    refs = {
      menu: $('#menu'), hud: $('#hud'), overlay: $('#overlay'),
      hudP1: $('#hud-p1'), hudP2: $('#hud-p2'),
      hudScore: $('#hud-score'), hudTime: $('#hud-time'),
      hudPower: $('#hud-power-fill'), hudStage: $('#hud-stage'),
      walletBtn: $('#wallet-btn'), walletPanel: $('#wallet-panel'),
      toast: $('#toast'), rewardFloat: $('#reward-float'),
      goalBalance: $('#goal-balance'),
    };
  }

  // ------------------------------------------------------------- wallet ---
  function refreshWalletButton() {
    const connected = Wallet.isConnected();
    refs.walletBtn.innerHTML = connected
      ? `<span class="wdot"></span>${ICON('coin', 16, '#ffd24a')} <b>${Wallet.pending()}</b> <span class="waddr">${Wallet.shortAddr()}</span>`
      : `${ICON('wallet', 16)} <span>Connect Wallet</span>`;
    refs.walletBtn.classList.toggle('connected', connected);
    if (refs.goalBalance) refs.goalBalance.textContent = Wallet.pending();
  }

  function openWalletPanel() {
    Sound.click();
    const connected = Wallet.isConnected();
    const hist = Wallet.history().slice(0, 8).map(h =>
      `<div class="wrow ${h.claim ? 'claim' : ''}"><span>${h.reason}</span><b>${h.claim ? '−' : '+'}${h.amount}</b></div>`)
      .join('') || '<div class="wempty">No activity yet — score some goals.</div>';

    refs.walletPanel.innerHTML = `
      <div class="wp-card">
        <div class="wp-head">
          <div>
            <div class="wp-title">${ICON('coin', 20, '#ffd24a')} ${CONFIG.TOKEN.NAME} <span class="wp-sym">${CONFIG.TOKEN.SYMBOL}</span></div>
            <div class="wp-net">${ICON('chain', 13, '#9aa6bd')} ${CONFIG.TOKEN.NETWORK}</div>
          </div>
          <button class="wp-close" id="wp-close">${ICON('close', 16)}</button>
        </div>

        <div class="wp-balances">
          <div class="wp-bal"><span>Pending</span><b>${Wallet.pending()}</b></div>
          <div class="wp-bal"><span>Claimed</span><b>${Wallet.claimed()}</b></div>
        </div>

        ${connected
          ? `<div class="wp-addr">${ICON('wallet', 15, '#28c76f')} ${Wallet.shortAddr()}</div>`
          : `<button class="wp-btn primary" id="wp-connect">${ICON('link', 16, '#2a1a00')} Connect Phantom</button>`}

        <div class="wp-actions">
          <button class="wp-btn" id="wp-daily" ${Wallet.canClaimDaily() ? '' : 'disabled'}>
            ${ICON('gift', 16)} Daily +${CONFIG.TOKEN.DAILY_REWARD}</button>
          <button class="wp-btn primary" id="wp-claim" ${connected && Wallet.pending() > 0 ? '' : 'disabled'}>
            ${ICON('send', 16, '#2a1a00')} Claim</button>
        </div>
        ${connected ? `<button class="wp-btn ghost" id="wp-disc">Disconnect</button>` : ''}

        <div class="wp-hist-title">Recent activity</div>
        <div class="wp-hist">${hist}</div>

        <div class="wp-note">Rewards accrue off-chain and settle to your wallet on claim.
          Mint <code>${CONFIG.TOKEN.MINT.slice(0, 10)}…</code></div>
      </div>`;
    refs.walletPanel.classList.add('show');

    $('#wp-close').onclick = closeWalletPanel;
    refs.walletPanel.onclick = e => { if (e.target === refs.walletPanel) closeWalletPanel(); };

    const connectBtn = $('#wp-connect');
    if (connectBtn) connectBtn.onclick = async () => {
      connectBtn.innerHTML = 'Connecting…';
      const r = await Wallet.connect();
      if (r.ok) { toast(r.demo ? 'Demo wallet connected' : 'Phantom connected'); openWalletPanel(); refreshWalletButton(); }
      else { toast(r.error || 'Connection failed'); openWalletPanel(); }
    };
    const daily = $('#wp-daily');
    if (daily) daily.onclick = () => {
      const got = Wallet.claimDaily();
      if (got) { toast(`Daily reward +${got} ${CONFIG.TOKEN.SYMBOL}`); openWalletPanel(); refreshWalletButton(); }
    };
    const claim = $('#wp-claim');
    if (claim) claim.onclick = async () => {
      claim.innerHTML = 'Settling…'; claim.disabled = true;
      const r = await Wallet.claimToChain();
      if (r.ok) toast(`Claimed ${r.amount} ${CONFIG.TOKEN.SYMBOL}`);
      else toast(r.error);
      openWalletPanel(); refreshWalletButton();
    };
    const disc = $('#wp-disc');
    if (disc) disc.onclick = async () => { await Wallet.disconnect(); toast('Wallet disconnected'); openWalletPanel(); refreshWalletButton(); };
  }
  function closeWalletPanel() { refs.walletPanel.classList.remove('show'); Sound.click(); }

  // --------------------------------------------------------------- menu ---
  function showMenu() {
    let p1 = Game.state.p1Team, p2 = Game.state.p2Team, diff = 'normal';

    const chips = (selId, group) => TEAMS.map(t =>
      `<button class="team-chip ${t.id === selId ? 'sel' : ''}" data-group="${group}" data-id="${t.id}"
        style="--c:${t.primary};--c2:${t.accent}">
        ${Flags.svg(t, 26, 18)}<span class="tname">${t.name}</span></button>`).join('');

    refs.menu.innerHTML = `
      <div class="menu-bg"></div>
      <div class="menu-card">
        <div class="brand">
          <div class="brand-mark">${ICON('trophy', 30, '#ffd24a', 2)}<span class="brand-ball">${ICON('ball', 26, '#fff', 1.6)}</span></div>
          <h1>WORLD CUP <span>2026</span></h1>
          <div class="brand-sub">HEAD SOCCER<i></i><span class="p2e">$GOAL PLAY-TO-EARN</span></div>
        </div>

        <div class="select-row">
          <div class="select-col">
            <div class="sel-label">YOUR NATION</div>
            <div class="team-grid" id="grid-p1">${chips(p1.id, 'p1')}</div>
          </div>
          <div class="vs">VS</div>
          <div class="select-col">
            <div class="sel-label">OPPONENT</div>
            <div class="team-grid" id="grid-p2">${chips(p2.id, 'p2')}</div>
          </div>
        </div>

        <div class="diff-row" id="diff-row">
          ${Object.keys(DIFFICULTY).map(d =>
            `<button class="diff-btn ${d === diff ? 'sel' : ''}" data-d="${d}">${DIFFICULTY[d].label}</button>`).join('')}
        </div>

        <div class="play-row">
          <button class="play-btn quick" id="btn-quick">${ICON('bolt', 18, '#06210f')} QUICK MATCH</button>
          <button class="play-btn tour" id="btn-tour">${ICON('trophy', 18, '#2a1a00')} ROAD TO GLORY</button>
        </div>

        <div class="controls-hint">
          <b>Controls</b><i></i> Arrow keys move<i></i> Up / Space jump<i></i> X / Z shoot — hold to charge power
        </div>
      </div>`;
    refs.menu.classList.add('show');
    showHUD(false);

    refs.menu.querySelectorAll('.team-chip').forEach(chip => {
      chip.onclick = () => {
        const group = chip.dataset.group;
        const team = TEAMS.find(t => t.id === chip.dataset.id);
        if (group === 'p1') p1 = team; else p2 = team;
        refs.menu.querySelectorAll(`.team-chip[data-group="${group}"]`).forEach(c => c.classList.remove('sel'));
        chip.classList.add('sel'); Sound.click();
      };
    });
    refs.menu.querySelectorAll('.diff-btn').forEach(b => {
      b.onclick = () => { diff = b.dataset.d; refs.menu.querySelectorAll('.diff-btn').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); Sound.click(); };
    });

    $('#btn-quick').onclick = () => {
      if (p1.id === p2.id) { toast('Pick two different nations'); return; }
      hideMenu();
      Game.startMatch({ mode: 'quick', difficulty: diff, p1Team: p1, p2Team: p2 });
    };
    $('#btn-tour').onclick = () => {
      Game.state.p1Team = p1; Game.state.stageIndex = 0;
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
    refs.hudP1.querySelector('.h-flag').innerHTML = Flags.svg(s.p1Team, 26, 18);
    refs.hudP1.querySelector('.h-name').textContent = s.p1Team.name;
    refs.hudP2.querySelector('.h-flag').innerHTML = Flags.svg(s.p2Team, 26, 18);
    refs.hudP2.querySelector('.h-name').textContent = s.p2Team.name;
    refs.hudScore.textContent = `${s.score.p1} - ${s.score.p2}`;
    refs.hudTime.textContent = s.suddenDeath ? 'SD' : Math.ceil(s.timeLeft);
    refs.hudTime.parentElement.classList.toggle('danger', !s.suddenDeath && s.timeLeft <= 10);
    if (refs.hudStage) {
      refs.hudStage.textContent = s.mode === 'tournament' ? TOURNAMENT_STAGES[s.stageIndex] : '';
      refs.hudStage.style.display = s.mode === 'tournament' ? 'block' : 'none';
    }
    refs.hudPower.style.width = ((window.__p1Charge || 0) * 100) + '%';
  }

  function floatReward(text) {
    if (!text) return;
    const f = refs.rewardFloat;
    f.innerHTML = `${ICON('coin', 22, '#ffd24a')} ${text}`;
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
    const title = summary.draw ? 'DRAW' : summary.won ? 'VICTORY' : 'DEFEATED';
    const cls = summary.draw ? 'draw' : summary.won ? 'win' : 'lose';
    const rewardRows = summary.rewards.map(([k, v]) =>
      `<div class="res-rrow"><span>${k}</span><b>+${v}</b></div>`).join('');
    const isTour = s.mode === 'tournament';
    const advance = summary.won && isTour;

    refs.overlay.innerHTML = `
      <div class="res-card ${cls}">
        <div class="res-title">${summary.won ? ICON('trophy', 26, 'currentColor') : ''} ${title}</div>
        <div class="res-score">
          <span class="rs-side">${Flags.svg(s.p1Team, 30, 20)} ${summary.score.p1}</span>
          <span class="dash">–</span>
          <span class="rs-side">${summary.score.p2} ${Flags.svg(s.p2Team, 30, 20)}</span>
        </div>
        ${isTour ? `<div class="res-stage">${TOURNAMENT_STAGES[s.stageIndex]}</div>` : ''}

        <div class="res-rewards">
          <div class="res-rhead">${ICON('coin', 15, '#ffd24a')} $GOAL EARNED</div>
          <div class="res-rrow total"><span>Goals + bonuses</span><b>+${summary.goalCoins}</b></div>
          ${rewardRows}
          <div class="res-pending">Wallet pending <b>${Wallet.pending()} ${CONFIG.TOKEN.SYMBOL}</b></div>
        </div>

        <div class="res-actions">
          ${advance
            ? `<button class="play-btn tour" id="res-next">${ICON('play', 16, '#2a1a00')} NEXT · ${TOURNAMENT_STAGES[Math.min(s.stageIndex + 1, TOURNAMENT_STAGES.length - 1)]}</button>`
            : `<button class="play-btn quick" id="res-again">${ICON('refresh', 16, '#06210f')} ${isTour ? 'RETRY STAGE' : 'REMATCH'}</button>`}
          <button class="play-btn ghost" id="res-wallet">${ICON('wallet', 16)} Wallet</button>
          <button class="play-btn ghost" id="res-menu">${ICON('home', 16)} Menu</button>
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
        <div class="champ-cup">${ICON('trophy', 64, '#ffd24a', 1.6)}</div>
        <div class="res-title">WORLD CHAMPIONS</div>
        <div class="champ-team">${Flags.svg(s.p1Team, 34, 22)} ${s.p1Team.name}</div>
        <div class="champ-sub">2026 World Cup winners</div>
        <div class="res-rewards">
          <div class="res-rhead">${ICON('medal', 15, '#ffd24a')} CHAMPION JACKPOT</div>
          <div class="res-rrow total"><span>Trophy bonus</span><b>+${CONFIG.TOKEN.TOURNAMENT_WIN_BONUS}</b></div>
          <div class="res-pending">Wallet pending <b>${Wallet.pending()} ${CONFIG.TOKEN.SYMBOL}</b></div>
        </div>
        <div class="res-actions">
          <button class="play-btn quick" id="champ-claim">${ICON('send', 16, '#06210f')} Open Wallet & Claim</button>
          <button class="play-btn ghost" id="champ-menu">${ICON('home', 16)} Menu</button>
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
    $('#home-btn').innerHTML = ICON('home', 20, '#fff');
    $('#mute-btn').innerHTML = ICON('sound', 20, '#fff');
    $('#home-btn').onclick = () => { refs.overlay.classList.remove('show'); Game.quitToMenu(); };
    $('#mute-btn').onclick = () => {
      const m = !Sound.isMuted(); Sound.setMuted(m);
      $('#mute-btn').innerHTML = ICON(m ? 'mute' : 'sound', 20, '#fff');
    };
    refreshWalletButton();
    if (Wallet.canClaimDaily()) setTimeout(() => toast('Daily reward available — open Wallet'), 1500);
    showMenu();
  }

  return { init, showMenu, hideMenu, showHUD, syncHUD, showResult, showChampion, floatReward, toast, refreshWalletButton, openWalletPanel };
})();
