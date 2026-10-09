// Cartoon Hirantha, the opponent in "Play for them". Built from simple shapes plus a face drawn
// on a canvas, so there is nothing to download. Loaded with import() only when a game starts.
// He sits on White's side of the board in front of the café kiosk, with stretchy cartoon arms
// that reach across the board, move his pieces and press his side of the clock.
import * as THREE from 'three';
import gsap from 'gsap';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cnv, tex } from './canvas.js';

const V3 = THREE.Vector3, UP = new V3(0, 1, 0);
const SKIN = 0xa4704f, HAIR = 0x17100d, SHIRT = 0xd8d4de;

// The face: eyes, brows, nose, closed smile, thin moustache and chin goatee.
function drawFace() {
  const [c, x] = cnv(512, 416);
  const ink = '#1b120e';
  x.lineCap = 'round'; x.lineJoin = 'round';
  // light stubble along the jaw and a little warmth on the cheeks
  const jaw = x.createRadialGradient(256, 330, 30, 256, 330, 150);
  jaw.addColorStop(0, 'rgba(40,24,16,.0)'); jaw.addColorStop(0.55, 'rgba(40,24,16,.13)'); jaw.addColorStop(1, 'rgba(40,24,16,0)');
  x.fillStyle = jaw; x.beginPath(); x.ellipse(256, 330, 150, 90, 0, 0, 7); x.fill(); // fades out before its edge
  [[150, 262], [362, 262]].forEach(([cx, cy]) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, 46); g.addColorStop(0, 'rgba(200,90,70,.18)'); g.addColorStop(1, 'rgba(200,90,70,0)');
    x.fillStyle = g; x.fillRect(cx - 46, cy - 46, 92, 92);
  });
  // eyes: almond whites, dark brown iris, heavy upper lid, a relaxed lower lid (smiling eyes)
  [[178, 1], [334, -1]].forEach(([cx, s]) => {
    const cy = 196;
    x.save();
    x.beginPath(); x.moveTo(cx - 40, cy + 2); x.quadraticCurveTo(cx, cy - 30, cx + 40, cy + 2); x.quadraticCurveTo(cx, cy + 20, cx - 40, cy + 2); x.closePath();
    x.fillStyle = '#f4ece6'; x.fill(); x.clip();
    x.fillStyle = '#3a2216'; x.beginPath(); x.arc(cx + s * 2, cy - 2, 19, 0, 7); x.fill();
    x.fillStyle = '#120a07'; x.beginPath(); x.arc(cx + s * 2, cy - 2, 10, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + s * 2 - 7, cy - 9, 5, 0, 7); x.fill();
    x.restore();
    x.strokeStyle = ink; x.lineWidth = 7;
    x.beginPath(); x.moveTo(cx - 44, cy + 4); x.quadraticCurveTo(cx, cy - 32, cx + 44, cy + 2); x.stroke();
    x.strokeStyle = 'rgba(60,32,22,.55)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(cx - 34, cy + 12); x.quadraticCurveTo(cx, cy + 24, cx + 34, cy + 11); x.stroke();
    // brows: thick and fairly straight
    x.strokeStyle = ink; x.lineWidth = 13;
    x.beginPath(); x.moveTo(cx - 46 * s, cy - 44); x.quadraticCurveTo(cx, cy - 58, cx + 46 * s, cy - 52 + s * 0); x.stroke();
  });
  // nose
  x.strokeStyle = 'rgba(80,42,26,.65)'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(250, 214); x.quadraticCurveTo(244, 258, 232, 270); x.quadraticCurveTo(256, 282, 280, 270); x.stroke();
  // thin moustache
  x.fillStyle = 'rgba(24,14,9,.9)';
  x.beginPath(); x.moveTo(256, 294); x.quadraticCurveTo(222, 290, 196, 310); x.quadraticCurveTo(224, 300, 256, 302); x.quadraticCurveTo(288, 300, 316, 310); x.quadraticCurveTo(290, 290, 256, 294); x.fill();
  // closed, slightly lopsided smile with lifted corners
  x.strokeStyle = '#5a2a22'; x.lineWidth = 7;
  x.beginPath(); x.moveTo(200, 314); x.quadraticCurveTo(250, 356, 316, 308); x.stroke();
  x.lineWidth = 4;
  x.beginPath(); x.moveTo(196, 306); x.quadraticCurveTo(198, 314, 204, 318); x.stroke();
  x.beginPath(); x.moveTo(320, 300); x.quadraticCurveTo(318, 310, 312, 313); x.stroke();
  // soul patch and chin goatee
  x.fillStyle = 'rgba(24,14,9,.75)';
  x.beginPath(); x.ellipse(256, 352, 9, 10, 0, 0, 7); x.fill();
  x.fillStyle = 'rgba(24,14,9,.85)';
  x.beginPath(); x.moveTo(214, 370); x.quadraticCurveTo(256, 360, 298, 370); x.quadraticCurveTo(292, 404, 256, 412); x.quadraticCurveTo(220, 404, 214, 370); x.fill();
  return c;
}

