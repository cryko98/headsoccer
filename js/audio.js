/* ============================================================================
 *  audio.js — procedurally synthesized SFX + crowd ambience (Web Audio API)
 *  No external audio assets required.
 * ========================================================================== */

const Sound = (() => {
  let ctx = null;
  let master = null;
  let muted = false;
  let crowdGain = null;

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }

  function resume() { ensure(); if (ctx.state === 'suspended') ctx.resume(); }

  function tone(freq, dur, type = 'sine', vol = 0.5, slideTo = null) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  function noise(dur, vol = 0.4, filterFreq = 1000) {
    if (!ctx || muted) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(); src.stop(ctx.currentTime + dur);
  }

  // Soft continuous crowd hum built from filtered noise.
  function startCrowd() {
    if (!ctx || crowdGain) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 420;
    crowdGain = ctx.createGain();
    crowdGain.gain.value = 0.05;
    src.connect(filt); filt.connect(crowdGain); crowdGain.connect(master);
    src.start();
  }

  function crowdRoar() {
    if (!ctx || muted) return;
    if (crowdGain) {
      crowdGain.gain.cancelScheduledValues(ctx.currentTime);
      crowdGain.gain.setValueAtTime(0.05, ctx.currentTime);
      crowdGain.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 0.15);
      crowdGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1.6);
    }
    noise(1.4, 0.3, 700);
  }

  return {
    init() { ensure(); startCrowd(); },
    resume,
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.6; },
    isMuted() { return muted; },

    kick()    { resume(); tone(180, 0.12, 'square', 0.5, 90); noise(0.06, 0.3, 1800); },
    power()   { resume(); tone(120, 0.25, 'sawtooth', 0.55, 60); noise(0.12, 0.35, 1200); },
    bounce()  { resume(); tone(260, 0.08, 'sine', 0.25, 180); },
    jump()    { resume(); tone(330, 0.14, 'triangle', 0.3, 520); },
    wall()    { resume(); tone(200, 0.05, 'sine', 0.18, 150); },
    whistle() { resume(); tone(2200, 0.18, 'square', 0.25, 2600); tone(2600, 0.12, 'square', 0.2); },
    goal()    { resume(); crowdRoar();
                [523, 659, 784, 1047].forEach((f, i) =>
                  setTimeout(() => tone(f, 0.22, 'square', 0.4), i * 90)); },
    win()     { resume(); crowdRoar();
                [523, 659, 784, 1047, 1319].forEach((f, i) =>
                  setTimeout(() => tone(f, 0.3, 'triangle', 0.45), i * 130)); },
    lose()    { resume(); [392, 330, 262, 196].forEach((f, i) =>
                  setTimeout(() => tone(f, 0.3, 'sawtooth', 0.35), i * 160)); },
    coin()    { resume(); tone(880, 0.08, 'square', 0.35); setTimeout(() => tone(1320, 0.12, 'square', 0.35), 70); },
    click()   { resume(); tone(440, 0.05, 'square', 0.25); },
  };
})();
