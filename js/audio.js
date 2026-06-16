/* ============================================================================
 *  audio.js — synthesized SFX via Web Audio API (no asset files).
 * ========================================================================== */

const Sound = (() => {
  let ctx = null, master = null, muted = false;

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  }
  function resume() { ensure(); if (ctx.state === 'suspended') ctx.resume(); }

  function tone(freq, dur, type = 'sine', vol = 0.5, slideTo = null) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }
  function noise(dur, vol = 0.4, freq = 1000, type = 'bandpass') {
    if (!ctx || muted) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type = type; filt.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(filt); filt.connect(g); g.connect(master); src.start(); src.stop(ctx.currentTime + dur);
  }

  return {
    init: ensure, resume,
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    isMuted: () => muted,

    step()     { resume(); tone(120, 0.04, 'sine', 0.05); },
    use()      { resume(); tone(520, 0.06, 'square', 0.25); },
    taskOk()   { resume(); [660, 880, 1180].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'square', 0.3), i * 80)); },
    taskDone() { resume(); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.15, 'triangle', 0.32), i * 90)); },
    kill()     { resume(); tone(180, 0.25, 'sawtooth', 0.5, 50); noise(0.25, 0.4, 600); },
    body()     { resume(); tone(90, 0.5, 'sawtooth', 0.45, 40); },
    meeting()  { resume(); tone(440, 0.5, 'square', 0.35, 660); setTimeout(() => tone(330, 0.6, 'square', 0.3), 200); },
    vote()     { resume(); tone(700, 0.08, 'square', 0.3); },
    eject()    { resume(); tone(300, 0.7, 'sine', 0.35, 120); },
    sabotage() { resume(); for (let i = 0; i < 3; i++) setTimeout(() => { tone(880, 0.18, 'square', 0.35); }, i * 260); noise(0.6, 0.2, 400); },
    alarm()    { resume(); tone(990, 0.2, 'sawtooth', 0.3, 700); },
    win()      { resume(); [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.4), i * 130)); },
    lose()     { resume(); [392, 330, 262, 175].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'sawtooth', 0.35), i * 160)); },
    click()    { resume(); tone(440, 0.05, 'square', 0.22); },
  };
})();
