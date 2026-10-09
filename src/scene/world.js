// Builds the whole plaza: floor, city, kiosk, giant pieces, playable board, scoresheet, rain.
import * as THREE from 'three';
import { cnv, tex, rrect, fitFont, neon } from './canvas.js';
import { makePiece, HEIGHT } from './pieces.js';
import { SECTIONS, PROJECTS, GLYPH, PIECE_NAME, PROFILE, SCORESHEET_MOVES, CODE_LINES } from '../data/content.js';

const V3 = THREE.Vector3;
// three r155+ uses physically based light units.
// I(): hemisphere/directional lights, x PI matches the r128 prototype.
// P(): point/spot lights with decay 0 (only the soft cutoff at `distance`), scaled to match.
const I = (v) => v * Math.PI;
export const P = (v) => v * Math.PI * 0.28;

export function buildWorld(scene, { touch, reduce }) {
  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0x5a4a9a, 0x120a1c, I(0.55)));
  const moon = new THREE.DirectionalLight(0x7f78ff, I(0.55)); moon.position.set(-8, 14, -12); scene.add(moon);
  const fill = new THREE.DirectionalLight(0x5f5596, I(0.4)); fill.position.set(0, 6, 14); scene.add(fill);
  const flash = new THREE.DirectionalLight(0xd6deff, 0); flash.position.set(6, 20, 12); scene.add(flash);
  const boardSpot = new THREE.SpotLight(0xfff1dc, P(1.0), 16, 0.55, 0.7, 0);
  boardSpot.position.set(0, 8.5, 3.4); boardSpot.target.position.set(0, 1.1, 0.2);
  boardSpot.castShadow = !touch; boardSpot.shadow.mapSize.set(1024, 1024); boardSpot.shadow.bias = -0.0006;
  scene.add(boardSpot, boardSpot.target);
  const kingSpot = new THREE.SpotLight(0xbfd6ff, P(1.5), 30, 0.32, 0.8, 0);
  kingSpot.position.set(0, 14, -1.5); kingSpot.target.position.set(0, 3, -9.6); scene.add(kingSpot, kingSpot.target);
  const warm = new THREE.PointLight(0xffa860, P(0.9), 7, 0); warm.position.set(0, 3, -4.6); scene.add(warm);
  const signLight = new THREE.PointLight(0xff3d9a, 0, 11, 0); signLight.position.set(0, 4.5, -1.6); scene.add(signLight);

  /* ---------- plaza floor: a giant faint chessboard, wet ---------- */
  {
    const [c, x] = cnv(512, 512), S = 64;
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { x.fillStyle = (r + f) % 2 ? '#120d1c' : '#1c152b'; x.fillRect(f * S, r * S, S, S); }
    x.strokeStyle = '#09070f'; x.lineWidth = 3;
    for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * S, 0); x.lineTo(i * S, 512); x.stroke(); x.beginPath(); x.moveTo(0, i * S); x.lineTo(512, i * S); x.stroke(); }
    const [rc, rx] = cnv(512, 512);
    rx.fillStyle = 'rgb(175,175,175)'; rx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 28; i++) {
      const X = Math.random() * 512, Y = Math.random() * 512, R = 20 + Math.random() * 80;
      const g = rx.createRadialGradient(X, Y, 0, X, Y, R);
      g.addColorStop(0, 'rgba(25,25,25,.95)'); g.addColorStop(1, 'rgba(25,25,25,0)');
      rx.fillStyle = g; rx.fillRect(X - R, Y - R, R * 2, R * 2);
    }
    const mat = new THREE.MeshStandardMaterial({ map: tex(c, 9), roughnessMap: tex(rc, 4.5), roughness: 1, metalness: 0.35 });
    const m = new THREE.Mesh(new THREE.CircleGeometry(70, 96), mat);
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true; scene.add(m);
  }

  /* ---------- distant city ring (gives depth when you orbit 360°) ---------- */
  {
    const [c, x] = cnv(128, 256); x.fillStyle = '#0d0a16'; x.fillRect(0, 0, 128, 256);
    for (let r = 0; r < 24; r++) for (let k = 0; k < 8; k++) {
      if (Math.random() < 0.3) {
        x.fillStyle = ['#ffb547', '#3ef2ff', '#ff3d9a', '#cfc6ff'][Math.floor(Math.random() * 4)];
        x.globalAlpha = 0.25 + Math.random() * 0.5; x.fillRect(8 + k * 15, 8 + r * 10, 7, 5);
      }
    }
    x.globalAlpha = 1;
    const mat = new THREE.MeshBasicMaterial({ map: tex(c), color: 0x8a7cc0 });
    // One instanced mesh draws all 28 buildings in a single call. A unit box scaled per building
    // has the same UVs as a box built at that size, so the window texture looks the same.
    const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, 28);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), yAxis = new V3(0, 1, 0);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.1, R = 54 + Math.random() * 10;
      const h = 12 + Math.random() * 22, w = 4 + Math.random() * 5;
      q.setFromAxisAngle(yAxis, Math.random());
      city.setMatrixAt(i, m4.compose(new V3(Math.cos(a) * R, h / 2, -Math.sin(a) * R), q, new V3(w, h, w)));
    }
    city.computeBoundingSphere(); scene.add(city);
  }

  /* ---------- label sprites over the giant pieces ---------- */
  function labelSprite(text, sub, color, width) {
    const [c, x] = cnv(640, 200); x.textAlign = 'center'; x.textBaseline = 'middle';
    fitFont(x, text, 700, '"Chakra Petch", sans-serif', 80, 600); neon(x, text, 320, 84, color, 26);
    x.font = '500 27px "JetBrains Mono", monospace'; x.fillStyle = 'rgba(236,228,255,.85)'; x.fillText(sub, 320, 160);
    const m = new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false, opacity: 0 });
    const s = new THREE.Sprite(m); s.scale.set(width, (width * 200) / 640, 1); return s;
  }

  /* ---------- giant section pieces ---------- */
  const giants = {}, giantMeshes = [];
  Object.entries(SECTIONS).forEach(([key, s], i) => {
    const col = new THREE.Color(s.color);
    const mat = new THREE.MeshStandardMaterial(s.ivory ? { color: 0xcfc6b4, roughness: 0.35, metalness: 0.08 } : { color: 0x1d1629, roughness: 0.22, metalness: 0.4 });
    mat.emissive = col.clone(); mat.emissiveIntensity = s.ivory ? 0.04 : 0.12;
    const holder = new THREE.Group(); holder.position.set(...s.pos); scene.add(holder);
    const piece = makePiece(s.piece, mat); piece.scale.setScalar(s.scale); piece.rotation.y = s.rot || 0; holder.add(piece);
    piece.traverse((o) => { if (o.isMesh) { o.userData = { kind: 'section', key }; giantMeshes.push(o); } });
    const R = 0.46 * s.scale;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.04, 8, 96), new THREE.MeshBasicMaterial({ color: col }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; holder.add(ring);
    const disk = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, depthWrite: false }));
    disk.rotation.x = -Math.PI / 2; disk.position.y = 0.02; holder.add(disk);
    const L = key === 'about' ? new THREE.PointLight(col, P(1.5), 11, 0) : new THREE.PointLight(col, P(1.2), 8, 0);
    L.position.set(0, key === 'about' ? 3.2 : 1.3, key === 'about' ? 3.2 : 2); holder.add(L);
    const H = HEIGHT[s.piece] * s.scale;
    const lw = key === 'about' ? 4.6 : 3.3;
    const label = labelSprite(s.label, `${GLYPH[s.piece]} ${PIECE_NAME[s.piece].toUpperCase()} · ${s.sq}`, s.color, lw);
    label.position.y = H + (key === 'about' ? 1.2 : 0.85); holder.add(label);
    piece.position.y = 18; // waits in the sky for the intro drop
    giants[key] = { key, s, holder, piece, mat, ring, disk, label, lw, ly: label.position.y, phase: i * 1.3, H, baseEI: mat.emissiveIntensity };
  });

  /* ---------- the café kiosk ---------- */
  const wood = new THREE.MeshStandardMaterial({ color: 0x5b3826, roughness: 0.6 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x2a1b22, roughness: 0.7 });
  const wall = new THREE.MeshStandardMaterial({ color: 0x251a35, roughness: 0.8 });
  function box(w, h, d, mat, x, y, z, parent = scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  box(7.4, 0.3, 3.6, darkWood, 0, 0.15, -4.5);
  box(7.4, 3.6, 0.25, wall, 0, 2.1, -6.2);
  box(0.25, 3.6, 3.4, wall, -3.6, 2.1, -4.5);
  box(0.25, 3.6, 3.4, wall, 3.6, 2.1, -4.5);
  box(8.2, 0.2, 4.4, new THREE.MeshStandardMaterial({ color: 0x1b1328, roughness: 0.5 }), 0, 4.0, -4.3).rotation.x = 0.12;
  {
    const [c, x] = cnv(512, 64);
    for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#2a1840' : '#ff3d9a'; x.fillRect(i * 32, 0, 32, 64); }
    box(8.2, 0.5, 0.08, new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.6, emissive: 0xff3d9a, emissiveIntensity: 0.08 }), 0, 3.48, -2.08);
  }
  box(6.6, 1.05, 0.7, wood, 0, 0.825, -3.25);
  box(6.7, 0.06, 0.85, darkWood, 0, 1.38, -3.25);
  box(6.6, 0.04, 0.04, new THREE.MeshBasicMaterial({ color: 0xff3d9a }), 0, 1.33, -2.88);
  box(2.8, 0.07, 0.36, darkWood, -1.6, 2.3, -5.9);
  // chess trophies + books on the shelf
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc85a, roughness: 0.3, metalness: 0.5, emissive: 0x8a5a10, emissiveIntensity: 0.35 });
  const cup = new THREE.LatheGeometry([[0, 0], [0.07, 0], [0.07, 0.025], [0.025, 0.045], [0.025, 0.11], [0.075, 0.14], [0.095, 0.22], [0.08, 0.22], [0, 0.17]].map(([r, y]) => new THREE.Vector2(r, y)), 24);
  [[-2.5, 1.3], [-2.15, 1.0], [-1.85, 0.85]].forEach(([x, s]) => { const m = new THREE.Mesh(cup, gold); m.position.set(x, 2.335, -5.9); m.scale.setScalar(s * 1.4); scene.add(m); });
  ['#ff3d9a', '#3ef2ff', '#ffb547', '#a77bff', '#57ffb0', '#d9cbb0'].forEach((c, i) => {
    const b = box(0.09, 0.32 - (i % 3) * 0.04, 0.24, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }), -1.2 + i * 0.11, 2.49 - (i % 3) * 0.02, -5.9);
    if (i === 5) b.rotation.z = 0.25;
  });

  /* ---------- animated code screen + laptop ---------- */
  const [codeC, codeX] = cnv(512, 300);
  const codeTex = tex(codeC);
  box(2.04, 1.22, 0.08, new THREE.MeshStandardMaterial({ color: 0x0b0812, roughness: 0.4 }), 1.5, 2.75, -6.06);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.11), new THREE.MeshBasicMaterial({ map: codeTex }));
  screen.position.set(1.5, 2.75, -6.01); scene.add(screen);
  const lap = new THREE.Group(); lap.position.set(-1.7, 1.42, -3.3); lap.rotation.y = 0.35; scene.add(lap);
  box(0.72, 0.03, 0.5, new THREE.MeshStandardMaterial({ color: 0x3a3550, metalness: 0.5, roughness: 0.35 }), 0, 0, 0, lap);
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42), new THREE.MeshBasicMaterial({ map: codeTex }));
  lid.position.set(0, 0.22, -0.24); lid.rotation.x = -0.18; lap.add(lid);

  const CODE_LEN = CODE_LINES.join('\n').length;
  const KW = /(\b(?:import|from|export|async|function|const|await|return)\b|'[^']*'?)/g;
  let codeChars = 0, codeHold = 0, codeBlink = 0;
  function drawCode(dt) {
    const x = codeX; x.fillStyle = '#0c0916'; x.fillRect(0, 0, 512, 300);
    x.fillStyle = '#181229'; x.fillRect(0, 0, 512, 26);
    ['#ff5f7a', '#ffb547', '#57ffb0'].forEach((c, i) => { x.fillStyle = c; x.beginPath(); x.arc(14 + i * 16, 13, 4.5, 0, 7); x.fill(); });
    x.font = '400 12px "JetBrains Mono", monospace'; x.fillStyle = '#8b84a8'; x.textBaseline = 'middle'; x.fillText('hirantha.ts', 70, 14);
    if (codeChars < CODE_LEN) codeChars = Math.min(CODE_LEN, codeChars + 2);
    else { codeHold += dt; if (codeHold > 3.5) { codeHold = 0; codeChars = 0; } }
    codeBlink += dt;
    x.font = '400 15px "JetBrains Mono", monospace';
    let rem = codeChars, y = 50, cursorDone = false;
    CODE_LINES.forEach((line, i) => {
      x.fillStyle = '#4b4566'; x.fillText(String(i + 1).padStart(2, ' '), 10, y);
      const shown = line.slice(0, Math.max(0, rem)); rem -= line.length + 1;
      let cx = 44;
      if (line.trim().startsWith('//')) { x.fillStyle = '#7d77a3'; x.fillText(shown, cx, y); cx += x.measureText(shown).width; }
      else shown.split(KW).forEach((part) => {
        if (!part) return;
        x.fillStyle = /^'/.test(part) ? '#57ffb0' : /^(import|from|export|async|function|const|await|return)$/.test(part) ? '#ff5fae' : '#e3dcff';
        x.fillText(part, cx, y); cx += x.measureText(part).width;
      });
      if (!cursorDone && rem < 0) { cursorDone = true; if (Math.floor(codeBlink * 2.5) % 2 === 0) { x.fillStyle = '#3ef2ff'; x.fillRect(cx + 1, y - 9, 8, 18); } }
      y += 27;
    });
    codeTex.needsUpdate = true;
  }
  drawCode(0);

  /* ---------- chess clock + mug ---------- */
  {
    const [c, x] = cnv(256, 96); x.fillStyle = '#0c0a12'; x.fillRect(0, 0, 256, 96);
    x.font = '600 36px "JetBrains Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    neon(x, '04:00', 66, 50, '#ffb547', 10); neon(x, '10:00', 190, 50, '#57ffb0', 10);
    x.fillStyle = '#3a3350'; x.fillRect(127, 14, 2, 68);
    const g = new THREE.Group(); g.position.set(2.1, 1.56, -3.2); g.rotation.y = -0.25; scene.add(g);
    box(0.7, 0.32, 0.26, new THREE.MeshStandardMaterial({ color: 0x6b4430, roughness: 0.5 }), 0, 0, 0, g);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.225), new THREE.MeshBasicMaterial({ map: tex(c) })); face.position.set(0, 0, 0.131); g.add(face);
    box(0.1, 0.06, 0.1, new THREE.MeshStandardMaterial({ color: 0xd9cbb0 }), -0.18, 0.19, 0, g);
    box(0.1, 0.03, 0.1, new THREE.MeshStandardMaterial({ color: 0xd9cbb0 }), 0.18, 0.175, 0, g);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.18, 20), new THREE.MeshStandardMaterial({ color: 0xece4d2, roughness: 0.4 }));
    mug.position.set(-0.6, 1.5, -3.2); mug.castShadow = true; scene.add(mug);
  }

  /* ---------- neon sign ---------- */
  const signMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.06, depthWrite: false });
  {
    const [c, x] = cnv(1024, 210);
    x.lineWidth = 6; x.strokeStyle = '#3ef2ff'; x.shadowColor = '#3ef2ff'; x.shadowBlur = 18; rrect(x, 14, 14, 996, 182, 28); x.stroke(); x.shadowBlur = 0;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    fitFont(x, "HIRANTHA'S GAMBIT", 400, 'Monoton, "Chakra Petch", sans-serif', 92, 900);
    neon(x, "HIRANTHA'S GAMBIT", 512, 112, '#ff4fa8', 30);
    signMat.map = tex(c);
    box(6.4, 1.3, 0.16, new THREE.MeshStandardMaterial({ color: 0x120c1c, roughness: 0.5 }), 0, 4.78, -3.05);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.27), signMat); p.position.set(0, 4.78, -2.96); scene.add(p);
  }
  // vertical blade sign
  {
    const [c, x] = cnv(160, 700); x.fillStyle = '#0f0a18'; x.fillRect(0, 0, 160, 700);
    x.lineWidth = 5; x.strokeStyle = '#ffb547'; x.shadowColor = '#ffb547'; x.shadowBlur = 14; rrect(x, 10, 10, 140, 680, 16); x.stroke(); x.shadowBlur = 0;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 78px "Chakra Petch", sans-serif';
    'CODE'.split('').forEach((ch, i) => neon(x, ch, 80, 80 + i * 100, '#3ef2ff', 18));
    x.font = '110px serif'; neon(x, '♞', 80, 560, '#57ffb0', 22);
    const g = new THREE.Group(); g.position.set(-4.05, 2.4, -2.85); scene.add(g);
    box(0.62, 2.5, 0.1, new THREE.MeshStandardMaterial({ color: 0x0f0a18 }), 0, 0, 0, g);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 2.45), new THREE.MeshBasicMaterial({ map: tex(c) })); f.position.z = 0.052; g.add(f);
    box(0.5, 0.05, 0.05, darkWood, 0.3, 0.9, 0, g);
  }
  // string lights under the roof edge
  {
    const pts = [], n = 15, cols = [0xff3d9a, 0xffb547, 0x3ef2ff, 0x57ffb0, 0xa77bff];
    for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(new V3(-4.1 + 8.2 * t, 3.3 - Math.sin(t * Math.PI) * 0.45, -1.98)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2a2238 })));
    // All bulbs in one instanced draw; each instance keeps its own colour.
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      bulbs.setMatrixAt(i, m4.makeTranslation(-4.1 + 8.2 * t, 3.22 - Math.sin(t * Math.PI) * 0.45, -1.98));
      bulbs.setColorAt(i, col.setHex(cols[i % 5]));
    }
    bulbs.computeBoundingSphere(); scene.add(bulbs);
  }
  // street lamps
  [[-13, 1.5], [13, 1.5]].forEach(([x, z]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5, 10), new THREE.MeshStandardMaterial({ color: 0x1b1626, metalness: 0.5, roughness: 0.4 }));
    pole.position.set(x, 2.5, z); scene.add(pole);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 16), new THREE.MeshBasicMaterial({ color: 0xffe2f2 }));
    globe.position.set(x, 5.1, z); scene.add(globe);
    const L = new THREE.PointLight(0xff8ad0, P(1.2), 9, 0); L.position.set(x, 4.6, z); scene.add(L);
  });

  /* ---------- table + playable board ---------- */
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 0.78, 24), darkWood); ped.position.set(0, 0.39, 0.2); ped.castShadow = true; scene.add(ped);
  box(5, 0.14, 5, wood, 0, 0.85, 0.2);
  box(4.5, 0.18, 4.5, new THREE.MeshStandardMaterial({ color: 0x16101f, roughness: 0.4 }), 0, 1.01, 0.2);
  [[-3.1, 1.6], [3.1, -1.0]].forEach(([x, z]) => {
    box(0.12, 0.7, 0.12, darkWood, x, 0.35, z);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 20), wood); s.position.set(x, 0.75, z); s.castShadow = true; scene.add(s);
  });

  const board = new THREE.Group(); board.position.set(0, 1.1, 0.2); scene.add(board);
  let boardTop; // the playing surface, used to find which square was tapped in the game
  {
    const N = 1024, B = (N * 0.2) / 4.4, S = (N - 2 * B) / 8; const [c, x] = cnv(N, N);
    x.fillStyle = '#16101f'; x.fillRect(0, 0, N, N);
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { x.fillStyle = (r + f) % 2 ? '#3b2b52' : '#b8aa90'; x.fillRect(B + f * S, B + r * S, S + 0.6, S + 0.6); }
    x.strokeStyle = 'rgba(255,61,154,.7)'; x.lineWidth = 3; x.strokeRect(B - 7, B - 7, N - 2 * B + 14, N - 2 * B + 14);
    x.fillStyle = '#b9a8d8'; x.font = '600 24px "JetBrains Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 8; i++) {
      const fl = 'abcdefgh'[i];
      x.fillText(fl, B + i * S + S / 2, N - B / 2); x.fillText(fl, B + i * S + S / 2, B / 2);
      x.fillText(String(8 - i), B / 2, B + i * S + S / 2); x.fillText(String(8 - i), N - B / 2, B + i * S + S / 2);
    }
    const p = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.85, metalness: 0 }));
    p.rotation.x = -Math.PI / 2; p.position.y = 0.002; p.receiveShadow = true; board.add(p);
    p.userData = { kind: 'gboard' }; boardTop = p;
  }
  const sqPos = (f, r) => new V3(-1.75 + f * 0.5, 0, 1.75 - r * 0.5);

  const ivoryS = new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.32, metalness: 0.05 });
  const ebonyS = new THREE.MeshStandardMaterial({ color: 0x231b33, roughness: 0.25, metalness: 0.35 });
  const TYPE = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
  // A quiet Italian Game middlegame. Uppercase = white, lowercase = black.
  const DECOR = ['Kg1', 'Qd1', 'Rf1', 'Bc4', 'Nf3', 'Pe4', 'Pd3', 'Pg2', 'Ph2', 'kg8', 'qd8', 'rf8', 'bc5', 'nf6', 'nc6', 'pe5', 'pd6', 'pg7', 'ph7'];
  const decor = DECOR.map((code) => {
    const white = code[0] === code[0].toUpperCase();
    const type = TYPE[code[0].toLowerCase()];
    const f = code.charCodeAt(1) - 97, r = +code[2] - 1;
    const p = makePiece(type, white ? ivoryS : ebonyS); p.scale.setScalar(0.5);
    p.position.copy(sqPos(f, r));
    if (type === 'knight') p.rotation.y = white ? -Math.PI / 2 : Math.PI / 2;
    board.add(p); return p;
  });

  const projPieces = PROJECTS.map((pr, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd2c9b8, roughness: 0.3, metalness: 0.1, emissive: new THREE.Color(pr.color), emissiveIntensity: 0.18 });
    const holder = new THREE.Group(); holder.position.copy(sqPos(i, 0)); holder.position.y = -0.4; holder.scale.setScalar(0.001); holder.visible = false; board.add(holder);
    const inner = makePiece(pr.piece, mat); if (pr.piece === 'knight') inner.rotation.y = -Math.PI / 2; holder.add(inner);
    const meshes = []; inner.traverse((o) => { if (o.isMesh) { o.userData = { kind: 'proj', i }; meshes.push(o); } });
    return { holder, inner, mat, meshes, baseRot: inner.rotation.y };
  });
  const projMeshes = projPieces.flatMap((p) => p.meshes);
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.48), new THREE.MeshBasicMaterial({ color: 0xff3d9a, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  hl.rotation.x = -Math.PI / 2; hl.position.y = 0.006; hl.visible = false; board.add(hl);

  /* ---------- the scoresheet clipboard: name + position ---------- */
  const sheetMeshes = [];
  const sheet = (() => {
    const W = 1024, Hh = 1400; const [c, x] = cnv(W, Hh);
    x.fillStyle = '#efe7d4'; x.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(120,100,80,${Math.random() * 0.05})`; x.fillRect(Math.random() * W, Math.random() * Hh, 2 + Math.random() * 3, 2 + Math.random() * 3); }
    const ink = '#1d1730', red = '#c2185b', soft = '#6d6480';
    x.fillStyle = ink; x.fillRect(40, 40, W - 80, 96);
    x.fillStyle = '#efe7d4'; x.textBaseline = 'middle'; x.textAlign = 'left';
    x.font = '700 44px "Chakra Petch", sans-serif'; x.fillText('♞  OFFICIAL SCORESHEET', 70, 90);
    x.textAlign = 'right'; x.font = '500 26px "JetBrains Mono", monospace'; x.fillText('BOARD e1', W - 70, 90);
    const field = (label, value, y, size, color) => {
      x.textAlign = 'left'; x.fillStyle = soft; x.font = '600 22px "JetBrains Mono", monospace'; x.fillText(label.toUpperCase(), 60, y);
      x.strokeStyle = 'rgba(29,23,48,.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(60, y + size * 0.95 + 14); x.lineTo(W - 60, y + size * 0.95 + 14); x.stroke();
      x.fillStyle = color || ink; fitFont(x, value, 700, '"Chakra Petch", sans-serif', size, W - 130); x.fillText(value, 64, y + size * 0.6 + 6);
    };
    field('Event', 'Portfolio Open · Colombo 2026', 180, 40);
    field('White', PROFILE.name.toUpperCase(), 290, 76, ink);
    field('Position', PROFILE.role, 440, 50, red);
    x.textAlign = 'left'; x.fillStyle = ink; x.font = '500 30px "Chakra Petch", sans-serif';
    x.fillText('Developer · UI/UX Engineer · SEO · Chess player', 64, 560);
    field('Black', 'Your next project', 610, 40, soft);
    const top = 730, rowH = 66, cols = [60, 160, 590, W - 60];
    x.strokeStyle = ink; x.lineWidth = 3; x.strokeRect(cols[0], top, cols[3] - cols[0], rowH * 9);
    x.fillStyle = 'rgba(29,23,48,.08)'; x.fillRect(cols[0], top, cols[3] - cols[0], rowH);
    x.lineWidth = 2; [1, 2].forEach((i) => { x.beginPath(); x.moveTo(cols[i], top); x.lineTo(cols[i], top + rowH * 9); x.stroke(); });
    x.font = '700 24px "JetBrains Mono", monospace'; x.fillStyle = ink; x.textAlign = 'center';
    x.fillText('#', (cols[0] + cols[1]) / 2, top + rowH / 2); x.fillText('WHITE', (cols[1] + cols[2]) / 2, top + rowH / 2); x.fillText('BLACK', (cols[2] + cols[3]) / 2, top + rowH / 2);
    SCORESHEET_MOVES.forEach(([w, b], i) => {
      const y = top + rowH * (i + 1);
      x.strokeStyle = 'rgba(29,23,48,.3)'; x.beginPath(); x.moveTo(cols[0], y); x.lineTo(cols[3], y); x.stroke();
      x.fillStyle = soft; x.font = '600 26px "JetBrains Mono", monospace'; x.fillText(String(i + 1), (cols[0] + cols[1]) / 2, y + rowH / 2);
      x.fillStyle = i === SCORESHEET_MOVES.length - 1 ? red : '#2b2348'; x.font = 'italic 500 32px "Chakra Petch", sans-serif';
      x.fillText(w, (cols[1] + cols[2]) / 2, y + rowH / 2); x.fillText(b, (cols[2] + cols[3]) / 2, y + rowH / 2);
    });
    x.textAlign = 'left'; x.fillStyle = ink; x.font = '700 30px "Chakra Petch", sans-serif';
    x.fillText('4+ years  ·  10+ projects  ·  All-Island chess 2nd runner-up', 64, top + rowH * 9 + 56);
    x.fillStyle = soft; x.font = '500 22px "JetBrains Mono", monospace'; x.fillText('Click the sheet to read the full game', 64, top + rowH * 9 + 104);
    x.strokeStyle = red; x.lineWidth = 3; x.beginPath(); x.moveTo(640, Hh - 70);
    for (let i = 0; i < 30; i++) x.lineTo(640 + i * 10, Hh - 70 - Math.sin(i * 0.9) * 14 - (i % 7 === 0 ? 10 : 0));
    x.stroke();

    const g = new THREE.Group(); g.position.set(6.6, 0.02, 7.2); g.rotation.y = -0.32; scene.add(g);
    const tilt = new THREE.Group(); tilt.rotation.x = -Math.PI / 2 + 0.42; tilt.position.y = 0.95; g.add(tilt);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x3b2a22, roughness: 0.5 });
    const cb = new THREE.Mesh(new THREE.BoxGeometry(3.25, 4.3, 0.08), boardMat); cb.castShadow = true; cb.receiveShadow = true; tilt.add(cb);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.32, 0.14), new THREE.MeshStandardMaterial({ color: 0xb9b2c9, metalness: 0.8, roughness: 0.25 })); clip.position.set(0, 2.0, 0.08); tilt.add(clip);
    const paperTex = tex(c);
    // MeshBasic keeps the paper readable at night without tipping into bloom.
    const paperMat = new THREE.MeshBasicMaterial({ map: paperTex, color: 0xb4ac9e });
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(2.95, 4.03), paperMat); paper.position.set(0, -0.08, 0.045); tilt.add(paper);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), boardMat); leg.position.set(0, 0.95, -0.85); leg.rotation.x = 0.5; g.add(leg);
    const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), new THREE.MeshStandardMaterial({ color: 0xffb547, roughness: 0.5 }));
    pencil.rotation.z = Math.PI / 2; pencil.rotation.y = 0.4; pencil.position.set(1.9, 0.05, 1.4); g.add(pencil);
    const L = new THREE.PointLight(0xffe6c8, P(0.6), 6, 0); L.position.set(0, 3, 2.2); g.add(L);
    [cb, clip, paper].forEach((m) => { m.userData = { kind: 'sheet' }; sheetMeshes.push(m); });
    return { g, tilt };
  })();

  /* ---------- rain + ripples ---------- */
  // The GPU moves the rain: each drop falls from its start height at its own speed, wraps every
  // 20 units, and picks a fresh random x/z on each wrap (hashed from the drop's seed and wrap count).
  // Same drops, speeds, wind and streak length as moving them on the CPU, without the per-frame upload.
  const RAIN = touch ? 1300 : reduce ? 1000 : 2600, LEN = 0.45, WIND = 0.12, AVG_SPEED = 19;
  const rainGeo = new THREE.BufferGeometry();
  const ends = new Float32Array(RAIN * 6), drop = new Float32Array(RAIN * 6);
  for (let i = 0; i < RAIN; i++) {
    const y0 = Math.random() * 20, speed = 15 + Math.random() * 8, sd = Math.random() * 1000;
    ends[i * 6 + 1] = 1; // vertex 0 is the top of the streak, vertex 1 the bottom
    drop.set([y0, speed, sd, y0, speed, sd], i * 6);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(ends, 3));
  rainGeo.setAttribute('aDrop', new THREE.BufferAttribute(drop, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xa9b8ff, transparent: true, opacity: 0.3 });
  const rainTime = { value: 0 };
  rainMat.onBeforeCompile = (s) => {
    s.uniforms.uTime = rainTime;
    s.vertexShader = s.vertexShader
      .replace('void main() {', `attribute vec3 aDrop;
uniform float uTime;
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
void main() {`)
      .replace('#include <begin_vertex>', `float yy = aDrop.x - aDrop.y * uTime;
float wrap = floor(yy / 20.0);
vec2 h = hash22(vec2(aDrop.z, wrap));
vec3 transformed = vec3((h.x - 0.5) * 46.0 + position.y * ${WIND.toFixed(2)}, yy - wrap * 20.0 + position.y * ${LEN.toFixed(2)}, -22.0 + h.y * 40.0);`);
  };
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false; scene.add(rain);

  // Ripples: one instanced mesh with a per-ring opacity, instead of 40 separate meshes.
  const RIPPLES = 40;
  const rippleMat = new THREE.MeshBasicMaterial({ color: 0xb7c4ff, transparent: true, depthWrite: false });
  rippleMat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('void main() {', 'attribute float aAlpha;\nvarying float vAlpha;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
    s.fragmentShader = s.fragmentShader.replace('void main() {', 'varying float vAlpha;\nvoid main() {').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vAlpha;');
  };
  const ringGeo = new THREE.RingGeometry(0.05, 0.075, 24);
  const rippleAlpha = new THREE.InstancedBufferAttribute(new Float32Array(RIPPLES), 1);
  ringGeo.setAttribute('aAlpha', rippleAlpha);
  const rippleMesh = new THREE.InstancedMesh(ringGeo, rippleMat, RIPPLES);
  rippleMesh.frustumCulled = false; scene.add(rippleMesh);
  const ripples = Array.from({ length: RIPPLES }, () => ({ life: -1, x: 0, z: 0 }));
  const flat = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -Math.PI / 2);
  const m4 = new THREE.Matrix4(), rp = new V3(), rsc = new V3();
  for (let i = 0; i < RIPPLES; i++) rippleMesh.setMatrixAt(i, m4.makeScale(0, 0, 0));
  function ripple(x, z) {
    if (Math.abs(x) > 15 || z < -11 || z > 13) return;
    if (Math.abs(x) < 2.7 && Math.abs(z - 0.2) < 2.7) return;
    if (Math.abs(x) < 3.9 && z < -2.4 && z > -6.5) return;
    if (Math.abs(x - 6.6) < 2 && Math.abs(z - 7.2) < 2.4) return;
    const r = ripples.find((r) => r.life < 0); if (!r) return;
    r.life = 0; r.x = x; r.z = z;
  }
  // About 5% of landing drops leave a ripple, as before. Landings are spread over the same area.
  let rippleDebt = 0;
  function updateRain(dt) {
    rainTime.value += dt;
    if (rainTime.value > 2000) rainTime.value -= 2000; // keeps the shader maths precise
    rippleDebt += RAIN * (AVG_SPEED / 20) * 0.05 * dt;
    for (; rippleDebt >= 1; rippleDebt--) ripple((Math.random() - 0.5) * 46, -22 + Math.random() * 40);
    ripples.forEach((r, i) => {
      if (r.life < 0) return;
      r.life += dt / 0.6;
      if (r.life >= 1) { r.life = -1; rippleAlpha.array[i] = 0; rippleMesh.setMatrixAt(i, m4.makeScale(0, 0, 0)); return; }
      const s = 1 + r.life * 6;
      rippleMesh.setMatrixAt(i, m4.compose(rp.set(r.x, 0.025, r.z), flat, rsc.set(s, s, 1)));
      rippleAlpha.array[i] = 0.5 * (1 - r.life);
    });
    rippleMesh.instanceMatrix.needsUpdate = true; rippleAlpha.needsUpdate = true;
  }

  return { giants, giantMeshes, board, boardTop, ivoryS, ebonyS, sqPos, decor, projPieces, projMeshes, hl, sheet, sheetMeshes, signMat, signLight, flash, drawCode, updateRain, PIECE_SCALE: 0.62 };
}
