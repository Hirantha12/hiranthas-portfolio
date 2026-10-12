// All sound is generated with the Web Audio API, so there are no audio files to host.
// Browsers only allow audio after a user gesture, which is why init() runs from the START click.

let storedMute = false;
try { storedMute = localStorage.getItem('hg-muted') === '1'; } catch (e) { /* storage blocked */ }
// Chords for the soft background pad: A minor at night, a bright C major 7 by day.
const PAD = { night: [110, 164.81, 196, 261.63], day: [130.81, 196, 246.94, 329.63] };

export const Snd = {
  ctx: null,
  master: null,
  muted: storedMute,
  mood: 'night', // set by the page before START; 'day' plays birdsong, a breeze and a stream instead of rain

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const sr = ctx.sampleRate;
    const master = (this.master = ctx.createGain());
    master.gain.value = 0;
    // A gentle limiter so nothing (thunder, a burst of drips) ever jumps out at the listener.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -20; limiter.knee.value = 12; limiter.ratio.value = 4;
    limiter.attack.value = 0.01; limiter.release.value = 0.4;
    master.connect(limiter).connect(ctx.destination);
    master.gain.setTargetAtTime(this.muted ? 0 : 1, ctx.currentTime, 1.2);

    const white = ctx.createBuffer(1, sr * 3, sr);
    const w = white.getChannelData(0);
    for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
    const brown = ctx.createBuffer(1, sr * 3, sr);
    const b = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < b.length; i++) { const x = Math.random() * 2 - 1; last = (last + 0.02 * x) / 1.02; b[i] = last * 3.5; }
    this.white = white;
    this.brown = brown;

    const filt = (type, f, q) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q) n.Q.value = q; return n; };
    const gain = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };

    // Rain, tuned to sound like rain heard from indoors: warm and soft, without bright hiss.
    // Both layers go through one bus whose level drifts slowly up and down, like gusts.
    const RAIN_VOLUME = 0.25; // overall rain level (hiss, body and drips); lower = quieter
    const day = this.mood === 'day';
    // night sounds (rain) and day sounds (birds, breeze, stream) each have a bus that fades in or out
    const nightBus = (this.nightBus = gain(day ? 0 : 1)); nightBus.connect(master);
    const dayBus = (this.dayBus = gain(day ? 1 : 0)); dayBus.connect(master);
    const rainBus = gain(RAIN_VOLUME); rainBus.connect(nightBus);
    const gust = ctx.createOscillator(), gustDepth = gain(RAIN_VOLUME * 0.14);
    gust.frequency.value = 0.045; gust.connect(gustDepth).connect(rainBus.gain); gust.start();
    // rain hiss: darker and quieter (highs rolled off above ~1.8 kHz)
    const r = ctx.createBufferSource(); r.buffer = white; r.loop = true;
    const shelf = filt('highshelf', 2500); shelf.gain.value = -10;
    r.connect(filt('highpass', 350)).connect(filt('lowpass', 1800)).connect(shelf).connect(gain(0.08)).connect(rainBus);
    r.start();
    // rain body: a light, soft wash; the deep rumble below ~150 Hz is cut so it doesn't feel heavy
    const rb = ctx.createBufferSource(); rb.buffer = brown; rb.loop = true;
    rb.connect(filt('highpass', 150)).connect(filt('lowpass', 600)).connect(gain(0.07)).connect(rainBus);
    rb.start();
    this.rainBus = rainBus;
    // Day: a soft breeze that rises and falls, and a stream babbling somewhere behind the kiosk.
    const br = ctx.createBufferSource(); br.buffer = brown; br.loop = true;
    const breeze = gain(0.05), wind = ctx.createOscillator(), windDepth = gain(0.035);
    wind.frequency.value = 0.07; wind.connect(windDepth).connect(breeze.gain); wind.start();
    br.connect(filt('bandpass', 420, 0.6)).connect(filt('lowpass', 900)).connect(breeze).connect(dayBus); br.start();
    const water = ctx.createBufferSource(); water.buffer = white; water.loop = true;
    const wbp = filt('bandpass', 1100, 0.8), wob = ctx.createOscillator(), wobDepth = gain(380);
    wob.frequency.value = 3.3; wob.connect(wobDepth).connect(wbp.frequency); wob.start(); // a gurgle
    water.connect(filt('highpass', 300)).connect(wbp).connect(gain(0.022)).connect(dayBus); water.start(0, 1.3);
    this.streamBus = gain(0.6); this.streamBus.connect(dayBus);
    // soft pad for the game mood (A minor at night, C major 7 by day)
    const pad = gain(0), plp = filt('lowpass', 700);
    plp.connect(pad); pad.connect(master);
    pad.gain.setTargetAtTime(0.032, ctx.currentTime + 2, 3);
    this.pad = PAD[day ? 'day' : 'night'].map((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f; o.detune.value = (i - 1.5) * 5; o.connect(plp); o.start();
      return o;
    });
    const lfo = ctx.createOscillator(), lg = gain(260);
    lfo.frequency.value = 0.06; lfo.connect(lg).connect(plp.frequency); lfo.start();

    this.dripLoop();
    this.birdLoop();
    this.bubbleLoop();
    document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else ctx.resume(); });
  },

  ok() { return this.ctx && this.ctx.state === 'running'; },

  dripLoop() { setTimeout(() => { if (this.mood === 'night') this.drip(); this.dripLoop(); }, 160 + Math.random() * 420); },
  // Birdsong: a phrase every few seconds, sometimes answered by a second bird.
  birdLoop() {
    setTimeout(() => {
      if (this.mood === 'day') { this.bird(); if (Math.random() < 0.35) setTimeout(() => this.bird(), 500 + Math.random() * 900); }
      this.birdLoop();
    }, 1400 + Math.random() * 4200);
  },
  bubbleLoop() { setTimeout(() => { if (this.mood === 'day') this.bubble(); this.bubbleLoop(); }, 50 + Math.random() * 190); },

  // Switch between night (rain, thunder) and day (birds, breeze, stream), crossfading over 3 s.
  setMood(m) {
    this.mood = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime, day = m === 'day';
    this.nightBus.gain.setTargetAtTime(day ? 0 : 1, t, 0.9);
    this.dayBus.gain.setTargetAtTime(day ? 1 : 0, t, 0.9);
    this.pad.forEach((o, i) => o.frequency.setTargetAtTime(PAD[m][i], t, 0.8));
  },

  // One bird phrase: a "tweet-tweet", a quick falling trill, or a warble. Placed left or right.
  bird() {
    if (!this.ok()) return;
    const ctx = this.ctx, r = Math.random, t0 = ctx.currentTime + 0.02;
    let out = this.dayBus;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = r() * 1.6 - 0.8; p.connect(this.dayBus); out = p; }
    const vol = 0.022 + r() * 0.02;
    const note = (at, f0, f1, dur, v) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(v, at + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(out); o.start(at); o.stop(at + dur + 0.02);
    };
    const kind = Math.floor(r() * 3);
    if (kind === 0) { // tweet-tweet
      const f = 2600 + r() * 1400, k = 2 + Math.floor(r() * 3), up = r() < 0.5;
      for (let i = 0; i < k; i++) note(t0 + i * (0.14 + r() * 0.05), up ? f : f * 1.4, up ? f * 1.4 : f, 0.08 + r() * 0.04, vol);
    } else if (kind === 1) { // trill, falling
      const f = 4200 + r() * 900, k = 7 + Math.floor(r() * 8);
      for (let i = 0; i < k; i++) note(t0 + i * 0.055, f - i * 70, f - i * 70 - 450, 0.04, vol * 0.8);
    } else { // warble
      const o = ctx.createOscillator(), m = ctx.createOscillator(), md = ctx.createGain(), g = ctx.createGain(), d = 0.35 + r() * 0.35;
      o.frequency.value = 2300 + r() * 800; m.frequency.value = 22 + r() * 18; md.gain.value = 220 + r() * 260;
      m.connect(md).connect(o.frequency);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol * 0.8, t0 + 0.04); g.gain.setValueAtTime(vol * 0.8, t0 + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g).connect(out); o.start(t0); m.start(t0); o.stop(t0 + d + 0.02); m.stop(t0 + d + 0.02);
    }
  },
  // A tiny rising "blip": many of them in a row sound like water running over stones.
  bubble() {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime, r = Math.random;
    const o = ctx.createOscillator(), g = ctx.createGain(), f = 350 + r() * 650, d = 0.025 + r() * 0.04;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (1.8 + r()), t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.006 + r() * 0.01, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(this.streamBus); o.start(t); o.stop(t + d + 0.01);
  },

  // A single soft drop: lower pitched, gentle attack, placed somewhere left or right.
  drip() {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.white;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 1700; bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.012 + Math.random() * 0.025, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07 + Math.random() * 0.08);
    let out = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 1.4 - 0.7; g.connect(p); out = p; }
    s.connect(bp).connect(g); out.connect(this.rainBus);
    s.start(t, Math.random() * 2, 0.18);
  },

  // Thunder the way it sounds outdoors. A close strike starts with a sharp crack and a few
  // crackles, then rolls; a distant one is only a soft, low, long rumble that comes in slowly.
  // Several swells make it "roll", and a short echo off the city adds space.
  // near: 0 (far away) to 1 (almost overhead). pan: -1 (left) to 1 (right).
  thunder(near = 0.5, pan = 0) {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime, rnd = Math.random;
    const filt = (type, f, q) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q) n.Q.value = q; return n; };
    let out = this.master;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)) * 0.6; p.connect(this.master); out = p; }
    const bus = ctx.createGain(); bus.connect(out);
    const echo = ctx.createDelay(1); echo.delayTime.value = 0.17 + rnd() * 0.12;
    const fb = ctx.createGain(); fb.gain.value = 0.32; const wet = ctx.createGain(); wet.gain.value = 0.28;
    bus.connect(echo); echo.connect(fb).connect(echo); echo.connect(wet).connect(out);
    const noise = (buf, at, dur) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(at, rnd() * 2); s.stop(at + dur); return s; };

    // 1) the crack: only when the strike is close
    if (near > 0.45) {
      const k = (near - 0.45) / 0.55;
      const c = noise(this.white, t, 0.5), cg = ctx.createGain();
      cg.gain.setValueAtTime(0, t); cg.gain.linearRampToValueAtTime(0.32 * k + 0.08, t + 0.006); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      c.connect(filt('bandpass', 1800 + rnd() * 900, 0.6)).connect(cg).connect(bus);
      for (let i = 0; i < 3 + Math.floor(rnd() * 4); i++) { // crackles
        const at = t + 0.02 + rnd() * 0.35, s = noise(this.white, at, 0.06), g = ctx.createGain();
        g.gain.setValueAtTime(0.12 * k + 0.04, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.03 + rnd() * 0.03);
        s.connect(filt('bandpass', 1200 + rnd() * 2400, 1.2)).connect(g).connect(bus);
      }
    }

    // 2) the rumble: a deep layer plus a mid layer, so it is heard on laptop and phone speakers
    const dur = 3.2 + (1 - near) * 3.5, attack = near > 0.6 ? 0.05 : 0.35 + (1 - near) * 0.5;
    const peak = 0.45 + near * 0.55;
    const deep = noise(this.brown, t, dur + 0.2), dlp = filt('lowpass', 260 + near * 380);
    dlp.frequency.setValueAtTime(260 + near * 380, t); dlp.frequency.exponentialRampToValueAtTime(80, t + dur);
    const mid = noise(this.white, t, dur + 0.2), mlp = filt('lowpass', 520 + near * 600);
    mlp.frequency.setValueAtTime(520 + near * 600, t); mlp.frequency.exponentialRampToValueAtTime(150, t + dur * 0.8);
    const midG = ctx.createGain(); midG.gain.value = 0.16;
    const env = ctx.createGain();
    deep.connect(dlp).connect(env); mid.connect(filt('highpass', 90)).connect(mlp).connect(midG).connect(env); env.connect(bus);
    const g = env.gain;
    g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak, t + attack);
    const swells = 3 + Math.floor(rnd() * 3);
    for (let i = 1; i <= swells; i++) { // rolling: it surges and fades a few times as it travels
      const at = t + attack + (dur - attack) * (i / (swells + 1));
      g.linearRampToValueAtTime(peak * (0.3 + rnd() * 0.5) * (1 - (i / (swells + 1)) * 0.6), at);
    }
    g.exponentialRampToValueAtTime(0.001, t + dur);
  },

  // wooden piece landing on a board
  clack(pitch = 1, vol = 0.5) {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.white;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300 * pitch; bp.Q.value = 2.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    s.connect(bp).connect(g).connect(this.master); s.start(t, Math.random() * 2, 0.1);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(240 * pitch, t); o.frequency.exponentialRampToValueAtTime(90 * pitch, t + 0.14);
    const og = ctx.createGain(); og.gain.setValueAtTime(vol * 0.7, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(og).connect(this.master); o.start(t); o.stop(t + 0.18);
  },

  tick() {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 1400;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.05);
  },

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('hg-muted', m ? '1' : '0'); } catch (e) { /* storage blocked */ }
    if (this.ctx) { this.ctx.resume(); this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.25); }
  },
};
