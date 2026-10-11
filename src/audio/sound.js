// All sound is generated with the Web Audio API, so there are no audio files to host.
// Browsers only allow audio after a user gesture, which is why init() runs from the START click.

let storedMute = false;
try { storedMute = localStorage.getItem('hg-muted') === '1'; } catch (e) { /* storage blocked */ }

export const Snd = {
  ctx: null,
  master: null,
  muted: storedMute,

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
    const rainBus = gain(RAIN_VOLUME); rainBus.connect(master);
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
    // soft A-minor pad for the game mood
    const pad = gain(0), plp = filt('lowpass', 700);
    plp.connect(pad); pad.connect(master);
    pad.gain.setTargetAtTime(0.032, ctx.currentTime + 2, 3);
    [110, 164.81, 196, 261.63].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f; o.detune.value = (i - 1.5) * 5; o.connect(plp); o.start();
    });
    const lfo = ctx.createOscillator(), lg = gain(260);
    lfo.frequency.value = 0.06; lfo.connect(lg).connect(plp.frequency); lfo.start();

    this.dripLoop();
    document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else ctx.resume(); });
  },

  ok() { return this.ctx && this.ctx.state === 'running'; },

  dripLoop() { setTimeout(() => { this.drip(); this.dripLoop(); }, 160 + Math.random() * 420); },

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
