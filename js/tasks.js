/* ============================================================================
 *  tasks.js — task minigames rendered as DOM overlays. Tasks.open(task, done).
 * ========================================================================== */

const Tasks = (() => {
  let host, onDone, current;

  function init() { host = document.getElementById('task-overlay'); }

  function close(success) {
    host.classList.remove('show');
    host.innerHTML = '';
    const cb = onDone; onDone = null; const t = current; current = null;
    if (success && cb) cb(t);
  }

  function shell(title, bodyHtml) {
    host.innerHTML = `
      <div class="task-card">
        <div class="task-head"><span>${title}</span>
          <button class="task-x" id="task-x">✕</button></div>
        <div class="task-body">${bodyHtml}</div>
      </div>`;
    host.classList.add('show');
    document.getElementById('task-x').onclick = () => close(false);
  }

  function open(task, done) {
    onDone = done; current = task;
    Sound.use();
    const map = { wires, download, card, keypad, hold, asteroids, scan };
    (map[task.type] || hold)(task);
  }

  // ----- Visual scan: auto-filling medical scan -----
  function scan() {
    shell('Submit Scan',
      `<div class="scan-wrap">
        <svg width="120" height="150" viewBox="0 0 120 150">
          <rect x="40" y="58" width="40" height="60" rx="16" fill="#5a7fbf"/>
          <circle cx="60" cy="42" r="22" fill="#5a7fbf"/>
          <line id="scanline" x1="10" y1="20" x2="110" y2="20" stroke="#7ee6ff" stroke-width="3"/>
        </svg>
        <div class="bar"><div class="bar-fill" id="scf"></div></div>
        <div class="task-hint">Hold still — others can see you scanning</div></div>`);
    let p = 0, raf; const f = document.getElementById('scf'), line = document.getElementById('scanline');
    const tick = () => { p = Math.min(100, p + 0.9); f.style.width = p + '%'; if (line) line.setAttribute('y1', 20 + p * 1.1), line.setAttribute('y2', 20 + p * 1.1); if (p >= 100) { finish(); return; } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
  }

  // ----- Wiring: connect matching colours -----
  function wires() {
    const cols = Util.shuffle(['#e2333a', '#1f6fe0', '#f4d13d', '#33b14b']);
    const right = Util.shuffle(cols.slice());
    shell('Fix Wiring',
      `<div class="wire-wrap"><svg id="wsvg" width="380" height="240"></svg>
       <div class="wire-side left">${cols.map((c, i) => `<div class="wnode" data-side="L" data-c="${c}" data-i="${i}" style="--c:${c};top:${20 + i * 56}px"></div>`).join('')}</div>
       <div class="wire-side right">${right.map((c, i) => `<div class="wnode" data-side="R" data-c="${c}" data-i="${i}" style="--c:${c};top:${20 + i * 56}px"></div>`).join('')}</div>
       </div><div class="task-hint">Connect each wire to the matching colour</div>`);
    let sel = null, made = 0;
    const svg = document.getElementById('wsvg');
    host.querySelectorAll('.wnode').forEach(n => {
      n.onclick = () => {
        if (n.dataset.side === 'L') { sel = n; host.querySelectorAll('.wnode').forEach(x => x.classList.remove('sel')); n.classList.add('sel'); }
        else if (sel && sel.dataset.c === n.dataset.c && !n.classList.contains('done')) {
          const lr = sel.getBoundingClientRect(), rr = n.getBoundingClientRect(), sr = svg.getBoundingClientRect();
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', 8); line.setAttribute('y1', lr.top - sr.top + 11);
          line.setAttribute('x2', 372); line.setAttribute('y2', rr.top - sr.top + 11);
          line.setAttribute('stroke', sel.dataset.c); line.setAttribute('stroke-width', 7); line.setAttribute('stroke-linecap', 'round');
          svg.appendChild(line);
          sel.classList.add('done'); n.classList.add('done'); sel.classList.remove('sel'); sel = null;
          Sound.use(); if (++made === 4) finish();
        }
      };
    });
  }

  // ----- Download / Upload: hold to transfer -----
  function download(task) {
    const up = task.name.toLowerCase().includes('upload');
    shell(up ? 'Upload Data' : 'Download Data',
      `<div class="dl-wrap"><div class="dl-icon">${up ? '▲' : '▼'}</div>
        <div class="bar"><div class="bar-fill" id="dlf"></div></div>
        <div class="dl-pct" id="dlp">0%</div>
        <button class="task-btn" id="dlb">HOLD TO TRANSFER</button></div>`);
    let p = 0, holding = false, raf;
    const f = document.getElementById('dlf'), pct = document.getElementById('dlp'), btn = document.getElementById('dlb');
    const tick = () => { if (holding) { p = Math.min(100, p + 1.4); f.style.width = p + '%'; pct.textContent = Math.floor(p) + '%'; if (p >= 100) { finish(); return; } } raf = requestAnimationFrame(tick); };
    btn.onmousedown = btn.ontouchstart = () => holding = true;
    window.onmouseup = () => holding = false;
    raf = requestAnimationFrame(tick);
  }

  // ----- Card swipe: drag across at the right speed -----
  function card() {
    shell('Swipe Card',
      `<div class="card-wrap"><div class="card-slot"><div class="card-track"></div>
        <div class="swipe-card" id="scard">CARD</div></div>
        <div class="card-hint" id="chint">Drag the card left → right, not too fast</div></div>`);
    const c = document.getElementById('scard'), hint = document.getElementById('chint');
    let dragging = false, startX = 0, t0 = 0, left = 0;
    const onDown = e => { dragging = true; startX = (e.touches ? e.touches[0].clientX : e.clientX) - left; t0 = performance.now(); };
    const onMove = e => {
      if (!dragging) return;
      const cx = (e.touches ? e.touches[0].clientX : e.clientX);
      left = Util.clamp(cx - startX, 0, 300); c.style.transform = `translateX(${left}px)`;
    };
    const onUp = () => {
      if (!dragging) return; dragging = false;
      const dt = performance.now() - t0;
      if (left > 285 && dt > 280 && dt < 1400) { finish(); }
      else { hint.textContent = left < 285 ? 'Swipe all the way across' : (dt <= 280 ? 'Too fast — try again' : 'Too slow — try again'); c.style.transform = 'translateX(0)'; left = 0; }
    };
    c.onmousedown = onDown; window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    c.ontouchstart = onDown; window.addEventListener('touchmove', onMove); window.addEventListener('touchend', onUp);
  }

  // ----- Keypad: enter the shown code -----
  function keypad() {
    const code = Array.from({ length: 5 }, () => 1 + Math.floor(Math.random() * 9));
    shell('Enter Code',
      `<div class="kp-wrap"><div class="kp-code">${code.map(n => `<span>${n}</span>`).join('')}</div>
        <div class="kp-entry" id="kpe"></div>
        <div class="kp-grid">${[1,2,3,4,5,6,7,8,9].map(n => `<button class="kp-b" data-n="${n}">${n}</button>`).join('')}</div></div>`);
    let idx = 0; const entry = document.getElementById('kpe');
    host.querySelectorAll('.kp-b').forEach(b => b.onclick = () => {
      const n = +b.dataset.n;
      if (n === code[idx]) { idx++; entry.innerHTML += `<span>${n}</span>`; Sound.use(); if (idx === code.length) finish(); }
      else { idx = 0; entry.innerHTML = ''; entry.classList.add('shake'); setTimeout(() => entry.classList.remove('shake'), 300); }
    });
  }

  // ----- Hold lever -----
  function hold() {
    shell('Hold to Complete',
      `<div class="dl-wrap"><div class="bar tall"><div class="bar-fill" id="hf"></div></div>
        <button class="task-btn" id="hb">PUSH &amp; HOLD</button></div>`);
    let p = 0, holding = false, raf;
    const f = document.getElementById('hf'), btn = document.getElementById('hb');
    const tick = () => { p = holding ? Math.min(100, p + 1.6) : Math.max(0, p - 1.2); f.style.height = p + '%'; if (p >= 100) { finish(); return; } raf = requestAnimationFrame(tick); };
    btn.onmousedown = btn.ontouchstart = () => holding = true;
    window.onmouseup = window.ontouchend = () => holding = false;
    raf = requestAnimationFrame(tick);
  }

  // ----- Asteroids: click targets -----
  function asteroids() {
    shell('Clear Asteroids',
      `<div class="ast-wrap" id="astw"><div class="ast-count" id="astc">0 / 8</div></div>`);
    const wrap = document.getElementById('astw'), counter = document.getElementById('astc');
    let hit = 0; const W = 360, H = 230;
    const spawn = () => {
      if (hit >= 8) return;
      const a = document.createElement('div'); a.className = 'asteroid';
      a.style.left = Util.rand(10, W - 50) + 'px'; a.style.top = Util.rand(40, H - 50) + 'px';
      a.onclick = () => { if (!a._dead) { a._dead = true; a.remove(); counter.textContent = `${++hit} / 8`; Sound.use(); if (hit >= 8) finish(); else spawn(); } };
      wrap.appendChild(a);
      setTimeout(() => { if (!a._dead && hit < 8) { a.remove(); spawn(); } }, 1500);
    };
    for (let i = 0; i < 3; i++) spawn();
  }

  function finish() { Sound.taskOk(); setTimeout(() => close(true), 250); }

  return { init, open, close, isOpen: () => host && host.classList.contains('show') };
})();
