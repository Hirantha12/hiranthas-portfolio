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
    master.connect(ctx.destination);
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

    // rain hiss
    const r = ctx.createBufferSource(); r.buffer = white; r.loop = true;
    r.connect(filt('highpass', 500)).connect(filt('lowpass', 3400)).connect(gain(0.15)).connect(master);
    r.start();
    // rain body
    const rb = ctx.createBufferSource(); rb.buffer = brown; rb.loop = true;
    rb.connect(filt('lowpass', 450)).connect(gain(0.22)).connect(master);
    rb.start();
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

  dripLoop() { setTimeout(() => { this.drip(); this.dripLoop(); }, 70 + Math.random() * 230); },

  drip() {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.white;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random() * 4200; bp.Q.value = 7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.08, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.06);
    s.connect(bp).connect(g).connect(this.master);
    s.start(t, Math.random() * 2, 0.15);
  },

  thunder() {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.brown;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(70, t + 4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.3, t + 0.25); g.gain.exponentialRampToValueAtTime(0.001, t + 4.2);
    s.connect(lp).connect(g).connect(this.master); s.start(t, Math.random(), 4.4);
    const c = ctx.createBufferSource(); c.buffer = this.white;
    const cl = ctx.createBiquadFilter(); cl.type = 'lowpass'; cl.frequency.value = 900;
    const cg = ctx.createGain(); cg.gain.setValueAtTime(0.35, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    c.connect(cl).connect(cg).connect(this.master); c.start(t, 0, 0.6);
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
