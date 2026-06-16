/* ============================================================================
 *  game.js — core engine: state machine, fixed-step loop, rendering,
 *  match flow, tournament progression, P2E reward hooks.
 * ========================================================================== */

const Game = (() => {
  let canvas, ctx;
  let last = 0, acc = 0;
  const STEP = 1 / 120; // physics sub-step

  const state = {
    screen: 'menu',          // menu | match | goal | result | tournament
    mode: 'quick',           // quick | tournament
    difficulty: 'normal',
    p1Team: TEAMS[0],
    p2Team: TEAMS[3],
    score: { p1: 0, p2: 0 },
    timeLeft: CONFIG.MATCH_SECONDS,
    running: false,
    goalFlash: 0,
    goalText: '',
    suddenDeath: false,
    shake: 0,
    confetti: [],
    // tournament
    stageIndex: 0,
    coinsThisMatch: 0,
  };

  let ball, p1, p2, goalL, goalR, ai;
  const input = { left: false, right: false, jump: false, shoot: false };
  let kickEdge = false; // rising-edge for single kick

  // ---------------------------------------------------------------- setup ---
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    canvas.width = CONFIG.WIDTH;
    canvas.height = CONFIG.HEIGHT;
    bindKeys();
    requestAnimationFrame(loop);
  }

  function bindKeys() {
    const map = (e, down) => {
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': input.left = down; break;
        case 'ArrowRight': case 'KeyD': input.right = down; break;
        case 'ArrowUp': case 'KeyW': case 'Space': input.jump = down; break;
        case 'KeyX': case 'KeyZ': case 'ArrowDown': case 'KeyS':
          if (down && !input.shoot) kickEdge = true;
          input.shoot = down; break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', e => map(e, true));
    window.addEventListener('keyup', e => map(e, false));
  }

  // --------------------------------------------------------------- match ---
  function startMatch(opts = {}) {
    Sound.init();
    state.mode = opts.mode || state.mode;
    if (opts.difficulty) state.difficulty = opts.difficulty;
    if (opts.p1Team) state.p1Team = opts.p1Team;
    if (opts.p2Team) state.p2Team = opts.p2Team;

    state.score = { p1: 0, p2: 0 };
    state.timeLeft = CONFIG.MATCH_SECONDS;
    state.suddenDeath = false;
    state.coinsThisMatch = 0;
    state.confetti = [];

    ball = new Ball();
    p1 = new Player(state.p1Team, 'left', false);
    p2 = new Player(state.p2Team, 'right', true);
    goalL = new Goal('left');
    goalR = new Goal('right');
    ai = new AIController(p2, ball, state.difficulty);

    kickoff(Math.random() < 0.5 ? 'left' : 'right');
    state.screen = 'match';
    state.running = true;
    Sound.whistle();
    UI.showHUD(true);
    UI.syncHUD(state);
  }

  function kickoff(toward) {
    ball.reset();
    ball.vx = toward === 'left' ? -120 : 120;
    p1.reset(); p2.reset();
    state.running = true;
  }

  function scoreGoal(scorer) {
    if (!state.running) return;
    state.running = false;
    if (scorer === 'p1') state.score.p1++; else state.score.p2++;

    state.goalText = scorer === 'p1' ? 'GOAL!' : 'CPU SCORES';
    state.goalFlash = 1.6;
    state.shake = 16;
    Sound.goal();
    spawnConfetti(scorer === 'p1' ? state.p1Team : state.p2Team);

    // P2E: player earns $GOAL only for their own goals.
    if (scorer === 'p1') {
      const c = Wallet.award(CONFIG.TOKEN.PER_GOAL, 'Goal scored');
      state.coinsThisMatch += c;
    }
    UI.syncHUD(state);
    UI.floatReward(scorer === 'p1' ? `+${CONFIG.TOKEN.PER_GOAL} ${CONFIG.TOKEN.SYMBOL}` : null);

    // Sudden death?
    if (state.suddenDeath) { setTimeout(endMatch, 1400); return; }

    setTimeout(() => {
      state.goalFlash = 0;
      kickoff(scorer === 'p1' ? 'right' : 'left');
    }, 1600);
  }

  function endMatch() {
    state.running = false;
    state.screen = 'result';
    Sound.whistle();

    const won = state.score.p1 > state.score.p2;
    const draw = state.score.p1 === state.score.p2;

    // Sudden death on a draw (quick match) → keep playing.
    if (draw && !state.suddenDeath) {
      state.suddenDeath = true;
      state.screen = 'match';
      state.timeLeft = 0;
      UI.toast('SUDDEN DEATH — next goal wins!');
      kickoff(Math.random() < 0.5 ? 'left' : 'right');
      return;
    }

    let summary = { won, draw, rewards: [] };
    if (won) {
      const wb = Wallet.award(CONFIG.TOKEN.WIN_BONUS, 'Match win');
      summary.rewards.push([`Win bonus`, wb]);
      state.coinsThisMatch += wb;
      if (state.score.p2 === 0) {
        const cs = Wallet.award(CONFIG.TOKEN.CLEAN_SHEET_BONUS, 'Clean sheet');
        summary.rewards.push([`Clean sheet`, cs]);
        state.coinsThisMatch += cs;
      }
      if (state.mode === 'tournament') {
        const tb = Wallet.award(CONFIG.TOKEN.TOURNAMENT_STAGE_BONUS, 'Stage advanced');
        summary.rewards.push([`Stage clear`, tb]);
        state.coinsThisMatch += tb;
      }
    }
    Sound[won ? 'win' : 'lose']();
    summary.goalCoins = state.coinsThisMatch;
    summary.score = { ...state.score };
    UI.showHUD(false);
    UI.showResult(summary, state);
  }

  // --------------------------------------------------------------- update ---
  function update(dt) {
    if (state.screen !== 'match') return;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 40);
    if (state.goalFlash > 0) state.goalFlash = Math.max(0, state.goalFlash - dt);

    // Confetti.
    for (const c of state.confetti) {
      c.vy += 600 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; c.life -= dt;
    }
    state.confetti = state.confetti.filter(c => c.life > 0 && c.y < CONFIG.HEIGHT);

    if (!state.running) return;

    // Timer.
    if (!state.suddenDeath) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) { state.timeLeft = 0; UI.syncHUD(state); endMatch(); return; }
    }

    // P1 input (consume rising-edge kick).
    const p1Kick = kickEdge;
    const p1Input = { left: input.left, right: input.right, jump: input.jump, shoot: input.shoot };

    // AI.
    const aiIn = ai.think(dt);

    p1.update(dt, p1Input);
    p2.update(dt, { left: aiIn.left, right: aiIn.right, jump: aiIn.jump, shoot: aiIn.shoot, speedScale: aiIn.speedScale });

    ball.update(dt);

    // Expose P1 power charge for the HUD meter.
    window.__p1Charge = p1.powerCharge;

    // Player ↔ ball body collisions (heads).
    Physics.resolveBallCircle(ball, p1.x, p1.y, p1.r, p1.vx, p1.vy, 0.7);
    Physics.resolveBallCircle(ball, p2.x, p2.y, p2.r, p2.vx, p2.vy, 0.7);

    // Kicks.
    if (p1Kick) { const k = p1.tryKick(ball, input.shoot && p1.powerCharge > 0.85); if (k) { Sound[k === 2 ? 'power' : 'kick'](); if (k === 2) state.shake = 8; } }
    if (aiIn.wantKick) { const k = p2.tryKick(ball, aiIn.power); if (k) Sound[k === 2 ? 'power' : 'kick'](); }
    kickEdge = false;

    // Goal frame + scoring.
    goalL.collideFrame(ball); goalR.collideFrame(ball);
    if (goalR.contains(ball)) scoreGoal('p1');     // right goal = CPU's net
    else if (goalL.contains(ball)) scoreGoal('p2'); // left goal = player's net

    UI.syncHUD(state);
  }

  // --------------------------------------------------------------- render ---
  function loop(ts) {
    const dt = Math.min((ts - last) / 1000 || 0, CONFIG.MAX_DT);
    last = ts;
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    render();
    requestAnimationFrame(loop);
  }

  function render() {
    ctx.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    drawStadium();
    if (state.screen === 'match' || state.screen === 'result' || state.screen === 'goal') {
      goalL.draw(ctx); goalR.draw(ctx);
      ball.draw(ctx);
      p1.draw(ctx); p2.draw(ctx);
      drawConfetti();
      if (state.goalFlash > 0) drawGoalText();
    }
    ctx.restore();
  }

  function drawStadium() {
    const W = CONFIG.WIDTH, H = CONFIG.HEIGHT, HZ = CONFIG.HORIZON;

    // --- Arena background above the pitch ---
    const sky = ctx.createLinearGradient(0, 0, 0, HZ);
    sky.addColorStop(0, '#070b14');
    sky.addColorStop(0.45, '#0f1a2c');
    sky.addColorStop(1, '#1a2b42');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HZ);

    // Upper tier / roof.
    ctx.fillStyle = '#0a111d';
    ctx.fillRect(0, 0, W, 46);
    // Stadium floodlights.
    for (const lx of [W * 0.16, W * 0.84]) {
      const g = ctx.createRadialGradient(lx, 8, 4, lx, 8, 260);
      g.addColorStop(0, 'rgba(255,255,235,0.16)');
      g.addColorStop(1, 'rgba(255,255,235,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, HZ + 40);
    }

    // Curved stands with crowd speckle.
    ctx.fillStyle = '#101a2b';
    ctx.beginPath();
    ctx.moveTo(0, 60); ctx.quadraticCurveTo(W / 2, 24, W, 60);
    ctx.lineTo(W, HZ); ctx.lineTo(0, HZ); ctx.closePath(); ctx.fill();
    const crowd = ['#3a5a8a', '#8a3a4a', '#c2a83a', '#3a8a5a', '#c4ccd6', '#5a3a8a'];
    for (let y = 70; y < HZ - 30; y += 9) {
      const curve = Math.sin((y - 70) / (HZ - 100) * Math.PI) * 0; // flat rows
      for (let x = 16; x < W - 16; x += 9) {
        const hash = (x * 13 + y * 7) % 19;
        if (hash < 7) {
          ctx.fillStyle = crowd[hash % crowd.length];
          ctx.globalAlpha = 0.45 + (hash % 3) * 0.12;
          ctx.fillRect(x, y + curve, 4, 4);
        }
      }
    }
    ctx.globalAlpha = 1;

    // LED sponsor board just above the grass.
    const board = ctx.createLinearGradient(0, HZ - 22, 0, HZ + 6);
    board.addColorStop(0, 'rgba(12,18,30,0.95)');
    board.addColorStop(1, 'rgba(30,44,64,0.95)');
    ctx.fillStyle = board; ctx.fillRect(0, HZ - 22, W, 26);
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.font = '800 14px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    const msg = 'WORLD CUP 2026      $GOAL  PLAY TO EARN      HEAD SOCCER      ';
    ctx.fillText(msg + msg, W / 2, HZ - 5);
    ctx.textAlign = 'left';

    // --- The pitch (big, bright, slight perspective) ---
    const grass = ctx.createLinearGradient(0, HZ, 0, H);
    grass.addColorStop(0, '#1f8a35');
    grass.addColorStop(0.5, '#2cae45');
    grass.addColorStop(1, '#23932f');
    ctx.fillStyle = grass;
    ctx.fillRect(0, HZ, W, H - HZ);

    // Centre spotlight glow.
    const spot = ctx.createRadialGradient(W / 2, (HZ + H) / 2, 40, W / 2, (HZ + H) / 2, W * 0.5);
    spot.addColorStop(0, 'rgba(180,255,180,0.18)');
    spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot; ctx.fillRect(0, HZ, W, H - HZ);

    // Perspective mow stripes (fan out toward the viewer).
    ctx.save();
    ctx.beginPath(); ctx.rect(0, HZ, W, H - HZ); ctx.clip();
    const cx = W / 2;
    for (let i = -8; i <= 8; i++) {
      ctx.globalAlpha = i % 2 ? 0.07 : 0.0;
      if (i % 2) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const topX1 = cx + i * 26, topX2 = cx + (i + 1) * 26;
        const botX1 = cx + i * 90, botX2 = cx + (i + 1) * 90;
        ctx.moveTo(topX1, HZ); ctx.lineTo(topX2, HZ);
        ctx.lineTo(botX2, H); ctx.lineTo(botX1, H);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // --- White markings (perspective) ---
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    // Outer boundary (trapezoid).
    const ml = 34, mr = W - 34;
    const topInset = 96;
    ctx.beginPath();
    ctx.moveTo(ml + topInset, HZ + 8);
    ctx.lineTo(mr - topInset, HZ + 8);
    ctx.lineTo(mr, H - 8);
    ctx.lineTo(ml, H - 8);
    ctx.closePath(); ctx.stroke();

    // Halfway line.
    ctx.beginPath();
    ctx.moveTo(cx, HZ + 8); ctx.lineTo(cx, H - 8); ctx.stroke();
    // Centre circle (perspective ellipse) + spot.
    const ccy = (HZ + H) / 2 + 20;
    ctx.beginPath(); ctx.ellipse(cx, ccy, 78, 30, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.ellipse(cx, ccy, 4, 2, 0, 0, Math.PI * 2); ctx.fill();

    // Penalty boxes near each goal (perspective).
    drawPenaltyBox(ctx, 'left', HZ, topInset, ml);
    drawPenaltyBox(ctx, 'right', HZ, topInset, mr);
  }

  function drawPenaltyBox(ctx, side, HZ, topInset, edge) {
    const H = CONFIG.HEIGHT;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2.5;
    const dir = side === 'left' ? 1 : -1;
    const topY = HZ + 8, botY = H - 8;
    const topInner = side === 'left' ? edge + topInset + 110 : edge - topInset - 110;
    const botInner = side === 'left' ? edge + 200 : edge - 200;
    const topEdge = side === 'left' ? edge + topInset : edge - topInset;
    const botEdge = side === 'left' ? edge : edge;
    ctx.beginPath();
    ctx.moveTo(topEdge, topY);
    ctx.lineTo(topInner, topY);
    ctx.lineTo(botInner, botY);
    ctx.lineTo(botEdge, botY);
    ctx.stroke();
    // Penalty spot.
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const sx = side === 'left' ? edge + 86 : edge - 86;
    ctx.beginPath(); ctx.ellipse(sx, (topY + botY) / 2 + 20, 3, 1.6, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawGoalText() {
    const a = Math.min(1, state.goalFlash);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    const scale = 1 + (1.6 - state.goalFlash) * 0.3;
    ctx.translate(CONFIG.WIDTH / 2, 150);
    ctx.scale(scale, scale);
    ctx.font = '900 64px "Segoe UI Black", Impact, sans-serif';
    ctx.lineWidth = 8; ctx.strokeStyle = '#000';
    ctx.strokeText(state.goalText, 0, 0);
    const g = ctx.createLinearGradient(0, -40, 0, 30);
    g.addColorStop(0, '#ffe600'); g.addColorStop(1, '#ff8a00');
    ctx.fillStyle = g;
    ctx.fillText(state.goalText, 0, 0);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  function spawnConfetti(team) {
    const colors = [team.primary, team.secondary, team.accent, '#ffffff', '#ffe600'];
    for (let i = 0; i < 80; i++) {
      state.confetti.push({
        x: CONFIG.WIDTH / 2 + (Math.random() - 0.5) * 300,
        y: 120,
        vx: (Math.random() - 0.5) * 400,
        vy: -Math.random() * 300 - 100,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 10,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 2 + Math.random() * 1.5,
      });
    }
  }

  function drawConfetti() {
    for (const c of state.confetti) {
      ctx.save();
      ctx.globalAlpha = Physics.clamp(c.life, 0, 1);
      ctx.translate(c.x, c.y); ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- api ---
  return {
    init, startMatch,
    state,
    renderFrame: render,   // draw a single frame on demand (used for headless checks)
    getTime: () => Math.ceil(state.timeLeft),
    quitToMenu() { state.screen = 'menu'; state.running = false; UI.showHUD(false); UI.showMenu(); },
    nextTournamentMatch() {
      state.stageIndex++;
      if (state.stageIndex >= TOURNAMENT_STAGES.length) {
        Wallet.award(CONFIG.TOKEN.TOURNAMENT_WIN_BONUS, 'World champions');
        UI.showChampion(state);
        state.stageIndex = 0;
        return;
      }
      // Pick next CPU opponent + bump difficulty as stages progress.
      const pool = TEAMS.filter(t => t.id !== state.p1Team.id);
      state.p2Team = pool[Math.floor(Math.random() * pool.length)];
      const diffByStage = ['easy', 'normal', 'normal', 'hard', 'legend'];
      startMatch({ mode: 'tournament', difficulty: diffByStage[state.stageIndex], p2Team: state.p2Team });
    },
  };
})();