// Tiny dots on the white shirt.
function shirtTexture() {
  const [c, x] = cnv(64, 64);
  x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#5c6688';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(8 + i * 16 + (j % 2) * 8, 8 + j * 16, 1.6, 0, 7); x.fill(); }
  const t = tex(c, 6); return t;
}

export function createAvatar({ scene, position }) {
  const root = new THREE.Group(); root.position.copy(position); root.visible = false; scene.add(root);
  const SIZE = 1.15; // a touch larger than life so he reads clearly from the visitor's seat
  // A little self-light on skin and face keeps him readable with the kiosk lights behind him,
  // without adding a real light (which would cost every pixel in the scene).
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6, emissive: SKIN, emissiveIntensity: 0.32 });
  const hairMat = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.5 });
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRT, map: shirtTexture(), roughness: 0.75 });
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };

  // body (seated: hips are hidden under the table)
  const torso = new THREE.Group(); root.add(torso);
  const chest = mesh(new THREE.CapsuleGeometry(0.31, 0.5, 6, 16), shirt, torso, 0, 1.36, 0); chest.scale.set(1.12, 1, 0.74);
  mesh(new THREE.CylinderGeometry(0.13, 0.135, 0.09, 20, 1, true), shirt, torso, 0, 1.86, 0); // band collar
  mesh(new THREE.BoxGeometry(0.035, 0.5, 0.02), new THREE.MeshStandardMaterial({ color: 0xc4c0cc, roughness: 0.7 }), torso, 0.02, 1.52, 0.235); // placket
  mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.16, 14), skin, torso, 0, 1.88, 0); // neck

  // head
  const head = new THREE.Group(); head.position.set(0, 2.17, 0.02); torso.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.33, 32, 24), skin, head); skull.scale.set(0.92, 1.06, 0.95);
  const faceTex = tex(drawFace());
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(0.334, 32, 24, Math.PI / 2 - 0.95, 1.9, 0.75, 1.55),
    new THREE.MeshStandardMaterial({ map: faceTex, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 0.3, transparent: true, roughness: 0.6, depthWrite: false }),
  );
  skull.add(face);
  {
    const ears = mergeGeometries([-1, 1].map((s) => new THREE.SphereGeometry(0.07, 12, 10).scale(0.55, 1, 0.8).translate(s * 0.3, -0.01, -0.01)));
    mesh(ears, skin, head);
    // hair: short on the sides and back, with a high forehead and a big quiff swept up and back.
    // The cap is tilted back so the hairline sits high, like in the photo.
    const parts = [];
    parts.push(new THREE.SphereGeometry(0.352, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.4).scale(0.95, 1.05, 1).rotateX(-0.42).translate(0, 0.01, -0.03));
    parts.push(new THREE.SphereGeometry(0.346, 24, 16, Math.PI, Math.PI, 0.35, 1.3).scale(0.95, 1.05, 1).translate(0, 0, -0.02));
    // the quiff: soft overlapping volumes rising from the front hairline, leaning back and a little to his left
    [[-0.12, 0.26, 0.1, 0.13, 0.5], [0.0, 0.3, 0.12, 0.15, 0.42], [0.12, 0.28, 0.08, 0.13, 0.5], [-0.05, 0.33, 0.0, 0.14, 0.7], [0.08, 0.34, -0.04, 0.13, 0.75]]
      .forEach(([x, y, z, r, tilt]) => parts.push(new THREE.SphereGeometry(r, 16, 12).scale(0.95, 0.75, 1.25).rotateX(-tilt).rotateZ(-0.12).translate(x, y, z)));
    // a few short tufts on top so it reads as styled hair, not a helmet
    [[-0.1, 0.4, 0.06, 0.2], [0.02, 0.43, 0.04, -0.05], [0.13, 0.4, 0.02, -0.3], [-0.03, 0.42, -0.06, 0.1]].forEach(([x, y, z, rz]) => {
      parts.push(new THREE.ConeGeometry(0.055, 0.15, 7).translate(0, 0.075, 0).rotateX(-0.85).rotateZ(rz - 0.15).translate(x, y, z));
    });
    mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))), hairMat, head);
  }

  // stretchy arms: a short sleeve from the shoulder, then a forearm that stretches to the hand
  const arms = [-1, 1].map((s) => {
    const shoulder = new V3(s * 0.38, 1.66, 0);
    const sleeve = mesh(new THREE.CylinderGeometry(0.1, 0.09, 1, 14), shirt, root);
    const fore = mesh(new THREE.CylinderGeometry(0.065, 0.06, 1, 12), skin, root);
    const hand = mesh(new THREE.SphereGeometry(0.085, 16, 12), skin, root); hand.scale.set(1, 0.85, 1.15);
    const rest = new V3(s * 0.42, 1.0, 0.5);
    hand.position.copy(rest);
    return { s, shoulder, sleeve, fore, hand, rest, follow: null, offset: new V3() };
  });
  const [rightArm, leftArm] = arms; // his right is -x (he faces +z, towards the visitor)
  // his watch, on the left wrist as in the photo
  const watch = mesh(new THREE.TorusGeometry(0.068, 0.022, 8, 20), new THREE.MeshStandardMaterial({ color: 0x2a2630, metalness: 0.6, roughness: 0.3 }), leftArm.hand, 0, 0, -0.07);

  const tmp = new V3(), dir = new V3(), q = new THREE.Quaternion();
  function stretch(m, a, b) {
    dir.subVectors(b, a); const len = Math.max(dir.length(), 0.001);
    m.position.copy(a).addScaledVector(dir, 0.5); m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
  }
  const toLocal = (world) => root.worldToLocal(world.clone());

  /* ---------- behaviour ---------- */
  let look = new V3(0, 1.1, 2.6), lookT = look.clone(), t = 0, mood = 'idle';
  function update(dt) {
    if (!root.visible) return;
    t += dt;
    for (const a of arms) {
      if (a.follow) { a.follow.getWorldPosition(tmp); a.hand.position.copy(toLocal(tmp)).add(a.offset); }
      const elbow = a.shoulder.clone().lerp(a.hand.position, 0.3).add(new V3(a.s * 0.06, -0.08, 0));
      stretch(a.sleeve, a.shoulder, elbow); stretch(a.fore, elbow, a.hand.position);
    }
    watch.lookAt(leftArm.shoulder.clone().add(root.position));
    // breathing and a slow sway; the head turns towards whatever he is looking at
    torso.position.y = Math.sin(t * 1.6) * 0.012;
    torso.rotation.z = Math.sin(t * 0.5) * 0.02;
    look.lerp(lookT, Math.min(1, dt * 4));
    head.lookAt(tmp.copy(look).add(root.position));
    if (mood === 'think') head.rotation.z += Math.sin(t * 2) * 0.04;
  }

  // Head targets are in his local space (+z is towards the visitor).
  const lookAtWorld = (w) => lookT.copy(toLocal(w));
  const lookAtBoard = () => lookT.set(0, 1.1, 1.6);
  const lookAtVisitor = () => lookT.set(0, 2.2, 6);

  function show() {
    root.visible = true; mood = 'idle'; lookAtVisitor();
    arms.forEach((a) => { a.follow = null; a.hand.position.copy(a.rest); });
    root.scale.setScalar(0.001);
    gsap.to(root.scale, { x: SIZE, y: SIZE, z: SIZE, duration: 0.7, delay: 0.5, ease: 'back.out(1.6)' });
  }
  function hide() {
    gsap.killTweensOf(root.scale); gsap.killTweensOf(root.rotation);
    gsap.to(root.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3, onComplete: () => { root.visible = false; root.rotation.set(0, 0, 0); } });
  }
  // Hand on chin while he "thinks" about his move.
  function think() {
    mood = 'think'; lookAtBoard();
    gsap.to(rightArm.hand.position, { x: -0.12, y: 1.98, z: 0.3, duration: 0.4, ease: 'power2.out' });
  }
  // Reach for a piece, then carry it: the hand follows the piece while the game animates it.
  function reachFor(obj, done) {
    mood = 'idle';
    obj.getWorldPosition(tmp); lookAtWorld(tmp);
    const p = toLocal(tmp).add(new V3(0, 0.42, 0));
    gsap.to(rightArm.hand.position, {
      x: p.x, y: p.y, z: p.z, duration: 0.45, ease: 'power2.inOut',
      onComplete: () => { rightArm.follow = obj; rightArm.offset.set(0, 0.42, 0); done(); },
    });
  }
  function letGo(done) {
    rightArm.follow = null;
    gsap.to(rightArm.hand.position, { x: rightArm.rest.x, y: rightArm.rest.y, z: rightArm.rest.z, duration: 0.4, ease: 'power2.inOut' });
    setTimeout(done, 220);
  }
  // Press his clock button with the left hand (the clock is on his left).
  function pressClock(button, press) {
    button.getWorldPosition(tmp); lookAtWorld(tmp);
    const p = toLocal(tmp);
    gsap.timeline({ onComplete: lookAtVisitor })
      .to(leftArm.hand.position, { x: p.x, y: p.y + 0.18, z: p.z, duration: 0.4, ease: 'power2.inOut' })
      .to(leftArm.hand.position, { y: p.y + 0.07, duration: 0.07, onComplete: press })
      .to(leftArm.hand.position, { y: p.y + 0.2, duration: 0.12 })
      .to(leftArm.hand.position, { x: leftArm.rest.x, y: leftArm.rest.y, z: leftArm.rest.z, duration: 0.4, ease: 'power2.inOut' });
  }
  // Checkmate: he slumps, puts his hands up, then gives the visitor a nod.
  function lose() {
    mood = 'idle'; lookAtBoard();
    gsap.timeline()
      .to(root.rotation, { x: 0.12, duration: 0.5, ease: 'power2.out' })
      .add(() => { lookAtVisitor(); })
      .to(root.rotation, { x: -0.05, duration: 0.5 }, '+=0.4')
      .to(rightArm.hand.position, { x: -0.55, y: 2.25, z: 0.25, duration: 0.45, ease: 'back.out(2)' }, '<')
      .to(leftArm.hand.position, { x: 0.55, y: 2.25, z: 0.25, duration: 0.45, ease: 'back.out(2)' }, '<')
      .to(rightArm.hand.position, { x: rightArm.rest.x, y: rightArm.rest.y, z: rightArm.rest.z, duration: 0.6 }, '+=1.2')
      .to(leftArm.hand.position, { x: leftArm.rest.x, y: leftArm.rest.y, z: leftArm.rest.z, duration: 0.6 }, '<')
      .to(root.rotation, { x: 0, duration: 0.4 }, '<')
      .to(head.position, { y: 2.12, duration: 0.18, yoyo: true, repeat: 3 });
  }
  function watchVisitor() { mood = 'idle'; lookAtBoard(); }

  return { show, hide, update, think, reachFor, letGo, pressClock, lose, watchVisitor };
}
