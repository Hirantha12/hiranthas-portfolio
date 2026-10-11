// "Knight's tour": the Experience section's game mode. Hirantha's avatar stands on the plaza
// floor (itself a giant chessboard), first shows how a knight moves, then makes six knight
// jumps, one per career role. Each landing raises a pillar of light with that role on it, and
// a glowing L marks the path behind him. Visitors click the glowing square to jump.
// The plain Experience list stays the default; this only starts from "Walk my journey".
import * as THREE from 'three';
import gsap from 'gsap';
import { cnv, tex, fitFont } from './canvas.js';
import { MOVES, PROFILE } from '../data/content.js';
import { Snd } from '../audio/sound.js';

const SQ = 140 / 72; // one square of the plaza floor (floor radius 70, chessboard texture repeated 9 times)
const at = (c, r) => new THREE.Vector3((c + 0.5) * SQ, 0, (r + 0.5) * SQ);
// Start, then one landing square per role: a zig-zag of knight moves (two across, one forward)
// from the front of the plaza up to the chessboard table in front of his kiosk.
const PATH = [[-1, 8], [1, 7], [-1, 6], [1, 5], [-1, 4], [1, 3], [-1, 2]];
const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const PHASE = { Opening: '#3ef2ff', Middlegame: '#a77bff', 'Current position': '#57ffb0' };
const AMBER = '#ffb547';

const INTRO = [
  { text: "Hi! On this board I'm a knight, my favourite chess piece. Let me show you how I move.", show: 'none' },
  { text: 'A knight moves in an L: two squares in one direction, then one square to the side.', show: 'L' },
  { text: 'From any square it can land on up to eight squares like these.', show: 'all' },
  { text: "And it's the only piece that jumps over others, so nothing blocks its way. My career had a few jumps like that. Follow me through six of them!", show: 'jump' },
];

/* ---------- voice: the browser reads his lines aloud while his mouth moves ---------- */
const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
let voice = null;
function pickVoice() {
  if (!synth) return;
  const vs = synth.getVoices();
  voice = vs.find((v) => /en-IN/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang) && /male|david|daniel|guy|ravi/i.test(v.name) && !/female/i.test(v.name)) || vs.find((v) => /^en/i.test(v.lang)) || null;
}
if (synth) { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }

export function createJourney({ scene, panel, getAvatar, onCamera, onExit, scale, reduce }) {
  const D = reduce ? 0.35 : 1;
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const flat = (m) => { m.rotation.x = -Math.PI / 2; return m; };
  const glowMat = (color, opacity) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

  /* ---------- floor marks ---------- */
  const squareGeo = new THREE.PlaneGeometry(SQ * 0.92, SQ * 0.92);
  const pool = [];
  function mark(c, r, color, opacity) {
    let m = pool.find((x) => !x.visible);
    if (!m) { m = flat(new THREE.Mesh(squareGeo, glowMat(color, 0))); group.add(m); pool.push(m); }
    m.material.color.set(color); m.material.opacity = 0; m.visible = true;
    m.position.copy(at(c, r)).setY(0.035); m.userData = { kind: 'jsq', c, r };
    gsap.to(m.material, { opacity, duration: 0.35 });
    return m;
  }
  const clearMarks = () => pool.forEach((m) => { gsap.killTweensOf(m.material); m.visible = false; });

  // An L-shaped line on the floor (two squares one way, one square the other), drawn as two strips.
  const lines = [];
  function lShape(a, b, color, opacity, grow) {
    const pa = at(...a), pb = at(...b), dc = b[0] - a[0], dr = b[1] - a[1];
    const corner = Math.abs(dc) === 2 ? at(b[0], a[1]) : at(a[0], b[1]);
    const g = new THREE.Group(); g.position.y = 0.045;
    [[pa, corner], [corner, pb]].forEach(([p, q], i) => {
      const len = p.distanceTo(q) + (i === 0 ? 0.12 : 0);
      const strip = flat(new THREE.Mesh(new THREE.PlaneGeometry(0.16, len), glowMat(color, opacity)));
      strip.position.copy(p).lerp(q, 0.5); strip.position.y = 0;
      strip.rotation.z = Math.atan2(q.x - p.x, q.z - p.z) + Math.PI; // plane's long side follows p→q
      g.add(strip);
      if (grow) { strip.scale.y = 0.001; gsap.to(strip.scale, { y: 1, duration: 0.3 * D, delay: i * 0.3 * D }); }
    });
    const dot = flat(new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), glowMat(color, opacity))); dot.position.copy(pb).setY(0); g.add(dot);
    group.add(g); lines.push(g);
    return g;
  }
  const clearLines = () => { lines.forEach((g) => { group.remove(g); g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }); lines.length = 0; };

  // A ring that follows his feet: his "piece" on the board.
  const base = flat(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 8, 64), glowMat(AMBER, 0.9))); base.position.y = 0.05; group.add(base);

  /* ---------- milestones: a pillar of light and a floating card for each role ---------- */
  const fade = (() => { const [c, x] = cnv(4, 128); const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,.7)'); x.fillStyle = g; x.fillRect(0, 0, 4, 128); return tex(c); })();
  function cardTexture(m, i) {
    const [c, x] = cnv(768, 340), col = PHASE[m.phase] || AMBER;
    x.fillStyle = 'rgba(10,8,20,.86)'; x.fillRect(0, 0, 768, 340);
    x.strokeStyle = col; x.lineWidth = 6; x.strokeRect(3, 3, 762, 334);
    x.fillStyle = col; x.fillRect(3, 3, 762, 10);
    x.textBaseline = 'middle';
    x.font = '600 30px "JetBrains Mono", monospace'; x.fillStyle = col;
    x.fillText(`MOVE ${i + 1} · ${m.phase.toUpperCase()}`, 36, 62);
    x.fillStyle = '#f3ead8'; fitFont(x, m.role, 700, '"Chakra Petch", sans-serif', 66, 700); x.fillText(m.role, 34, 150);
    x.font = '500 34px "Chakra Petch", sans-serif'; x.fillStyle = 'rgba(243,234,216,.85)';
    let org = m.org; while (x.measureText(org).width > 700 && org.length > 4) org = org.slice(0, -2);
    x.fillText(org === m.org ? org : org + '…', 36, 225);
    x.font = '500 28px "JetBrains Mono", monospace'; x.fillStyle = 'rgba(200,190,230,.85)'; x.fillText(m.when, 36, 288);
    return tex(c);
  }
  const stones = MOVES.map((m, i) => {
    const col = new THREE.Color(PHASE[m.phase] || AMBER);
    const g = new THREE.Group(); g.position.copy(at(...PATH[i + 1])); g.visible = false; group.add(g);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 4, 40, 1, true),
      new THREE.MeshBasicMaterial({ color: col, alphaMap: fade, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    pillar.position.y = 2; g.add(pillar);
    const burst = flat(new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 48), glowMat(col, 0))); burst.position.y = 0.06; g.add(burst);
    const card = new THREE.Sprite(new THREE.SpriteMaterial({ map: cardTexture(m, i), transparent: true, opacity: 0, depthWrite: false }));
    card.position.y = 4; card.scale.set(0.001, 0.001, 1); g.add(card);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4.6, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
    hit.position.y = 2.3; hit.userData = { kind: 'jstone', i }; g.add(hit);
    return { g, pillar, burst, card, hit };
  });
  const CARD_W = 3, cardScale = (s) => ({ x: CARD_W * s, y: CARD_W * s * (340 / 768) });

  function reveal(i) {
    const s = stones[i]; s.g.visible = true;
    s.pillar.scale.y = 0.01; s.pillar.position.y = 0.02; s.pillar.material.opacity = 0.6;
    gsap.to(s.pillar.scale, { y: 1, duration: 0.7 * D, ease: 'power3.out' });
    gsap.to(s.pillar.position, { y: 2, duration: 0.7 * D, ease: 'power3.out' });
    gsap.to(s.pillar.material, { opacity: 0.16, duration: 1.2, delay: 0.7 * D });
    s.burst.scale.setScalar(0.4); s.burst.material.opacity = 1;
    gsap.to(s.burst.scale, { x: 4, y: 4, z: 4, duration: 1.1 * D, ease: 'power2.out' });
    gsap.to(s.burst.material, { opacity: 0, duration: 1.1 * D });
    s.card.position.y = 0.6; s.card.material.opacity = 0;
    gsap.to(s.card.position, { y: 4, duration: 0.9 * D, delay: 0.15 * D, ease: 'back.out(1.4)' });
    gsap.to(s.card.material, { opacity: 1, duration: 0.5 * D, delay: 0.15 * D });
    gsap.to(s.card.scale, { ...cardScale(1), duration: 0.8 * D, delay: 0.15 * D, ease: 'back.out(1.6)' });
    // earlier milestones step back so the newest one stands out
    stones.forEach((o, j) => {
      if (j >= i || !o.g.visible) return;
      gsap.to(o.card.material, { opacity: 0.55, duration: 0.5 }); gsap.to(o.card.scale, { ...cardScale(0.7), duration: 0.5 });
      gsap.to(o.pillar.material, { opacity: 0.1, duration: 0.5 });
    });
    chime(i);
  }
  function chime(i) { // two soft bell notes, rising a little with each role
    if (!Snd.ok()) return;
    const ctx = Snd.ctx, t = ctx.currentTime, f0 = 523.25 * Math.pow(2, (i * 2) / 12);
    [f0, f0 * 1.5].forEach((f, k) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + k * 0.09); g.gain.linearRampToValueAtTime(0.09, t + k * 0.09 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + k * 0.09 + 1.4);
      o.connect(g).connect(Snd.master); o.start(t + k * 0.09); o.stop(t + k * 0.09 + 1.5);
    });
  }

  /* ---------- voice ---------- */
  let speakId = 0;
  function say(text) {
    const av = getAvatar(); const id = ++speakId;
    if (synth) synth.cancel();
    const done = () => { if (id === speakId && av) av.talk(false); };
    if (av) av.talk(true);
    if (!synth || Snd.muted) { setTimeout(done, Math.min(7000, 500 + text.length * 42)); return; }
    const parts = text.match(/[^.!?]+[.!?]*/g) || [text];
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p.trim()); if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.rate = 1.02; u.pitch = 0.95;
      if (i === parts.length - 1) { u.onend = done; u.onerror = done; }
      synth.speak(u);
    });
  }
  function hush() { speakId++; if (synth) synth.cancel(); const av = getAvatar(); if (av) av.talk(false); }

  /* ---------- state ---------- */
  let state = 'off', step = 0, k = 0, gen = 0, pulse = 0;
  const knightSquares = (c, r) => KNIGHT.map(([dc, dr]) => [c + dc, r + dr]);
  const here = () => PATH[k];
  const avatarPos = () => { const av = getAvatar(); return av ? av.where() : at(...here()); };

  // Camera: beside and above him, looking a little ahead along the path.
  function view(kind = state, square = null) {
    const p = (square ? at(...square) : kind === 'intro' ? at(...PATH[0]) : avatarPos()).clone().setY(0), s = scale();
    if (kind === 'done') return { pos: new THREE.Vector3(1.5, 0, 9).add(new THREE.Vector3(5.5, 13, 12).multiplyScalar(s)), tgt: new THREE.Vector3(0.6, 0.8, 8.4) };
    if (kind === 'intro') return { pos: p.clone().add(new THREE.Vector3(4.2, 4.6, 6.4).multiplyScalar(s)), tgt: p.clone().add(new THREE.Vector3(0.4, 1.2, -1.6)) };
    return { pos: p.clone().add(new THREE.Vector3(3.2, 9.5, 10).multiplyScalar(s)), tgt: p.clone().add(new THREE.Vector3(0.6, 0.6, -2.6)) };
  }
  const faceCamera = () => { const v = view('intro'); return Math.atan2(v.pos.x - v.tgt.x, v.pos.z - v.tgt.z); };

  /* ---------- panel ---------- */
  const dots = (n) => `<span class="gdots">${MOVES.map((m, i) => `<i style="--pc:${PHASE[m.phase] || AMBER}"${i < n ? ' class="on"' : ''}></i>`).join('')}</span>`;
  const RULES = ['L: two squares, then one to the side', 'Up to eight landing squares', 'Jumps over other pieces'];
  function render() {
    let html = '', title = "Knight's tour";
    if (state === 'intro') {
      html = `
      <div class="gstat"><div class="gtop"><span class="gk">How a knight moves · ${step + 1} / ${INTRO.length}</span><button class="btn-sm" data-game="j-exit">Exit</button></div>
        <p>${INTRO[step].text}</p></div>
      <ul class="jrules">${RULES.map((r, i) => `<li${i === step - 1 ? ' class="on"' : ''}>♞ ${r}</li>`).join('')}</ul>
      <div class="actions"><button class="btn" data-game="j-next">${step < INTRO.length - 1 ? 'Next ▶' : 'Start the tour ▶'}</button><button class="btn ghost" data-game="j-skip">Skip intro</button></div>`;
    } else if (state === 'ready' || state === 'at' || state === 'jumping') {
      const m = MOVES[Math.max(0, k - 1)], n = k;
      const status = state === 'jumping' ? `<span class="gk">Move ${k + 1} / 6</span> Jumping…`
        : `<span class="gk">Move ${k + 1} / 6</span> <span class="gcall pulse">♞ Click the glowing square</span> or <button class="btn-sm" data-game="j-move">Jump ▶</button>`;
      html = `
      <div class="gstat"><div class="gtop">${dots(n)}<button class="btn-sm" data-game="j-exit">Exit</button></div><p id="jStat">${status}</p></div>
      ${n > 0 ? roleCard(m, n - 1) : `<p class="lead">Six jumps, six roles. The bright square is where my career went next; the faint ones are the other knight moves.</p>`}
      <p class="muted">Drag to look around, scroll or pinch to zoom, double-click or double-tap to reset.</p>`;
      if (n > 0) title = m.role;
    } else if (state === 'done') {
      const m = MOVES[5];
      title = 'Your move';
      html = `
      <div class="gstat"><div class="gtop">${dots(6)}<button class="btn-sm" data-game="j-exit">Exit</button></div><p><b>Tour complete!</b> Six jumps from intern to full stack engineer.</p></div>
      <div class="gwin"><b>Current position: ${m.role}</b>
        <p>I'm at ${m.org} today, and ready for the next jump. If you're hiring, it's your move.</p>
        <div class="actions"><button class="btn" data-game="contact">Contact me</button><button class="btn ghost" data-game="j-again">Tour again</button><button class="btn ghost" data-game="j-exit">Back to the list</button></div></div>
      ${roleCard(m, 5)}`;
    }
    panel.openCustom({ glyph: '♘', eyebrow: 'Experience — knight\'s tour', title, color: AMBER, html });
  }
  function roleCard(m, i) {
    return `<div class="jrole" style="--pc:${PHASE[m.phase] || AMBER}"><p class="ctx">Move ${i + 1} · ${m.phase} · ${m.when}</p>
      <p class="jt">${m.role}</p><p class="mv-org">${m.org}</p><p>${m.note}</p></div>`;
  }
  function setStatus(html) { const el = document.querySelector('#jStat'); if (el) el.innerHTML = html; }

  /* ---------- the intro: how a knight moves ---------- */
  function showIntro() {
    clearMarks(); clearLines();
    const [c, r] = PATH[0], av = getAvatar(), how = INTRO[step].show;
    if (av) av.point(how !== 'none');
    if (how === 'L') { const to = [c + 1, r - 2]; mark(...to, AMBER, 0.6); lShape(PATH[0], to, AMBER, 0.85, true); }
    if (how === 'all') knightSquares(c, r).forEach(([x, y]) => mark(x, y, AMBER, 0.45));
    if (how === 'jump') {
      // two blocking pawns in front of him, and the L that hops right over them
      const to = PATH[1]; mark(...to, AMBER, 0.6); lShape(PATH[0], to, AMBER, 0.85, true);
      mark(c, r - 1, '#ff3d9a', 0.35); mark(c + 1, r, '#ff3d9a', 0.35);
    }
    if (how === 'none' && av) av.wave();
    render(); say(INTRO[step].text);
  }

  /* ---------- the tour ---------- */
  function ready() {
    state = 'ready'; clearMarks();
    const [c, r] = here(), next = PATH[k + 1];
    knightSquares(c, r).forEach(([x, y]) => { if (x !== next[0] || y !== next[1]) mark(x, y, '#a77bff', 0.14); });
    const target = mark(...next, PHASE[MOVES[k].phase] || AMBER, 0.55); target.userData.next = true;
    render();
  }
  function jump() {
    if (state !== 'ready') return;
    state = 'jumping'; hush(); render();
    const g = gen, from = here(), to = PATH[k + 1], av = getAvatar();
    clearMarks(); lShape(from, to, PHASE[MOVES[k].phase] || AMBER, 0.55, true);
    onCamera(view('tour', to), 1.5); // glides along with the jump to the landing square
    const land = () => {
      if (g !== gen) return;
      k++; Snd.clack(0.6, 0.6);
      reveal(k - 1);
      const m = MOVES[k - 1];
      say(`Move ${k}: ${m.role}, at ${m.org.split(',')[0]}.`);
      if (k === 6) { setTimeout(() => g === gen && finish(), 1400 * D); state = 'at'; render(); setStatus('<span class="gk">Move 6 / 6</span> Landed.'); return; }
      ready();
    };
    if (av) av.jumpTo(at(...to), land); else setTimeout(land, 900);
  }
  function finish() {
    state = 'done'; clearMarks();
    lines.forEach((g) => g.children.forEach((m) => gsap.to(m.material, { opacity: 0.9, duration: 0.6 })));
    stones.forEach((o) => { gsap.to(o.card.material, { opacity: 1, duration: 0.6 }); gsap.to(o.card.scale, { ...cardScale(0.85), duration: 0.6 }); gsap.to(o.pillar.material, { opacity: 0.18, duration: 0.6 }); });
    const av = getAvatar(); if (av) { av.turnTo(faceCamera()); av.celebrate(); }
    [0, 2, 4].forEach((n, i) => setTimeout(() => chime(n + 3), i * 160));
    say("That's my tour so far: six jumps, from intern to full stack engineer. Your move!");
    onCamera(view('done'), 2.2);
    render();
  }

  // Taps on the 3D scene during the tour.
  function tap(hits) {
    // squares win over pillars: a pillar standing in front of the next square mustn't block it
    const sq = hits.find((h) => h.object.userData.kind === 'jsq');
    const d = (state === 'ready' && sq ? sq : hits[0])?.object.userData; if (!d) return;
    if (d.kind === 'jstone') { if (state === 'ready' || state === 'done' || state === 'at') showRole(d.i); return; }
    if (d.kind !== 'jsq' || state !== 'ready') return;
    if (d.next) { jump(); return; }
    const av = getAvatar(); if (av) av.shakeHead(); Snd.tick();
    setStatus(`<span class="gk">Move ${k + 1} / 6</span> A legal knight move, but my career went the other way. <span class="gcall">Try the bright square</span>`);
  }
  // Clicking a milestone pillar re-opens that role in the panel.
  function showRole(i) {
    const body = document.querySelector('#pBody'); if (!body) return;
    const card = body.querySelector('.jrole'); if (!card) return;
    card.outerHTML = roleCard(MOVES[i], i);
    const s = stones[i]; gsap.fromTo(s.card.scale, cardScale(1.15), { ...cardScale(state === 'done' ? 0.85 : i === k - 1 ? 1 : 0.7), duration: 0.5 });
  }

  /* ---------- start / exit ---------- */
  function start() {
    gen++; state = 'intro'; step = 0; k = 0;
    clearMarks(); clearLines();
    stones.forEach((s) => { s.g.visible = false; s.card.scale.set(0.001, 0.001, 1); });
    group.visible = true;
    const av = getAvatar();
    if (av) av.stand(at(...PATH[0]), faceCamera());
    onCamera(view('intro'), 1.8);
    setTimeout(() => { if (state === 'intro' && step === 0) showIntro(); }, 700);
    render();
  }
  function beginTour() {
    hush(); clearMarks(); clearLines();
    const av = getAvatar(); if (av) av.point(false);
    k = 0; ready();
    onCamera(view('tour'), 1.2);
  }
  function exit(notify = true) {
    if (state === 'off') return;
    gen++; state = 'off'; hush(); clearMarks(); clearLines();
    group.visible = false;
    const av = getAvatar(); if (av) av.hide(); // back to his laptop in the kiosk
    if (notify) onExit();
  }
  function action(a) {
    if (a === 'j-exit') exit(true);
    else if (a === 'j-again') start();
    else if (a === 'j-skip') beginTour();
    else if (a === 'j-move') jump();
    else if (a === 'j-next') { if (state !== 'intro') return; if (step < INTRO.length - 1) { step++; showIntro(); } else beginTour(); }
  }

  function update(dt) {
    if (state === 'off') return;
    pulse += dt;
    const p = avatarPos(); base.position.x = p.x; base.position.z = p.z;
    pool.forEach((m) => { if (m.visible && m.userData.next) m.material.opacity = 0.4 + 0.25 * Math.sin(pulse * 4); });
  }
  const pickList = () => pool.filter((m) => m.visible).concat(stones.filter((s) => s.g.visible).map((s) => s.hit));

  return { start, exit, action, tap, update, pickList, view: () => view(state === 'intro' ? 'intro' : state === 'done' ? 'done' : 'tour'), get active() { return state !== 'off'; } };
}
