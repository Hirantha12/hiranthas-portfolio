// "Play for them": a real game against Hirantha on the plaza board.
// The visitor plays Black, follows the arrow, presses their side of the chess clock, and each
// move unlocks a project. Black's 8th move is checkmate (the Englund Gambit trap, see GAME).
import * as THREE from 'three';
import gsap from 'gsap';
import { cnv, tex, neon } from './canvas.js';
import { makePiece } from './pieces.js';
import { GAME, PROJECTS } from '../data/content.js';
import { Snd } from '../audio/sound.js';

const BACK = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
const FILES = 'abcdefgh';
const START_TIME = 5 * 60; // 5-minute blitz on both sides
const SCALE = 0.5;
const fmt = (t) => { const s = Math.max(0, Math.ceil(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function createGame({ scene, board, boardTop, sqPos, ivory, ebony, reduce, onChange }) {
  // The visitor sits on the open plaza side, so the board turns 180° for the game:
  // Black's pieces start nearest them and Hirantha plays White from the kiosk side.
  const at = (sq) => sqPos(7 - FILES.indexOf(sq[0]), 8 - +sq[1]);
  const SEAT = { x: 0, z: 5.5 }; // roughly where the visitor's camera sits
  const D = reduce ? 0.35 : 1; // animation speed factor

  /* ---------- the 32 pieces (built on first use) ---------- */
  const all = [];
  const pieces = new Map(); // square -> piece
  function buildPieces() {
    const add = (type, white, sq) => {
      const g = makePiece(type, white ? ivory : ebony);
      g.scale.setScalar(SCALE); g.visible = false;
      if (type === 'knight') g.rotation.y = white ? Math.PI / 2 : -Math.PI / 2; // knights face the opponent
      const p = { g, type, white, home: sq, sq, baseRotY: g.rotation.y, mesh: g.children[0] };
      p.mesh.userData = { kind: 'gpiece', piece: p };
      board.add(g); all.push(p);
    };
    for (let f = 0; f < 8; f++) {
      add(BACK[f], true, FILES[f] + '1'); add('pawn', true, FILES[f] + '2');
      add('pawn', false, FILES[f] + '7'); add(BACK[f], false, FILES[f] + '8');
    }
  }

  /* ---------- chess clock on a small stand at the visitor's right ---------- */
  const clock = new THREE.Group();
  clock.visible = false; scene.add(clock);
  const clockMeshes = [];
  const clockBody = new THREE.Group();
  // Wide screens: beside the board. Tall phones: in front of it on the right, so the board can
  // use the full screen width.
  function layout(portrait) {
    if (portrait) clock.position.set(1.35, 0, 3.3); else clock.position.set(2.95, 0, 1.1);
    clockBody.rotation.y = Math.atan2(SEAT.x - clock.position.x, SEAT.z - clock.position.z); // face the visitor
  }
  const [faceC, faceX] = cnv(512, 144);
  const faceTex = tex(faceC);
  const btnMat = (c) => new THREE.MeshStandardMaterial({ color: 0xd9cbb0, roughness: 0.4, emissive: new THREE.Color(c), emissiveIntensity: 0 });
  const whiteBtn = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.14), btnMat('#ffb547'));
  const blackBtn = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.14), btnMat('#57ffb0'));
  {
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x2a1b22, roughness: 0.7 });
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 1, 20), darkWood); stand.position.y = 0.5; stand.castShadow = true; clock.add(stand);
    const body = clockBody; body.position.y = 1.18; clock.add(body);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.36, 0.34), new THREE.MeshStandardMaterial({ color: 0x6b4430, roughness: 0.5 }));
    box.castShadow = true; body.add(box);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.24), new THREE.MeshBasicMaterial({ map: faceTex }));
    face.position.z = 0.171; body.add(face);
    whiteBtn.position.set(-0.25, 0.215, 0); blackBtn.position.set(0.25, 0.215, 0); // left = Hirantha, right = you
    body.add(whiteBtn, blackBtn);
    [stand, box, face, whiteBtn, blackBtn].forEach((m) => { m.userData = { kind: 'gclock' }; clockMeshes.push(m); });
  }
  let tW = START_TIME, tB = START_TIME, running = null, shown = '';
  function drawClock() {
    const key = `${fmt(tW)}|${fmt(tB)}|${running}`;
    if (key === shown) return; shown = key;
    const x = faceX; x.fillStyle = '#0c0a12'; x.fillRect(0, 0, 512, 144);
    x.fillStyle = '#3a3350'; x.fillRect(255, 14, 2, 116);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    [[tW, 'w', 128, 'HIRANTHA', '#ffb547'], [tB, 'b', 384, 'YOU', '#57ffb0']].forEach(([t, side, cx, label, col]) => {
      const on = running === side;
      x.font = '600 20px "JetBrains Mono", monospace'; x.fillStyle = on ? col : '#5d5470'; x.fillText(label, cx, 30);
      x.font = '600 62px "JetBrains Mono", monospace';
      if (on) neon(x, fmt(t), cx, 90, col, 12); else { x.fillStyle = '#6f6585'; x.fillText(fmt(t), cx, 90); }
    });
    faceTex.needsUpdate = true;
  }
  // Pressing your button stops your time and starts the opponent's, as on a real clock.
  function press(side) {
    const [down, up] = side === 'b' ? [blackBtn, whiteBtn] : [whiteBtn, blackBtn];
    gsap.to(down.position, { y: 0.185, duration: 0.08 }); gsap.to(up.position, { y: 0.215, duration: 0.12 });
    running = side === 'b' ? 'w' : 'b';
    Snd.clack(2.4, 0.35); drawClock();
  }

  /* ---------- arrow + square marks ---------- */
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0x57ffb0, transparent: true, opacity: 0.8, depthWrite: false });
  let arrow = null;
  const markMat = new THREE.MeshBasicMaterial({ color: 0x57ffb0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const fromMark = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.48), markMat);
  fromMark.rotation.x = -Math.PI / 2; fromMark.position.y = 0.006; fromMark.visible = false; board.add(fromMark);
  function showArrow(from, to, color) {
    hideArrow();
    const a = at(from), b = at(to), dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    const s = new THREE.Shape(), w = 0.045, hw = 0.13, hl = 0.2, start = 0.14, end = len - 0.04;
    s.moveTo(-w, start); s.lineTo(w, start); s.lineTo(w, end - hl); s.lineTo(hw, end - hl); s.lineTo(0, end);
    s.lineTo(-hw, end - hl); s.lineTo(-w, end - hl); s.closePath();
    const geo = new THREE.ShapeGeometry(s); geo.rotateX(-Math.PI / 2); // shape +y now points to -z
    arrow = new THREE.Mesh(geo, arrowMat);
    arrow.position.set(a.x, 0.012, a.z); arrow.rotation.y = Math.atan2(-dx, -dz);
    arrowMat.color.set(color); markMat.color.set(color);
    board.add(arrow);
    fromMark.position.x = a.x; fromMark.position.z = a.z; fromMark.visible = true;
  }
  function hideArrow() {
    if (arrow) { board.remove(arrow); arrow.geometry.dispose(); arrow = null; }
    fromMark.visible = false;
  }

  /* ---------- moving pieces ---------- */
  function movePiece(from, to, done) {
    const p = pieces.get(from), victim = pieces.get(to), b = at(to);
    pieces.delete(from); pieces.set(to, p); p.sq = to;
    const tl = gsap.timeline({ onComplete: done });
    tl.to(p.g.position, { y: 0.45, duration: 0.18 * D, ease: 'power2.out' })
      .to(p.g.position, { x: b.x, z: b.z, duration: 0.42 * D, ease: 'power2.inOut' })
      .add(() => {
        if (!victim) return;
        gsap.to(victim.g.position, { y: 0.7, duration: 0.3 * D, ease: 'power2.out' });
        gsap.to(victim.g.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3 * D, onComplete: () => { victim.g.visible = false; } });
      }, '-=0.12')
      .to(p.g.position, { y: 0, duration: 0.16 * D, ease: 'power2.in', onComplete: () => Snd.clack(victim ? 0.8 : 1, 0.7) });
  }

  /* ---------- the game ---------- */
  let state = 'off', k = 0, selected = null, gen = 0, avatar = null;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms * D));
  const color = () => PROJECTS[k].color; // the arrow takes the colour of the project it unlocks

  function enter(portrait) {
    if (!all.length) buildPieces();
    gen++;
    layout(portrait);
    if (avatar) avatar.show();
    timers.forEach(clearTimeout); timers.length = 0;
    pieces.clear(); hideArrow(); selected = null; k = 0;
    all.forEach((p, i) => {
      gsap.killTweensOf([p.g.position, p.g.scale, p.g.rotation]);
      p.sq = p.home; pieces.set(p.sq, p);
      const v = at(p.sq); p.g.position.set(v.x, -0.4, v.z);
      p.g.rotation.set(0, p.baseRotY, 0); p.g.scale.setScalar(0.001); p.g.visible = true;
      const d = 0.6 + (p.white ? 0 : 0.35) + (i % 16) * 0.03;
      gsap.to(p.g.position, { y: 0, duration: 0.6 * D, delay: d * D, ease: 'back.out(1.6)' });
      gsap.to(p.g.scale, { x: SCALE, y: SCALE, z: SCALE, duration: 0.5 * D, delay: d * D, ease: 'back.out(1.6)' });
    });
    gsap.to(boardTop.rotation, { z: Math.PI, duration: 0.9 * D, ease: 'power2.inOut' }); // labels read from Black's side
    tW = tB = START_TIME; running = null; shown = ''; drawClock();
    whiteBtn.position.y = blackBtn.position.y = 0.215;
    clock.visible = true; clock.scale.setScalar(0.001);
    gsap.to(clock.scale, { x: 1, y: 1, z: 1, duration: 0.6 * D, delay: 0.8 * D, ease: 'back.out(1.5)' });
    state = 'start';
    onChange({ phase: 'start' });
  }

  function exit() {
    if (state === 'off') return;
    state = 'off'; running = null; gen++;
    if (avatar) avatar.hide();
    timers.forEach(clearTimeout); timers.length = 0;
    hideArrow();
    all.forEach((p, i) => {
      if (!p.g.visible) return;
      gsap.killTweensOf([p.g.position, p.g.scale, p.g.rotation]);
      gsap.to(p.g.position, { y: -0.4, duration: 0.35, delay: (i % 16) * 0.015, ease: 'power2.in' });
      gsap.to(p.g.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.35, delay: (i % 16) * 0.015, onComplete: () => { p.g.visible = false; } });
    });
    gsap.to(clock.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3, onComplete: () => { clock.visible = false; } });
    gsap.to(boardTop.rotation, { z: 0, duration: 0.9 * D, ease: 'power2.inOut' });
  }

  // Hirantha's turn. With the avatar loaded he thinks, reaches over, carries the piece and presses
  // his clock; without it (still loading, or it failed) the piece simply moves on its own.
  function whiteTurn() {
    state = 'white'; running = 'w';
    onChange({ phase: 'thinking', k });
    if (avatar) avatar.think();
    const [from, to] = GAME[k].white, g = gen;
    const yourTurn = () => {
      if (g !== gen) return; // the game was left or restarted meanwhile
      press('w');
      const [bf, bt] = GAME[k].black;
      showArrow(bf, bt, color());
      state = 'move';
      if (avatar) avatar.watchVisitor();
      onChange({ phase: 'move', k, say: GAME[k].say, san: GAME[k].black[2] });
    };
    later(() => {
      const move = () => { if (g === gen) movePiece(from, to, afterMove); };
      const afterMove = () => {
        if (g !== gen) return;
        if (avatar) avatar.letGo(() => { if (g === gen) avatar.pressClock(whiteBtn, yourTurn); });
        else later(yourTurn, 350);
      };
      if (avatar) avatar.reachFor(pieces.get(from).g, move); else move();
    }, 1100 + Math.random() * 600);
  }

  function blackMove() {
    const [from, to] = GAME[k].black;
    hideArrow(); selected = null; state = 'busy'; // the move animation lifts it from wherever it is
    movePiece(from, to, () => {
      if (k === GAME.length - 1) { // checkmate: Hirantha's king tips over
        state = 'mate'; running = null; drawClock();
        const king = pieces.get('e1');
        gsap.to(king.g.rotation, { z: -1.45, duration: 0.9 * D, delay: 0.4 * D, ease: 'bounce.out', onStart: () => Snd.clack(0.6, 0.8) });
        if (avatar) avatar.lose();
        onChange({ phase: 'mate', k });
        return;
      }
      state = 'press';
      onChange({ phase: 'press', k });
    });
  }

  function select(p) {
    deselect(); selected = p;
    gsap.to(p.g.position, { y: 0.16, duration: 0.2 }); Snd.tick();
  }
  function deselect() {
    if (selected && selected.g.position.y > 0) gsap.to(selected.g.position, { y: 0, duration: 0.15 });
    selected = null;
  }
  function nudge() {
    const p = pieces.get(GAME[k].black[0]);
    gsap.fromTo(p.g.position, { x: p.g.position.x - 0.05 }, { x: at(p.sq).x, duration: 0.4, ease: 'elastic.out(1.4,.25)' });
    Snd.tick();
  }

  const squareOf = (data, point) => {
    if (data.kind === 'gpiece') return data.piece.sq;
    if (data.kind !== 'gboard') return null;
    const v = board.worldToLocal(point.clone()); // undo the 180° turn from at()
    const f = 7 - Math.round((v.x + 1.75) / 0.5), r = 7 - Math.round((1.75 - v.z) / 0.5);
    return f >= 0 && f < 8 && r >= 0 && r < 8 ? FILES[f] + (r + 1) : null;
  };

  // Taps from the page: every hit under the finger, nearest first. Tall pieces can stand in
  // front of the square you mean, so any hit on the right piece or square counts.
  function tap(hits) {
    if (!hits.length) return;
    const data = hits[0].object.userData;
    if (data.kind === 'gclock') {
      if (state === 'start') { press('b'); whiteTurn(); }
      else if (state === 'press') {
        press('b'); onChange({ phase: 'project', k });
        k++; later(whiteTurn, 900);
      }
      return;
    }
    if (state !== 'move') return;
    const [from, to] = GAME[k].black;
    const squares = hits.map((h) => squareOf(h.object.userData, h.point));
    if (squares.includes(to) && (selected || !squares.includes(from))) blackMove();
    else if (squares.includes(from)) select(pieces.get(from));
    else nudge();
  }

  let pulse = 0;
  function update(dt) {
    if (avatar) avatar.update(dt); // also runs while he shrinks away after the game
    if (state === 'off') return;
    if (running === 'w') tW = Math.max(0, tW - dt);
    else if (running === 'b') tB = Math.max(0, tB - dt);
    drawClock();
    pulse += dt;
    const glow = 0.45 + 0.45 * Math.sin(pulse * 5);
    blackBtn.material.emissiveIntensity = state === 'start' || state === 'press' ? glow : 0;
    if (arrow) arrowMat.opacity = 0.6 + 0.3 * Math.sin(pulse * 4);
  }

  const pickList = () => all.filter((p) => p.g.visible).map((p) => p.mesh).concat(boardTop, clockMeshes);

  return {
    enter, exit, tap, update, pickList, layout,
    // The avatar arrives with a lazy import(); if a game is already running he sits down at once.
    setAvatar(a) { avatar = a; if (state !== 'off') { a.show(); if (state === 'move') a.watchVisitor(); } },
    clockPosition: () => clock.position.clone().setY(1.25),
    get active() { return state !== 'off'; },
  };
}
