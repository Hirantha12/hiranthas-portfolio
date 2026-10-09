// Hirantha, the opponent in "Play for them". Semi-realistic and built entirely in code: shaped
// geometry plus faces painted on canvases (one per mood), so there is nothing to download.
// Loaded with import() only when a game starts. He stands at the table in front of the café
// kiosk and uses one hand for everything, as the rules require: it moves his piece, then presses
// his clock. His stretchy arm lets him reach across the board.
import * as THREE from 'three';
import gsap from 'gsap';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cnv, tex } from './canvas.js';
import { Snd } from '../audio/sound.js';

const V3 = THREE.Vector3, UP = new V3(0, 1, 0);
const SKIN = 0x84543a, HAIR = 0x120c0a, POLO = 0x1b2442, TROUSERS = 0x0d0f17, SHOES = 0x0b0b0d;
const LOGO_TEXT = 'Softvil'; // chest logo on the polo; set to '' to leave it plain
const R = 0.25; // head radius

// Seeded random, so the hair and beard look the same on every visit and in every mood.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Turns a sphere into a head: a narrower jaw and a chin that comes forward slightly.
function shapeHead(geo) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ny = y / R;
    if (ny < 0) {
      const t = -ny;
      x *= 1 - 0.3 * t * t;
      z *= 1 - 0.1 * t * t;
      if (z > 0) z += 0.03 * t * t; // chin
    } else if (ny > 0.55) z *= 1 - 0.08 * (ny - 0.55); // slightly flatter crown
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Faces are painted on a canvas that wraps the front of the head. cy()/cx() convert a point on
// the head (in metres) to the canvas, so features line up with the 3D nose and jaw.
const FACE = { phi: 1.9, theta0: 0.75, theta: 1.8, w: 512, h: 480 };
const cy = (y) => ((Math.acos(Math.max(-1, Math.min(1, y / R))) - FACE.theta0) / FACE.theta) * FACE.h;
const cx = (x) => 256 + (Math.asin(Math.max(-1, Math.min(1, x / 0.9 / R))) / FACE.phi) * FACE.w;

