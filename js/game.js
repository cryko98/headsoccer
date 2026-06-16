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
    // Sky / arena gradient.
    const sky = ctx.createLinearGradient(0, 0, 0, CONFIG.GROUND_Y);
    sky.addColorStop(0, '#0a0e1a');
    sky.addColorStop(0.5, '#142033');
    sky.addColorStop(1, '#1c2e44');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.GROUND_Y);

    // Stand tiers with crowd speckle.
    ctx.fillStyle = '#0e1828';
    ctx.fillRect(0, 40, CONFIG.WIDTH, 150);
    for (let y = 55; y < 180; y += 12) {
      for (let x = 20; x < CONFIG.WIDTH - 20; x += 10) {
        const hash = (x * 13 + y * 7) % 17;
        if (hash < 6) {
          ctx.fillStyle = ['#3a5a8a', '#8a3a4a', '#caa83a', '#3a8a5a', '#bfc4cc'][hash % 5];
          ctx.globalAlpha = 0.5;
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Stadium lights.
    for (const lx of [CONFIG.WIDTH * 0.2, CONFIG.WIDTH * 0.8]) {
      const g = ctx.createRadialGradient(lx, 20, 5, lx, 20, 220);
      g.addColorStop(0, 'rgba(255,255,240,0.18)');
      g.addColorStop(1, 'rgba(255,255,240,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.GROUND_Y);
    }

    // LED sponsor board.
    const board = ctx.createLinearGradient(0, 183, 0, 215);
    board.addColorStop(0, 'rgba(255,255,255,0.10)');
    board.addColorStop(1, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = board;
    ctx.fillRect(0, 184, CONFIG.WIDTH, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 213, CONFIG.WIDTH, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    const msg = 'WORLD CUP 2026     ·     $GOAL  PLAY TO EARN     ·     HEAD SOCCER     ·     ';
    ctx.fillText(msg + msg, CONFIG.WIDTH / 2, 204);
    ctx.textAlign = 'left';

    // Pitch.
    const pitch = ctx.createLinearGradient(0, CONFIG.GROUND_Y - 30, 0, CONFIG.HEIGHT);
    pitch.addColorStop(0, '#2f9e3f');
    pitch.addColorStop(1, '#1f7a2c');
    ctx.fillStyle = pitch;
    ctx.fillRect(0, CONFIG.GROUND_Y - 6, CONFIG.WIDTH, CONFIG.HEIGHT - CONFIG.GROUND_Y + 6);

    // Mow stripes.
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#000000';
      ctx.fillRect(i * (CONFIG.WIDTH / 14), CONFIG.GROUND_Y - 6, CONFIG.WIDTH / 14, CONFIG.HEIGHT);
    }
    ctx.globalAlpha = 1;

    // Centre line + circle + halfway dot.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(CONFIG.WIDTH / 2, CONFIG.GROUND_Y - 4);
    ctx.lineTo(CONFIG.WIDTH / 2, CONFIG.HEIGHT);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(CONFIG.WIDTH / 2, CONFIG.HEIGHT - 30, 70, 28, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
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
