/* ============================================================================
 *  meeting.js — emergency meeting + voting. Honours SETTINGS (discuss/vote
 *  time, anonymous votes, confirm ejects). Driven by the game loop.
 * ========================================================================== */

const Meeting = (() => {
  let host, S = null;

  function init() { host = document.getElementById('meeting-overlay'); }
  function isActive() { return !!S; }

  function start({ reporter, body, crew, accused = null, onEnd }) {
    Sound.meeting();
    S = { phase: 'discuss', timer: SETTINGS.discussTime, crew, reporter, body, accused, onEnd, votes: {}, tally: null };
    render();
  }

  function render() {
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
        <div class="meet-grid">${S.crew.map(seatHtml).join('')}</div>
        <div class="meet-foot">
          ${S.phase === 'vote' ? `<button class="meet-skip" data-vote="skip">SKIP VOTE</button>` : ''}
          <div class="meet-note" id="meet-note">${S.phase === 'discuss' ? 'Decide who is the impostor…' : S.phase === 'vote' ? 'Tap a crewmate to vote' : ''}</div>
        </div>
      </div>`;
    host.classList.add('show');
    if (S.phase === 'vote') host.querySelectorAll('[data-vote]').forEach(el => el.onclick = () => castPlayerVote(el.dataset.vote));
  }

  function seatHtml(c) {
    const me = c.isPlayer ? ' me' : '', dead = c.alive ? '' : ' dead';
    const voted = S.votes.player === c.id;
    const canVote = S.phase === 'vote' && c.alive && playerAlive() && !playerVoted();
    const showTally = S.tally && !SETTINGS.anonymousVotes;
    const tally = showTally ? (S.tally.perTarget[c.id] || 0) : 0;
    return `<div class="seat${me}${dead}${voted ? ' picked' : ''}" ${canVote ? `data-vote="${c.id}"` : ''}>
        <div class="seat-av" style="--c:${c.color.hex}">${c.alive ? '' : '<span class="seat-x">✕</span>'}</div>
        <div class="seat-name">${c.name}${c.isPlayer ? ' (you)' : ''}</div>
        ${showTally ? `<div class="seat-tally">${'•'.repeat(tally)}</div>` : (S.tally ? '<div class="seat-tally"></div>' : '')}
      </div>`;
  }

  function playerAlive() { return S.crew.find(c => c.isPlayer).alive; }
  function playerVoted() { return S.votes.player !== undefined; }

  function castPlayerVote(target) {
    if (playerVoted() || !playerAlive()) return;
    S.votes.player = target === 'skip' ? 'skip' : target;
    Sound.vote();
    const note = document.getElementById('meet-note'); if (note) note.textContent = 'Vote locked. Waiting for others…';
    render();
  }

  function collectBotVotes() {
    const world = Game.world();
    for (const c of S.crew) { if (c.isPlayer || !c.alive) continue; const v = AI.vote(c, world); S.votes[c.id] = v === null ? 'skip' : v; }
  }

  function tallyVotes() {
    const perTarget = {}; let skips = 0;
    const all = { ...S.votes };
    if (all.player === undefined && playerAlive()) all.player = 'skip';
    for (const k in all) { const v = all[k]; if (v === 'skip' || v == null) skips++; else perTarget[v] = (perTarget[v] || 0) + 1; }
    let top = null, topN = 0, tie = false;
    for (const id in perTarget) { if (perTarget[id] > topN) { topN = perTarget[id]; top = id; tie = false; } else if (perTarget[id] === topN) tie = true; }
    const ejected = (!top || tie || skips >= topN) ? null : S.crew.find(c => c.id === top);
    return { perTarget, skips, ejected };
  }

  function update(dt) {
    if (!S) return;
    S.timer -= dt;
    if (S.phase === 'discuss') { updateLabel(); if (S.timer <= 0) { S.phase = 'vote'; S.timer = SETTINGS.voteTime; render(); } }
    else if (S.phase === 'vote') {
      updateLabel();
      if (S.timer <= 0) { collectBotVotes(); S.tally = tallyVotes(); S.phase = 'result'; S.timer = 4.2; renderResult(); }
    } else if (S.phase === 'result') {
      if (S.timer <= 0) { const ej = S.tally.ejected; const cb = S.onEnd; S = null; host.classList.remove('show'); cb(ej); }
    }
  }

  function updateLabel() { const el = host.querySelector('.meet-phase'); if (el) el.textContent = (S.phase === 'discuss' ? 'Discuss · ' : 'Vote · ') + Math.ceil(Math.max(0, S.timer)) + 's'; }

  function renderResult() {
    render();
    Sound.eject();
    const ej = S.tally.ejected;
    if (ej) { const card = host.querySelector('.meet-card'); if (card) { const fx = document.createElement('div'); fx.className = 'eject-anim'; fx.innerHTML = `<div class="eject-fig" style="--c:${ej.color.hex}"></div>`; card.appendChild(fx); } }
    const aliveImp = S.crew.filter(c => c.alive && c.isImpostor).length - (ej && ej.isImpostor ? 1 : 0);
    let msg;
    if (!ej) msg = S.tally.skips ? 'No one was ejected. (Skipped / tie)' : 'No one was ejected. (Tie)';
    else if (SETTINGS.confirmEjects) msg = `${ej.name} was ${ej.isImpostor ? 'An Impostor' : 'not an Impostor'}.`;
    else msg = `${ej.name} was ejected.`;
    const sub = ej && SETTINGS.confirmEjects ? `${aliveImp} impostor${aliveImp === 1 ? '' : 's'} remain` : '';
    const note = document.getElementById('meet-note');
    if (note) note.innerHTML = `<b>${msg}</b><br><span class="meet-remain">${sub}</span>`;
  }

  return { init, start, update, isActive };
})();