// mood: 'smile' (default), 'happy', 'sad' or 'surprised'.
function drawFace(mood) {
  seed = 11;
  const [c, x] = cnv(FACE.w, FACE.h);
  x.lineCap = 'round'; x.lineJoin = 'round';
  const blob = (X, Y, rx, ry, col) => { const m = Math.max(rx, ry), g = x.createRadialGradient(X, Y, 0, X, Y, m); g.addColorStop(0, col); g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); x.save(); x.translate(X, Y); x.scale(rx / m, ry / m); x.translate(-X, -Y); x.fillStyle = g; x.beginPath(); x.arc(X, Y, m, 0, 7); x.fill(); x.restore(); };
  const strokes = (n, area, len, ang, col, w = 1.6) => {
    x.strokeStyle = col; x.lineWidth = w;
    for (let i = 0; i < n; i++) {
      const [X, Y] = area(); const a = ang + (rnd() - 0.5) * 0.6;
      x.beginPath(); x.moveTo(X, Y); x.lineTo(X + Math.cos(a) * len, Y + Math.sin(a) * len); x.stroke();
    }
  };
  const eyeY = cy(0.02), browY = cy(0.062), noseY = cy(-0.07), mY = cy(-0.112), chinY = cy(-0.19);
  const eL = cx(-0.064), eR = cx(0.064);
  const happy = mood === 'happy', sad = mood === 'sad', surprised = mood === 'surprised', talk = mood === 'talk';

  // soft shading: eye sockets, cheekbones, beside the nose, under the lip, warm cheeks
  [eL, eR].forEach((X) => blob(X, eyeY - 6, 46, 30, 'rgba(60,32,20,.22)'));
  [cx(-0.12), cx(0.12)].forEach((X) => blob(X, cy(-0.06), 30, 46, 'rgba(60,32,20,.14)'));
  [cx(-0.03), cx(0.03)].forEach((X) => blob(X, noseY - 18, 12, 34, 'rgba(60,32,20,.18)'));
  blob(256, cy(-0.15), 34, 12, 'rgba(50,26,16,.25)');
  [cx(-0.1), cx(0.1)].forEach((X) => blob(X, cy(-0.03) - (happy ? 6 : 0), 34, 26, `rgba(190,90,70,${happy ? 0.16 : 0.1})`));
  blob(256, cy(0.13), 90, 34, 'rgba(255,220,190,.08)');

  // eyes: almond shape, dark brown iris; happy squints, surprised opens wide, sad droops
  const top = surprised ? 20 : happy ? 11 : 15, bot = happy ? 5 : surprised ? 13 : 10;
  [[eL, 1], [eR, -1]].forEach(([X, s]) => {
    const Y = eyeY, w = 35, droop = sad ? s * 3 : 0;
    x.save();
    x.beginPath(); x.moveTo(X - w, Y + 1 + droop); x.bezierCurveTo(X - w * 0.5, Y - top * 1.5, X + w * 0.5, Y - top * 1.4, X + w, Y - 1 - droop);
    x.bezierCurveTo(X + w * 0.5, Y + bot * 1.2, X - w * 0.5, Y + bot * 1.3, X - w, Y + 1 + droop); x.closePath();
    x.fillStyle = '#e6d9cf'; x.fill(); x.clip();
    x.fillStyle = '#3b2114'; x.beginPath(); x.arc(X + s * 1.5, Y - 1, 13.5, 0, 7); x.fill();
    x.fillStyle = '#100805'; x.beginPath(); x.arc(X + s * 1.5, Y - 1, surprised ? 5 : 6.5, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(X + s * 1.5 - 4, Y - 5, 2.6, 0, 7); x.fill();
    x.fillStyle = 'rgba(40,20,12,.35)'; x.fillRect(X - w, Y - top * 1.6, w * 2, 6);
    x.restore();
    x.strokeStyle = '#140b07'; x.lineWidth = 4.5;
    x.beginPath(); x.moveTo(X - w - 2, Y + 2 + droop); x.bezierCurveTo(X - w * 0.5, Y - top * 1.55, X + w * 0.5, Y - top * 1.45, X + w + 2, Y - 1 - droop); x.stroke();
    x.strokeStyle = 'rgba(70,38,24,.45)'; x.lineWidth = happy ? 3 : 2;
    x.beginPath(); x.moveTo(X - w + 4, Y + 4); x.bezierCurveTo(X - w * 0.4, Y + bot * 1.35, X + w * 0.4, Y + bot * 1.3, X + w - 3, Y + 1); x.stroke();
    if (happy) { x.strokeStyle = 'rgba(70,38,24,.35)'; x.beginPath(); x.moveTo(X + s * -(w + 4), Y + 2); x.lineTo(X + s * -(w + 14), Y + 8); x.stroke(); } // smile lines
    // brows: thick near the nose, tapering outwards; sad lifts the inner ends, surprised lifts both
    const inner = X + s * 26, outer = X - s * 36;
    const lift = surprised ? -14 : 0, innerLift = sad ? -12 : happy ? 2 : 0;
    x.fillStyle = '#17100b';
    x.beginPath(); x.moveTo(inner, browY + 4 + lift + innerLift); x.quadraticCurveTo(X, browY - 9 + lift, outer, browY + 3 + lift + (sad ? 6 : 0));
    x.quadraticCurveTo(X, browY - 1 + lift, inner, browY + 12 + lift + innerLift); x.closePath(); x.fill();
  });

  // nose
  x.fillStyle = 'rgba(45,22,14,.75)';
  [-1, 1].forEach((s) => { x.beginPath(); x.ellipse(256 + s * 12, noseY + 6, 6, 3.5, s * 0.4, 0, 7); x.fill(); });
  blob(256, noseY + 14, 26, 8, 'rgba(60,30,18,.28)');

  // mouth
  if (surprised) {
    x.fillStyle = '#2a0e0a'; x.beginPath(); x.ellipse(256, mY + 6, 17, 21, 0, 0, 7); x.fill();
    x.strokeStyle = '#7a372d'; x.lineWidth = 6; x.stroke();
  } else if (talk) { // mid-word: mouth open, a little teeth showing
    x.fillStyle = '#2a0e0a'; x.beginPath(); x.ellipse(256, mY + 6, 34, 13, 0, 0, 7); x.fill();
    x.fillStyle = '#efe8e0'; x.fillRect(256 - 22, mY - 5, 44, 5);
    x.strokeStyle = '#7a372d'; x.lineWidth = 6; x.beginPath(); x.ellipse(256, mY + 6, 34, 13, 0, 0, 7); x.stroke();
  } else {
    const corner = happy ? -12 : sad ? 10 : -3, open = happy ? 12 : 0;
    x.fillStyle = '#5a2219';
    x.beginPath(); x.moveTo(256 - 52, mY + 1 + corner); x.quadraticCurveTo(256 - 22, mY - 15, 256, mY - 8); x.quadraticCurveTo(256 + 22, mY - 15, 256 + 52, mY - 2 + corner);
    x.quadraticCurveTo(256, mY + 5 + (sad ? -6 : 0), 256 - 52, mY + 1 + corner); x.fill();
    if (open) { x.fillStyle = '#f1ece6'; x.beginPath(); x.moveTo(256 - 40, mY + 1); x.quadraticCurveTo(256, mY + open + 10, 256 + 40, mY - 1); x.quadraticCurveTo(256, mY + 4, 256 - 40, mY + 1); x.fill(); }
    x.fillStyle = '#8a3d32';
    x.beginPath(); x.moveTo(256 - 46, mY + 3 + corner * 0.8 + open); x.quadraticCurveTo(256, mY + 30 + open + (sad ? -10 : 0), 256 + 46, mY + 1 + corner * 0.8 + open);
    x.quadraticCurveTo(256, mY + 6 + open, 256 - 46, mY + 3 + corner * 0.8 + open); x.fill();
    x.strokeStyle = '#250d09'; x.lineWidth = 3.5;
    x.beginPath(); x.moveTo(256 - 54, mY - 1 + corner); x.quadraticCurveTo(256, mY + 7 + (sad ? -8 : 0), 256 + 54, mY - 4 + corner); x.stroke();
  }

  // facial hair: thin moustache, soul patch, a short chin beard that thins out along the jaw, stubble
  const ink = 'rgba(14,8,5,.85)';
  strokes(260, () => { const t = rnd() * 2 - 1; return [256 + t * 48, mY - 30 + Math.abs(t) * 10 + rnd() * 6]; }, 6, Math.PI / 2 + 0.2, ink);
  strokes(50, () => [256 - 8 + rnd() * 16, mY + 26 + (happy ? 8 : 0) + rnd() * 10], 5, Math.PI / 2, 'rgba(14,8,5,.7)');
  const b0 = cy(-0.158);
  strokes(900, () => { const y = b0 + rnd() * (FACE.h - b0); const half = 58 - Math.max(0, y - b0 - 40) * 0.1; return [256 + (rnd() * 2 - 1) * half, y]; }, 7, Math.PI / 2, ink);
  strokes(420, () => { const s = rnd() < 0.5 ? -1 : 1, t = rnd(); return [256 + s * (60 + t * 120), b0 + 30 - t * 120 + rnd() * 30]; }, 5, Math.PI / 2 + 0.3, 'rgba(14,8,5,.42)');
  x.fillStyle = 'rgba(30,18,12,.2)';
  for (let i = 0; i < 1200; i++) { const a = Math.PI * (0.12 + rnd() * 0.76), rr = 140 + rnd() * 80; const X = 256 + Math.cos(a) * rr * 1.1, Y = cy(-0.02) + Math.sin(a) * rr * 0.75; if (Y > mY - 26) x.fillRect(X, Y, 1.4, 1.4); }
  return tex(c);
}

