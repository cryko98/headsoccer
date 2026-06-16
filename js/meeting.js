/* ============================================================================
 *  meeting.js — emergency meeting + voting. Driven by the game loop via update.
 * ========================================================================== */

const Meeting = (() => {
  let host, S = null;

  function init() { host = document.getElementById('meeting-overlay'); }
  function isActive() { return !!S; }

  function start({ reporter, body, crew, accused = null, onEnd }) {
    Sound.meeting();
    S = { phase: 'discuss', timer: CFG.MEETING_DISCUSS, crew, reporter, body, accused, onEnd, votes: {}, tally: null, ejected: undefined };
    render();
  }

  function render() {
    const alive = S.crew.filter(c => c.alive);
    const header = S.body ? `${S.reporter.name} reported a body` : `${S.reporter.name} called an emergency meeting`;
    const phaseLabel = S.phase === 'discuss' ? `Discuss · ${Math.ceil(S.timer)}s`
      : S.phase === 'vote' ? `Vote · ${Math.ceil(S.timer)}s` : 'Results';

    host.innerHTML = `
      <div class="meet-card">
        <div class="meet-head">
          <div class="meet-title">EMERGENCY MEETING</div>
          <div class="meet-sub">${header}</div>
          <div class="meet-phase ${S.phase}">${phaseLabel}</div>
        </div>
        <div class="meet-grid">
          ${S.crew.map(c => seatHtml(c)).join('')}
        </div>
        <div class="meet-foot">
          ${S.phase === 'vote' ? `<button class="meet-skip" data-vote="skip">SKIP VOTE</button>` : ''}
          <div class="meet-note" id="meet-note">${S.phase === 'discuss' ? 'Decide who is the impostor…' : S.phase === 'vote' ? 'Tap a crewmate to vote' : ''}</div>
        </div>
      </div>`;
    host.classList.add('show');

    if (S.phase === 'vote') {
      host.querySelectorAll('[data-vote]').forEach(el => {
        el.onclick = () => castPlayerVote(el.dataset.vote);
      });
    }
  }

  function seatHtml(c) {
    const me = c.isPlayer ? ' me' : '';
    const dead = c.alive ? '' : ' dead';
    const voted = S.votes.player === (c.isPlayer ? 'self' : c.id);
    const canVote = S.phase === 'vote' && c.alive && playerAlive() && !playerVoted();
    const tally = S.tally ? (S.tally.perTarget[c.id] || 0) : 0;
    return `<div class="seat${me}${dead}${voted ? ' picked' : ''}" ${canVote ? `data-vote="${c.id}"` : ''}>
        <div class="seat-av" style="--c:${c.color.hex}">${c.alive ? '' : '<span class="seat-x">✕</span>'}</div>
        <div class="seat-name">${c.name}${c.isPlayer ? ' (you)' : ''}</div>
        ${S.tally ? `<div class="seat-tally">${'•'.repeat(tally)}</div>` : ''}
      </div>`;
  }

  function playerAlive() { return S.crew.find(c => c.isPlayer).alive; }
  function playerVoted() { return S.votes.player !== undefined; }

  function castPlayerVote(target) {
    if (playerVoted() || !playerAlive()) return;
    S.votes.player = target === 'skip' ? 'skip' : target;
    Sound.vote();
    const note = document.getElementById('meet-note');
    if (note) note.textContent = 'Vote locked. Waiting for others…';
    render();
  }

  function collectBotVotes() {
    const world = Game.world();
    for (const c of S.crew) {
      if (c.isPlayer || !c.alive) continue;
      const v = AI.vote(c, world);
      S.votes[c.id] = v === null ? 'skip' : v;
    }
  }

  function tallyVotes() {
    const perTarget = {}; let skips = 0;
    const all = { ...S.votes };
    if (all.player === undefined && playerAlive()) all.player = 'skip';
    for (const k in all) {
      const v = all[k];
      if (v === 'skip' || v == null) skips++;
      else perTarget[v] = (perTarget[v] || 0) + 1;
    }
    let top = null, topN = 0, tie = false;
    for (const id in perTarget) { if (perTarget[id] > topN) { topN = perTarget[id]; top = id; tie = false; } else if (perTarget[id] === topN) tie = true; }
    const ejected = (!top || tie || skips >= topN) ? null : S.crew.find(c => c.id === top);
    return { perTarget, skips, ejected };
  }

  function update(dt) {
    if (!S) return;
    S.timer -= dt;

    if (S.phase === 'discuss') {
      updatePhaseLabel();
      if (S.timer <= 0) { S.phase = 'vote'; S.timer = CFG.MEETING_VOTE; render(); }
    } else if (S.phase === 'vote') {
      updatePhaseLabel();
      if (S.timer <= 0) {
        collectBotVotes();
        S.tally = tallyVotes();
        S.phase = 'result';
        S.timer = 4.0;
        renderResult();
      }
    } else if (S.phase === 'result') {
      if (S.timer <= 0) { const ej = S.tally.ejected; const cb = S.onEnd; S = null; host.classList.remove('show'); cb(ej); }
    }
  }

  function updatePhaseLabel() {
    const el = host.querySelector('.meet-phase');
    if (el) el.textContent = (S.phase === 'discuss' ? 'Discuss · ' : 'Vote · ') + Math.ceil(Math.max(0, S.timer)) + 's';
  }

  function renderResult() {
    render();
    const ej = S.tally.ejected;
    Sound.eject();
    const aliveImp = S.crew.filter(c => c.alive && c.isImpostor).length - (ej && ej.isImpostor ? 1 : 0);
    let msg;
    if (!ej) msg = 'No one was ejected. (Skipped or tie)';
    else if (CFG.EJECT_REVEAL) msg = `${ej.name} was ${ej.isImpostor ? 'An Impostor' : 'not an Impostor'}.`;
    else msg = `${ej.name} was ejected.`;
    const sub = ej && CFG.EJECT_REVEAL ? `${aliveImp} impostor${aliveImp === 1 ? '' : 's'} remain` : '';
    const note = document.getElementById('meet-note');
    if (note) { note.innerHTML = `<b>${msg}</b><br><span class="meet-remain">${sub}</span>`; }
  }

  return { init, start, update, isActive };
})();