function poloTexture() {
  const [c, x] = cnv(64, 64);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = 'rgba(0,0,0,.10)';
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) if ((i + j) % 2) x.fillRect(i * 4, j * 4, 2, 2);
  return tex(c, 8);
}

function logoTexture() {
  const [c, x] = cnv(256, 128);
  x.strokeStyle = '#4fc3f7'; x.lineWidth = 9; x.lineCap = 'round';
  x.beginPath(); x.ellipse(108, 34, 24, 13, 0, 0, 7); x.stroke();
  x.beginPath(); x.ellipse(148, 34, 24, 13, 0, 0, 7); x.stroke();
  x.font = '700 44px "Chakra Petch", sans-serif'; x.textAlign = 'center'; x.fillStyle = '#eef3ff';
  x.fillText(LOGO_TEXT, 128, 104);
  return tex(c);
}

export function createAvatar({ scene, position }) {
  const root = new THREE.Group(); root.position.copy(position); root.visible = false; scene.add(root);
  const SIZE = 1.2;
  // Gentle self-light keeps him readable with the kiosk lights behind him, without adding a lamp.
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.55, emissive: SKIN, emissiveIntensity: 0.22 });
  const hairMat = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.45, metalness: 0.05 });
  const polo = new THREE.MeshStandardMaterial({ color: POLO, map: poloTexture(), roughness: 0.85, emissive: POLO, emissiveIntensity: 0.35 });
  const trousers = new THREE.MeshStandardMaterial({ color: TROUSERS, roughness: 0.8, emissive: TROUSERS, emissiveIntensity: 0.35 });
  const shoes = new THREE.MeshStandardMaterial({ color: SHOES, roughness: 0.35, metalness: 0.1 });
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };

  /* ---------- legs and shoes: hinged at hip and knee, so he can stand at the board or sit ---------- */
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.6 });
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group(); hip.position.set(s * 0.12, 0.92, 0); root.add(hip);
    mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.44, 14), trousers, hip, 0, -0.22, 0);
    const knee = new THREE.Group(); knee.position.y = -0.44; hip.add(knee);
    mesh(new THREE.CylinderGeometry(0.085, 0.072, 0.42, 14), trousers, knee, 0, -0.21, 0);
    const shoe = mesh(new THREE.CapsuleGeometry(0.065, 0.17, 6, 12), shoes, knee, s * 0.01, -0.42, 0.07);
    shoe.rotation.x = Math.PI / 2; shoe.scale.set(1.05, 1, 0.75);
    mesh(new THREE.BoxGeometry(0.13, 0.02, 0.3), soleMat, knee, s * 0.01, -0.468, 0.07);
    return { hip, knee };
  });
  // a bar stool for when he is working inside the kiosk
  const stool = new THREE.Group(); stool.visible = false; root.add(stool);
  {
    const wood = new THREE.MeshStandardMaterial({ color: 0x5b3826, roughness: 0.6 });
    mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20), wood, stool, 0, 0.79, -0.02);
    mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.58, 10), new THREE.MeshStandardMaterial({ color: 0x2a1b22, roughness: 0.7 }), stool, 0, 0.49, -0.02);
  }
  // his coffee, on the counter beside the laptop
  const mug = mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.13, 18), new THREE.MeshStandardMaterial({ color: 0xece4d2, roughness: 0.4 }), root, -0.42, 1.453, 0.5);
  mesh(new THREE.TorusGeometry(0.032, 0.01, 6, 12), mug.material, mug, -0.062, 0, 0).rotation.y = Math.PI / 2;
  mug.visible = false;
  const MUG_HOME = mug.position.clone();

  /* ---------- body ---------- */
  const torso = new THREE.Group(); root.add(torso);
  mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 20), trousers, torso, 0, 0.92, 0).scale.set(1.12, 1, 0.72); // hips
  const chest = mesh(new THREE.CapsuleGeometry(0.27, 0.42, 8, 20), polo, torso, 0, 1.33, 0); chest.scale.set(1.32, 1, 0.68);
  [-1, 1].forEach((s) => { const sh = mesh(new THREE.SphereGeometry(0.1, 16, 12), polo, torso, s * 0.3, 1.64, -0.01); sh.scale.set(1.05, 0.7, 0.8); });
  mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.07, 20, 1, true), polo, torso, 0, 1.79, 0); // collar band
  [-1, 1].forEach((s) => { const f = mesh(new THREE.BoxGeometry(0.1, 0.012, 0.075), polo, torso, s * 0.06, 1.755, 0.17); f.rotation.set(0.5, 0, s * 0.35); });
  mesh(new THREE.BoxGeometry(0.05, 0.17, 0.012), new THREE.MeshStandardMaterial({ color: 0x161e38, roughness: 0.85, emissive: POLO, emissiveIntensity: 0.3 }), torso, 0, 1.66, 0.183);
  const btn = new THREE.MeshStandardMaterial({ color: 0xe8e4ee, roughness: 0.4 });
  [1.71, 1.63].forEach((y) => mesh(new THREE.SphereGeometry(0.011, 8, 6), btn, torso, 0, y, 0.19));
  if (LOGO_TEXT) {
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.065), new THREE.MeshBasicMaterial({ map: logoTexture(), transparent: true, depthWrite: false }));
    logo.position.set(0.13, 1.57, 0.188); logo.rotation.y = 0.28; torso.add(logo); // wearer's left chest
  }
  mesh(new THREE.CylinderGeometry(0.068, 0.078, 0.16, 16), skin, torso, 0, 1.83, 0); // neck

  /* ---------- head ---------- */
  const head = new THREE.Group(); head.position.set(0, 2.03, 0.01); torso.add(head);
  const skull = mesh(shapeHead(new THREE.SphereGeometry(R, 40, 30)), skin, head); skull.scale.set(0.9, 1.12, 0.98);
  const faces = { smile: drawFace('smile'), happy: drawFace('happy'), sad: drawFace('sad'), surprised: drawFace('surprised'), talk: drawFace('talk') };
  const faceMat = new THREE.MeshStandardMaterial({ map: faces.smile, transparent: true, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  skull.add(new THREE.Mesh(shapeHead(new THREE.SphereGeometry(R * 1.004, 40, 30, Math.PI / 2 - FACE.phi / 2, FACE.phi, FACE.theta0, FACE.theta)), faceMat));
  const setFace = (m) => { faceMat.map = faces[m] || faces.smile; };
  const nose = mesh(new THREE.SphereGeometry(0.022, 14, 10), skin, skull, 0, -0.035, 0.236); nose.scale.set(0.75, 2, 0.9); nose.rotation.x = -0.3;
  mesh(new THREE.SphereGeometry(0.02, 14, 10), skin, skull, 0, -0.068, 0.245).scale.set(1.3, 0.9, 0.9);
  [-1, 1].forEach((s) => mesh(new THREE.SphereGeometry(0.05, 12, 10), skin, skull, s * 0.244, -0.01, -0.01).scale.set(0.45, 1.15, 0.8));

  // hair: short sides and back, textured volume on top that stands up at the front
  {
    seed = 7;
    const parts = [];
    parts.push(shapeHead(new THREE.SphereGeometry(R * 1.035, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.42)).rotateX(-0.32).translate(0, 0.006, -0.012));
    parts.push(new THREE.SphereGeometry(R * 1.03, 28, 16, Math.PI, Math.PI, 0.4, 1.25).translate(0, 0, -0.008));
    for (let i = 0; i < 58; i++) {
      const a = (rnd() - 0.5) * 2, b = Math.pow(rnd(), 0.75); // a: across the head, b: front (0) to back (1)
      const r = 0.026 + rnd() * 0.02, lift = 1.1 + (1 - b) * 1.5 - Math.abs(a) * 0.4;
      const tuft = new THREE.SphereGeometry(r, 8, 6).scale(1, lift, 0.8);
      tuft.rotateX(-0.05 - b * 0.75 + (rnd() - 0.5) * 0.45).rotateZ(-a * 0.55 + (rnd() - 0.5) * 0.5);
      const ang = a * 0.95, el = 0.95 - b * 0.55;
      tuft.translate(Math.sin(ang) * Math.cos(el) * R, Math.sin(el) * R * 1.06 + 0.012 + (1 - b) * 0.02, (Math.cos(ang) * Math.cos(el) * 0.85 - b * 0.55) * R * 0.95);
      parts.push(tuft);
    }
    mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))), hairMat, skull);
  }

  /* ---------- arms: short polo sleeve, bare arm, stretchy so he can reach every square ---------- */
  const arms = [-1, 1].map((s) => {
    const shoulder = new V3(s * 0.33, 1.63, 0);
    const sleeve = mesh(new THREE.CylinderGeometry(0.085, 0.078, 1, 16), polo, root);
    const upper = mesh(new THREE.CylinderGeometry(0.056, 0.05, 1, 12), skin, root);
    const fore = mesh(new THREE.CylinderGeometry(0.05, 0.04, 1, 12), skin, root);
    const hand = mesh(new THREE.SphereGeometry(0.06, 16, 12), skin, root); hand.scale.set(1, 0.62, 1.35);
    const thumb = mesh(new THREE.SphereGeometry(0.022, 8, 6), skin, hand, -s * 0.05, 0.01, 0.02); thumb.scale.set(1, 1, 1.8);
    const rest = new V3(s * 0.36, 1.0, 0.45);
    hand.position.copy(rest);
    return { s, shoulder, sleeve, upper, fore, hand, rest, follow: null, offset: new V3() };
  });
  // His left hand (+x, nearer the clock) moves the pieces and presses the clock; the right one thinks.
  const [otherArm, playArm] = arms;

  const tmp = new V3(), dir = new V3(), elbow = new V3(), cuff = new V3();
  function stretch(m, a, b) {
    dir.subVectors(b, a); const len = Math.max(dir.length(), 0.001);
    m.position.copy(a).addScaledVector(dir, 0.5); m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
  }
  const toLocal = (world) => root.worldToLocal(world.clone());

  /* ---------- name label over his seat: "click to talk" ---------- */
  const label = (() => {
    const [c, x] = cnv(512, 128);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(13,10,24,.82)'; x.beginPath(); x.roundRect(36, 14, 440, 100, 50); x.fill();
    x.strokeStyle = '#3ef2ff'; x.lineWidth = 4; x.shadowColor = '#3ef2ff'; x.shadowBlur = 14; x.stroke(); x.shadowBlur = 0;
    x.font = '700 40px "Chakra Petch", sans-serif'; x.fillStyle = '#f3ead8'; x.fillText('HIRANTHA', 256, 52);
    x.font = '500 24px "JetBrains Mono", monospace'; x.fillStyle = '#3ef2ff'; x.fillText('💬 click to talk', 256, 90);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false }));
    s.scale.set(1.3, 0.325, 1); s.position.set(1.3, 3.08, -4.1); s.visible = false; scene.add(s);
    return s;
  })();
  // Everything clickable on him (body and label) carries the same tag for the page's picker.
  const pickMeshes = [label];
  root.traverse((o) => { if (o.isMesh) pickMeshes.push(o); });
  pickMeshes.forEach((o) => { o.userData = { kind: 'hirantha' }; });

  /* ---------- behaviour ---------- */
  const look = new V3(0, 1.1, 2.6), lookT = look.clone();
  let t = 0, mood = 'idle', act = null;
  function update(dt) {
    if (!root.visible) return;
    t += dt;
    for (const a of arms) {
      if (a.follow) { a.follow.getWorldPosition(tmp); a.hand.position.copy(toLocal(tmp)).add(a.offset); }
      elbow.copy(a.shoulder).lerp(a.hand.position, 0.42).add(tmp.set(a.s * 0.07, -0.12, -0.02));
      cuff.copy(a.shoulder).lerp(elbow, Math.min(0.55, 0.22 / Math.max(a.shoulder.distanceTo(elbow), 0.01)));
      stretch(a.sleeve, a.shoulder, cuff); stretch(a.upper, cuff, elbow); stretch(a.fore, elbow, a.hand.position);
      a.hand.lookAt(tmp.copy(a.hand.position).sub(elbow).add(a.hand.position).applyMatrix4(root.matrixWorld));
    }
    torso.position.y = Math.sin(t * 1.6) * 0.008; // breathing
    torso.rotation.z = Math.sin(t * 0.5) * 0.015;
    look.lerp(lookT, Math.min(1, dt * 4));
    head.lookAt(tmp.copy(look).applyMatrix4(root.matrixWorld));
    if (mood === 'think') head.rotation.z += Math.sin(t * 2) * 0.03;
    // talking: the mouth flips between open and closed shapes, with a small head bob
    if (talking) {
      flap += dt;
      const open = Math.sin(flap * 17) + Math.sin(flap * 7.3) * 0.6 > 0.15;
      setFace(open ? 'talk' : 'smile');
      head.rotation.x += Math.sin(flap * 5) * 0.025;
    }
    label.visible = root.visible && working;
    if (label.visible) label.position.y = 3.08 + Math.sin(t * 1.4) * 0.04;
  }
  let talking = false, flap = 0;

  // Head targets are in his local space (+z is towards the visitor).
  const lookAtWorld = (w) => lookT.copy(toLocal(w));
  const lookAtBoard = () => lookT.set(0, 1.1, 1.6);
  const lookAtVisitor = () => lookT.set(0, 2.1, 6);
  const home = (a, d = 0.45) => ({ x: a.rest.x, y: a.rest.y, z: a.rest.z, duration: d, ease: 'power2.inOut' });
  // Each new action replaces the one before, so reactions never fight over his hands.
  function start() {
    if (act) act.kill();
    gsap.killTweensOf([otherArm.hand.position, playArm.hand.position, root.rotation]);
    act = gsap.timeline();
    return act;
  }

  /* ---------- between games: sitting in the kiosk, coding and drinking coffee ---------- */
  const PLAY_POS = position.clone(), WORK_POS = new V3(1.3, -0.25, -4.25);
  const screenAt = new V3(1.3, 1.62, -3.15); // his laptop screen (world)
  let working = false;
  function setPose(sit) {
    legs.forEach(({ hip, knee }) => { hip.rotation.x = sit ? -Math.PI / 2 : 0; knee.rotation.x = sit ? Math.PI / 2 : 0; });
    stool.visible = sit; mug.visible = sit;
    root.position.copy(sit ? WORK_POS : PLAY_POS);
  }
  const key = (a, x) => ({ x, y: 1.45, z: 0.62 });
  function workLoop() {
    if (!working) return;
    // a burst of typing, a pause to read, now and then a sip of coffee
    const tl = start();
    lookAtWorld(screenAt);
    for (let i = 0; i < 10; i++) {
      tl.to(playArm.hand.position, { y: 1.5 + rnd() * 0.02, duration: 0.09, yoyo: true, repeat: 1 }, i * 0.2)
        .to(otherArm.hand.position, { y: 1.5 + rnd() * 0.02, duration: 0.09, yoyo: true, repeat: 1 }, i * 0.2 + 0.1);
    }
    tl.add(() => lookT.set(0.1, 2.35, 3), '+=0.3').add(() => lookAtWorld(screenAt), '+=1.1');
    if (rnd() < 0.55) {
      tl.to(otherArm.hand.position, { x: MUG_HOME.x + 0.06, y: MUG_HOME.y + 0.02, z: MUG_HOME.z, duration: 0.4, ease: 'power2.inOut' })
        .add(() => { otherArm.follow = mug; otherArm.offset.set(0.065, 0, 0); lookAtVisitor(); setFace('happy'); })
        .to(mug.position, { x: -0.06, y: 1.9, z: 0.3, duration: 0.6, ease: 'power2.inOut' })
        .to(mug.rotation, { x: 0.7, duration: 0.3 }, '-=0.15')
        .to(mug.rotation, { x: 0, duration: 0.3 }, '+=0.6')
        .to(mug.position, { x: MUG_HOME.x, y: MUG_HOME.y, z: MUG_HOME.z, duration: 0.55, ease: 'power2.inOut' })
        .add(() => { otherArm.follow = null; setFace('smile'); })
        .to(otherArm.hand.position, key(otherArm, -0.13), '+=0.05');
    }
    tl.add(workLoop, '+=0.2');
  }
  function sitDown() {
    working = true; mood = 'idle'; setFace('smile');
    setPose(true);
    root.visible = true; root.rotation.set(0, 0, 0); root.scale.setScalar(SIZE);
    arms.forEach((a) => { a.follow = null; });
    otherArm.hand.position.set(-0.13, 1.45, 0.62); playArm.hand.position.set(0.13, 1.45, 0.62);
    mug.position.copy(MUG_HOME); mug.rotation.set(0, 0, 0);
    workLoop();
  }

  function show() {
    working = false; setPose(false);
    root.visible = true; mood = 'idle'; lookAtVisitor(); setFace('happy');
    arms.forEach((a) => { a.follow = null; a.hand.position.copy(a.rest); });
    root.rotation.set(0, 0, 0);
    root.scale.setScalar(0.001);
    gsap.to(root.scale, { x: SIZE, y: SIZE, z: SIZE, duration: 0.7, delay: 0.5, ease: 'back.out(1.6)' });
    // a wave hello
    start().to(otherArm.hand.position, { x: -0.42, y: 2.15, z: 0.25, duration: 0.45, ease: 'back.out(1.6)' }, 1.1)
      .to(otherArm.hand.position, { x: -0.3, duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut' })
      .to(otherArm.hand.position, home(otherArm))
      .add(() => setFace('smile'));
  }
  function hide() {
    if (act) act.kill();
    gsap.killTweensOf(root.scale); gsap.killTweensOf(root.rotation);
    // after a game he goes back to his laptop
    gsap.to(root.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3, onComplete: () => { root.rotation.set(0, 0, 0); sitDown(); } });
  }
  // Hand on chin while he thinks about his move.
  function think() {
    mood = 'think'; lookAtBoard(); setFace('smile');
    start().to(otherArm.hand.position, { x: -0.08, y: 1.84, z: 0.26, duration: 0.4, ease: 'power2.out' });
  }
  // Reach for a piece, then carry it: the hand follows the piece while the game animates it.
  function reachFor(obj, done) {
    mood = 'idle';
    obj.getWorldPosition(tmp); lookAtWorld(tmp);
    const p = toLocal(tmp).add(new V3(0, 0.36, 0));
    start().to(otherArm.hand.position, home(otherArm, 0.4), 0)
      .to(playArm.hand.position, {
        x: p.x, y: p.y, z: p.z, duration: 0.45, ease: 'power2.inOut',
        onComplete: () => { playArm.follow = obj; playArm.offset.set(0, 0.36, 0); done(); },
      }, 0);
  }
  function letGo(done) {
    playArm.follow = null;
    setTimeout(done, 120);
  }
  // Same hand presses the clock straight after the move, then he looks up with a confident smile.
  function pressClock(button, press) {
    button.getWorldPosition(tmp); lookAtWorld(tmp);
    const p = toLocal(tmp);
    start().to(playArm.hand.position, { x: p.x, y: p.y + 0.15, z: p.z, duration: 0.42, ease: 'power2.inOut' })
      .to(playArm.hand.position, { y: p.y + 0.05, duration: 0.07, onComplete: press })
      .to(playArm.hand.position, { y: p.y + 0.17, duration: 0.12 })
      .add(() => { lookAtVisitor(); setFace('happy'); })
      .to(playArm.hand.position, home(playArm))
      .add(() => setFace('smile'), '+=0.9');
  }
  // After the visitor moves: a small nod, or surprise when they capture or give check.
  function react(kind) {
    mood = 'idle';
    if (kind === 'surprised') {
      setFace('surprised'); lookAtVisitor();
      start().to(root.rotation, { x: -0.07, duration: 0.25, ease: 'power2.out' })
        .to(otherArm.hand.position, { x: -0.2, y: 2.0, z: 0.22, duration: 0.3, ease: 'back.out(2)' }, 0)
        .to(playArm.hand.position, { x: 0.2, y: 2.0, z: 0.22, duration: 0.3, ease: 'back.out(2)' }, 0)
        .to(root.rotation, { x: 0, duration: 0.5 }, '+=0.8')
        .to(otherArm.hand.position, home(otherArm, 0.5), '<')
        .to(playArm.hand.position, home(playArm, 0.5), '<')
        .add(() => { setFace('smile'); lookAtBoard(); });
    } else {
      setFace('smile'); lookAtBoard();
      start().to(head.position, { y: 2.0, duration: 0.16, yoyo: true, repeat: 1 });
    }
  }
  // Checkmate: sad first (hands on his head, shaking it), then happy for the visitor: he claps,
  // gives a thumbs-up and nods.
  function lose(done) {
    mood = 'idle'; setFace('sad'); lookT.set(0, 0.95, 0.9);
    const shake = { v: 0 };
    start()
      .to(root.rotation, { x: 0.12, duration: 0.5, ease: 'power2.out' })
      .to(otherArm.hand.position, { x: -0.3, y: 2.12, z: 0.05, duration: 0.45, ease: 'power2.out' }, 0)
      .to(playArm.hand.position, { x: 0.3, y: 2.12, z: 0.05, duration: 0.45, ease: 'power2.out' }, 0)
      .to(shake, { v: 1, duration: 1.4, ease: 'none', onUpdate: () => { lookT.x = Math.sin(shake.v * Math.PI * 6) * 0.9; } })
      .add(() => { lookT.x = 0; setFace('happy'); lookAtVisitor(); }, '+=0.2')
      .to(root.rotation, { x: -0.03, duration: 0.4 })
      .to(otherArm.hand.position, { x: -0.07, y: 1.5, z: 0.45, duration: 0.3 }, '<')
      .to(playArm.hand.position, { x: 0.07, y: 1.5, z: 0.45, duration: 0.3 }, '<');
    for (let i = 0; i < 4; i++) {
      act.to(otherArm.hand.position, { x: -0.16, duration: 0.11 }).to(playArm.hand.position, { x: 0.16, duration: 0.11 }, '<')
        .to(otherArm.hand.position, { x: -0.03, duration: 0.09 }).to(playArm.hand.position, { x: 0.03, duration: 0.09, onComplete: () => Snd.clack(3.2, 0.18) }, '<');
    }
    act.to(otherArm.hand.position, home(otherArm, 0.4))
      .to(playArm.hand.position, { x: 0.4, y: 1.95, z: 0.32, duration: 0.4, ease: 'back.out(2)' }, '<') // thumbs-up
      .to(head.position, { y: 1.99, duration: 0.18, yoyo: true, repeat: 3 })
      .to(playArm.hand.position, home(playArm, 0.5), '+=0.6')
      .to(root.rotation, { x: 0, duration: 0.4 }, '<')
      .add(() => done && done());
  }
  // Handshake: he reaches his right hand out over the board and holds it there; the game moves
  // `target` up and down for the shake, and his hand follows it.
  function offerHand(target) {
    mood = 'idle'; setFace('smile'); lookAtVisitor();
    target.getWorldPosition(tmp);
    const p = toLocal(tmp).add(new V3(0, 0, -0.06));
    start().to(otherArm.hand.position, {
      x: p.x, y: p.y, z: p.z, duration: 0.6, ease: 'power2.inOut',
      onComplete: () => { otherArm.follow = target; otherArm.offset.set(0, 0, -0.06); },
    });
  }
  function releaseHand() {
    otherArm.follow = null; setFace('happy');
    start().to(otherArm.hand.position, home(otherArm, 0.5), '+=0.25').add(() => setFace('smile'), '+=1');
  }
  function watchVisitor() { mood = 'idle'; lookAtBoard(); }

  // Chat: he stops coding, looks at the visitor and waves; talk(true/false) moves his mouth.
  function chatMode(on) {
    if (!on) { talking = false; sitDown(); return; }
    working = false; mood = 'idle'; setFace('happy'); lookAtVisitor();
    start().to(otherArm.hand.position, { x: -0.38, y: 2.0, z: 0.4, duration: 0.4, ease: 'back.out(1.6)' })
      .to(otherArm.hand.position, { x: -0.26, duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut' })
      .to(otherArm.hand.position, { x: -0.13, y: 1.45, z: 0.62, duration: 0.45, ease: 'power2.inOut' })
      .add(() => { if (!talking) setFace('smile'); });
  }
  function talk(on) { talking = on; flap = 0; if (!on) setFace('smile'); else lookAtVisitor(); }

  return { pickMeshes, chatMode, talk, show, hide, sitDown, update, think, reachFor, letGo, pressClock, react, lose, offerHand, releaseHand, watchVisitor };
}
