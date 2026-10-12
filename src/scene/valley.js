// The sunny-day mood: a green mountain valley around the chess plaza. Sky with a low sun and
// drifting clouds, snowy mountains, rolling hills, pines and leafy trees, rocks, a stream that
// winds past behind the kiosk, wildflowers and grass that sway in the breeze, flocks of birds
// and a few butterflies. This file is only downloaded when a visitor picks the sunny mood.
//
// Low-poly and flat-shaded on purpose (like an illustration), and drawn with instancing, so the
// whole valley is about 14 draw calls. The layout is seeded, so it looks the same every visit.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cnv, tex } from './canvas.js';

const V3 = THREE.Vector3;
export const SKY = { top: 0x2b7fd8, horizon: 0xaed8f3, grass: 0x82b44c };
// Where the sun is drawn: low in the sky behind the plaza, a little left, in a dip between two
// mountains, so it shines in the main view (like the sun setting into a valley).
const SUN_DIR = new V3(-0.3, 0.085, -1).normalize();
const SUN_AZ = Math.atan2(SUN_DIR.z, SUN_DIR.x);

// Seeded random numbers (same valley on every visit).
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
// A stable "random" offset for a point, so jittered low-poly shapes don't crack at shared corners.
function hash3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }

// Gives every vertex of a geometry one colour (and, optionally, one value of an extra attribute).
function paint(geo, hex, extra) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (extra) g.setAttribute(extra.name, new THREE.BufferAttribute(new Float32Array(n).fill(extra.value), 1));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}
// Nudges vertices by a stable random amount: rough, hand-made looking shapes.
function jitter(geo, amt, seed = 0) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = (o) => (hash3(x * 3.1 + seed, y * 3.1 + o, z * 3.1) - 0.5) * 2 * amt;
    p.setXYZ(i, x + k(1), y + k(2) * 0.6, z + k(3));
  }
  geo.computeVertexNormals();
  return geo;
}

// Breeze: bends instanced plants and trees a little, more at the top than at the root.
function sway(mat, time, amp, speed) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uTime;\nvoid main() {').replace('#include <begin_vertex>', `#include <begin_vertex>
  vec2 ip = instanceMatrix[3].xz;
  float sw = sin(uTime * ${speed.toFixed(2)} + ip.x * 0.35 + ip.y * 0.27) + 0.45 * sin(uTime * ${(speed * 2.3).toFixed(2)} + ip.x * 0.9);
  float bend = max(position.y, 0.0) * max(position.y, 0.0) * ${amp.toFixed(4)};
  transformed.x += sw * bend; transformed.z += sw * bend * 0.6;`);
  };
  return mat;
}

export function buildValley({ touch }) {
  const R = rng(20261012);
  const rand = (a, b) => a + R() * (b - a);
  const group = new THREE.Group(); group.name = 'valley'; group.visible = false;
  const time = { value: 0 };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V3(), pos = new V3(), col = new THREE.Color();
  const n = (desk, phone) => (touch ? phone : desk);

  /* ---------- the stream: from the mountains, behind the kiosk, then round the right side ---------- */
  const curve = new THREE.CatmullRomCurve3([
    [-175, -205], [-120, -150], [-68, -96], [-30, -66], [14, -58], [46, -44], [64, -14], [64, 22], [50, 58], [46, 110], [62, 175], [70, 260],
  ].map(([x, z]) => new V3(x, 0, z)), false, 'catmullrom', 0.5);
  const streamPts = curve.getSpacedPoints(160);
  const widthAt = (s) => 3.2 + s * 3.6;
  const streamDist = (x, z) => {
    let best = 1e9, bi = 0;
    for (let i = 0; i < streamPts.length; i++) { const d = (streamPts[i].x - x) ** 2 + (streamPts[i].z - z) ** 2; if (d < best) { best = d; bi = i; } }
    return Math.sqrt(best) - widthAt(bi / (streamPts.length - 1)) / 2;
  };
  // Free ground for scenery: away from the plaza (r) and from the water (gap).
  const free = (x, z, r, gap) => Math.hypot(x, z) > r && streamDist(x, z) > gap;
  // A clearing behind the kiosk, so the King (About me), the stream and the mountains stay in view.
  const clearing = (x, z) => z < -18 && z > -95 && Math.abs(x) < 16 + (-z - 18) * 0.35;

  /* ---------- sky dome (follows the camera) ---------- */
  const skyU = {
    uTop: { value: new THREE.Color(SKY.top) }, uHor: { value: new THREE.Color(SKY.horizon) },
    uNight: { value: new THREE.Color(0x07060c) }, uSunDir: { value: SUN_DIR }, uDay: { value: 0 },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(330, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: 'varying vec3 vDir;\nvoid main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uTop, uHor, uNight, uSunDir; uniform float uDay; varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 c = mix(uHor, uTop, 1.0 - exp(-h * 6.5)); // deep blue overhead, pale only near the horizon
  float s = max(dot(d, uSunDir), 0.0);
  c += vec3(1.0, 0.8, 0.45) * (pow(s, 14.0) * 0.16 + pow(s, 140.0) * 0.5); // warm glow round the sun
  c = mix(c, vec3(1.0, 0.97, 0.86), smoothstep(0.99935, 0.99960, s));    // the sun itself
  gl_FragColor = vec4(mix(uNight, c, uDay), 1.0);
}`,
  }));
  sky.renderOrder = -100; sky.frustumCulled = false; sky.visible = false; // added to the scene by mood.js

  /* ---------- ground beyond the plaza floor (the floor itself fades to the same grass) ---------- */
  const groundMat = new THREE.MeshStandardMaterial({ color: SKY.grass, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.RingGeometry(68.5, 430, 96, 1), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; group.add(ground);

  /* ---------- water ---------- */
  {
    const [c, x] = cnv(128, 256);
    x.fillStyle = '#d2d2d2'; x.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 70; i++) { // ripples catching the light
      x.strokeStyle = `rgba(255,255,255,${0.35 + R() * 0.5})`; x.lineWidth = 1 + R() * 2;
      const X = R() * 128, Y = R() * 256, L = 8 + R() * 22;
      x.beginPath(); x.moveTo(X, Y); x.quadraticCurveTo(X + 4, Y + L / 2, X, Y + L); x.stroke();
    }
    const waterTex = tex(c); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
    const ribbon = (extra, y) => {
      const P = [], UV = [], I = [], N = streamPts.length;
      let len = 0;
      for (let i = 0; i < N; i++) {
        const p = streamPts[i], t = curve.getTangentAt(i / (N - 1)), side = new V3(-t.z, 0, t.x).normalize();
        const w = widthAt(i / (N - 1)) / 2 + extra * (0.8 + 0.4 * Math.sin(i * 0.7));
        if (i) len += p.distanceTo(streamPts[i - 1]);
        P.push(p.x + side.x * w, y, p.z + side.z * w, p.x - side.x * w, y, p.z - side.z * w);
        UV.push(0, len / 7, 1, len / 7);
        if (i) { const a = (i - 1) * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
      g.setIndex(I); g.computeVertexNormals();
      return g;
    };
    const bank = new THREE.Mesh(ribbon(1.3, 0.035), new THREE.MeshStandardMaterial({ color: 0x6aa244, roughness: 1 }));
    const water = new THREE.Mesh(ribbon(0, 0.07), new THREE.MeshStandardMaterial({ color: 0x55b8e0, map: waterTex, roughness: 0.25, metalness: 0.05, emissive: 0x0d4a66, emissiveIntensity: 0.35 }));
    bank.receiveShadow = water.receiveShadow = true;
    group.add(bank, water);
    var flowTex = waterTex; // eslint-disable-line no-var
  }

  /* ---------- mountains: a ring of snowy, faceted peaks ---------- */
  {
    const parts = [];
    const count = n(30, 22);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand(-0.08, 0.08), r = rand(195, 255);
      let da = Math.abs(a - SUN_AZ) % (Math.PI * 2); if (da > Math.PI) da = Math.PI * 2 - da;
      const dip = 0.42 + 0.58 * THREE.MathUtils.smoothstep(da, 0.1, 0.42); // a low pass where the sun sets
      const h = rand(22, 48) * (Math.abs(Math.sin(a * 1.7)) * 0.3 + 0.75) * dip, w = h * rand(1.0, 1.5) / Math.sqrt(dip);
      const g = jitter(new THREE.ConeGeometry(1, 1, n(9, 7), 5).toNonIndexed(), 0.07, i * 13.7);
      const p = g.attributes.position, c = new Float32Array(p.count * 3);
      const rock = new THREE.Color(0x7e8aa6), low = new THREE.Color(0x6e8d63), snow = new THREE.Color(0xf3f6fb);
      for (let k = 0; k < p.count; k++) {
        const y = p.getY(k) + 0.5; // 0 at the foot, 1 at the peak
        const snowLine = 0.62 + (hash3(p.getX(k), y, i) - 0.5) * 0.18;
        col.copy(y < 0.22 ? low.clone().lerp(rock, y / 0.22) : rock).lerp(snow, y > snowLine ? 1 : 0);
        c.set([col.r, col.g, col.b], k * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      g.applyMatrix4(m4.compose(pos.set(Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r), q.setFromEuler(e.set(0, rand(0, 6.3), 0)), sc.set(w, h, w * rand(0.7, 1))));
      parts.push(g);
    }
    const geo = mergeGeometries(parts); parts.forEach((g) => g.dispose());
    group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })));
  }

  /* ---------- rolling hills between the meadow and the mountains ---------- */
  {
    const hills = [];
    for (let tries = 0; hills.length < n(22, 14) && tries < 400; tries++) {
      const a = R() * Math.PI * 2, r = rand(92, 150), x = Math.cos(a) * r, z = Math.sin(a) * r, sx = rand(22, 46);
      if (streamDist(x, z) < sx * 0.85 + 4) continue;
      if (clearing(x, z) && r < 120) continue;
      hills.push([x, z, sx * 1.3, rand(3.5, 8.5), sx * rand(0.7, 1.1)]);
    }
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), hills.length);
    hills.forEach(([x, z, sx, sy, sz], i) => {
      mesh.setMatrixAt(i, m4.compose(pos.set(x, -0.3, z), q.setFromEuler(e.set(0, R() * 6.3, 0)), sc.set(sx, sy, sz)));
      mesh.setColorAt(i, col.setHex([0x7fb653, 0x8cc05a, 0x6fa84a, 0x9cc766][i % 4]));
    });
    group.add(mesh);
  }

  /* ---------- trees ---------- */
  const pineGeo = mergeGeometries([
    paint(new THREE.CylinderGeometry(0.18, 0.26, 1.6, 6).translate(0, 0.8, 0), 0x6b4a2f),
    paint(jitter(new THREE.ConeGeometry(1.7, 2.6, 7).translate(0, 2.5, 0), 0.08, 1), 0x2f6a3b),
    paint(jitter(new THREE.ConeGeometry(1.3, 2.3, 7).translate(0, 3.65, 0), 0.08, 2), 0x377a42),
    paint(jitter(new THREE.ConeGeometry(0.85, 2.0, 7).translate(0, 4.75, 0), 0.06, 3), 0x418c4a),
  ]);
  const blob = (r, x, y, z, s) => jitter(new THREE.IcosahedronGeometry(r, 1), r * 0.12, s).translate(x, y, z);
  const leafyGeo = mergeGeometries([
    paint(new THREE.CylinderGeometry(0.2, 0.3, 2.4, 6).translate(0, 1.2, 0), 0x75522f),
    paint(blob(1.9, 0, 3.7, 0, 4).scale(1, 0.9, 1), 0x5fa83e),
    paint(blob(1.25, 1.05, 3.1, 0.4, 5), 0x6cb747),
    paint(blob(1.15, -0.95, 3.3, -0.5, 6), 0x55993a),
  ]);
  const treeMat = (amp) => sway(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }), time, amp, 0.9);
  function scatter(geo, mat, count, place, shadows) {
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    let k = 0;
    for (let tries = 0; k < count && tries < count * 40; tries++) {
      const t = place(); if (!t) continue;
      mesh.setMatrixAt(k, m4.compose(pos.set(t.x, t.y || 0, t.z), q.setFromEuler(e.set(t.rx || 0, R() * 6.3, t.rz || 0)), sc.set(t.s * (t.sx || 1), t.s * (t.sy || 1), t.s * (t.sx || 1))));
      mesh.setColorAt(k, col.setRGB(...(t.tint || [1, 1, 1])));
      k++;
    }
    mesh.count = k;
    if (shadows) mesh.castShadow = true;
    mesh.computeBoundingSphere(); group.add(mesh);
    return mesh;
  }
  // Trees grow in groves: a few centres, mostly behind and beside the plaza (where you look).
  const groves = Array.from({ length: 16 }, (_, i) => {
    const a = i < 11 ? rand(Math.PI * 1.02, Math.PI * 1.98) : rand(0, Math.PI); // z < 0 is behind the kiosk
    const r = rand(40, 105); return [Math.cos(a) * r, Math.sin(a) * r, rand(8, 20)];
  });
  const treeSpot = () => {
    const [gx, gz, gr] = groves[Math.floor(R() * groves.length)];
    const a = R() * 6.3, d = Math.sqrt(R()) * gr, x = gx + Math.cos(a) * d, z = gz + Math.sin(a) * d;
    return free(x, z, 34, 3) && !clearing(x, z) ? { x, z } : null;
  };
  const tint = (v) => { const k = rand(1 - v, 1 + v); return [k * rand(0.94, 1.04), k, k * rand(0.92, 1.02)]; };
  scatter(pineGeo, treeMat(0.0016), n(130, 70), () => { const t = treeSpot(); return t && { ...t, s: rand(0.9, 2.0), tint: tint(0.12) }; }, true);
  scatter(leafyGeo, treeMat(0.0022), n(50, 28), () => { const t = treeSpot(); return t && { ...t, s: rand(0.8, 1.4), tint: tint(0.1) }; }, true);

  /* ---------- rocks: boulders on the meadow and stones along the stream ---------- */
  const rockGeo = jitter(new THREE.DodecahedronGeometry(1, 0), 0.18, 9);
  scatter(rockGeo, new THREE.MeshStandardMaterial({ color: 0x9fa4aa, flatShading: true, roughness: 0.9 }), n(70, 40), () => {
    if (R() < 0.45) { // by the water
      const i = Math.floor(R() * streamPts.length), p = streamPts[i], side = R() < 0.5 ? -1 : 1, t = curve.getTangentAt(i / (streamPts.length - 1));
      const w = widthAt(i / (streamPts.length - 1)) / 2 + rand(0.2, 1.4);
      const x = p.x - t.z * w * side, z = p.z + t.x * w * side;
      return Math.hypot(x, z) > 40 ? { x, z, y: -0.1, s: rand(0.35, 1.2), sy: 0.6, tint: tint(0.12) } : null;
    }
    const a = R() * 6.3, r = rand(24, 95), x = Math.cos(a) * r, z = Math.sin(a) * r;
    const s = r < 34 ? rand(0.3, 0.8) : rand(0.5, 2.6); // only pebbles where the camera passes
    return free(x, z, 22, 1.5) ? { x, z, y: -0.15 * s, s, sy: rand(0.5, 0.75), tint: tint(0.1) } : null;
  }, true);

  /* ---------- wildflowers ---------- */
  {
    const stem = paint(new THREE.CylinderGeometry(0.012, 0.018, 0.5, 4).translate(0, 0.25, 0), 0x3f7f2c, { name: 'aHead', value: 0 });
    const head = paint(jitter(new THREE.IcosahedronGeometry(0.075, 0), 0.01, 7).translate(0, 0.52, 0), 0xffffff, { name: 'aHead', value: 1 });
    const leaf = paint(new THREE.ConeGeometry(0.05, 0.22, 3).rotateZ(0.9).translate(0.07, 0.16, 0), 0x4a8f33, { name: 'aHead', value: 0 });
    const mat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }), time, 0.35, 1.6);
    const base = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh) => { // the instance colour paints only the flower head
      base(sh);
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute float aHead;\nvoid main() {')
        .replace('#include <color_vertex>', '#include <color_vertex>\n  vColor.rgb = mix(color.rgb, instanceColor.rgb, aHead);');
    };
    const colors = [0xff5fa2, 0xd94f8a, 0xffd23f, 0xfff4e0, 0xb48cff, 0xff7a59, 0xfff4e0, 0xffd23f];
    let clump = null;
    scatter(mergeGeometries([stem, head, leaf]), mat, n(900, 380), () => {
      if (!clump || R() < 0.12) { const a = R() * 6.3, r = rand(18, 80); clump = [Math.cos(a) * r, Math.sin(a) * r, colors[Math.floor(R() * colors.length)]]; }
      const a = R() * 6.3, d = R() * 4, x = clump[0] + Math.cos(a) * d, z = clump[1] + Math.sin(a) * d;
      if (!free(x, z, 18, 0.8)) return null;
      col.setHex(R() < 0.8 ? clump[2] : colors[Math.floor(R() * colors.length)]);
      return { x, z, s: rand(0.8, 1.7), tint: [col.r, col.g, col.b] };
    });
  }

  /* ---------- grass tufts ---------- */
  {
    const P = [], C = [], Nn = [], lo = new THREE.Color(0x5a8f34), hi = new THREE.Color(0x9fca62);
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * Math.PI * 2 + hash3(b, 1, 2), h = 0.32 + hash3(b, 3, 4) * 0.3, lean = 0.12 + hash3(b, 5, 6) * 0.1;
      const cx = Math.cos(a), cz = Math.sin(a), px = -cz * 0.035, pz = cx * 0.035;
      // both faces of the blade, each lit like the ground under it (normal straight up)
      P.push(px, 0, pz, -px, 0, -pz, cx * lean, h, cz * lean, -px, 0, -pz, px, 0, pz, cx * lean, h, cz * lean);
      for (let k = 0; k < 2; k++) { C.push(lo.r, lo.g, lo.b, lo.r, lo.g, lo.b, hi.r, hi.g, hi.b); Nn.push(0, 1, 0, 0, 1, 0, 0, 1, 0); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
    const mat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), time, 0.5, 2.1);
    scatter(g, mat, n(1800, 600), () => {
      const a = R() * 6.3, r = 17 + Math.pow(R(), 1.4) * 75, x = Math.cos(a) * r, z = Math.sin(a) * r;
      return free(x, z, 17, 0.3) ? { x, z, s: rand(0.6, 1.2), tint: tint(0.12) } : null;
    });
  }

  /* ---------- clouds ---------- */
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xe9eef5, emissive: 0x95acc8, emissiveIntensity: 0.28, transparent: true, opacity: 0, fog: false });
  const clouds = new THREE.Group(); group.add(clouds);
  {
    const puffs = [];
    // a cumulus: big puffs piled in the middle, smaller ones round the edges, a softly flattened base
    for (let i = 0; i < 12; i++) {
      const edge = i / 11, r = THREE.MathUtils.lerp(1.25, 0.55, edge) * rand(0.85, 1.1);
      const x = (R() - 0.5) * (1 + edge * 3.4), y = (1 - edge) * rand(0.3, 0.8) + rand(-0.1, 0.2);
      puffs.push(new THREE.IcosahedronGeometry(r, 2).translate(x, y, (R() - 0.5) * (0.6 + edge)));
    }
    const geo = mergeGeometries(puffs); puffs.forEach((g) => g.dispose());
    const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < -0.2) p.setY(i, -0.2 + (y + 0.2) * 0.3); }
    geo.computeVertexNormals();
    const count = n(18, 11), mesh = new THREE.InstancedMesh(geo, cloudMat, count);
    for (let i = 0; i < count; i++) {
      let a = (i / count) * Math.PI * 2 + rand(-0.2, 0.2);
      let da = Math.abs(a - SUN_AZ) % (Math.PI * 2); if (da > Math.PI) da = Math.PI * 2 - da;
      if (da < 0.3) a += (a > SUN_AZ ? 1 : -1) * (0.3 - da) * 1.6; // keep the sun clear
      const r = rand(140, 200), s = rand(6.5, 11);
      mesh.setMatrixAt(i, m4.compose(pos.set(Math.cos(a) * r, rand(30, 56), Math.sin(a) * r), q.setFromEuler(e.set(0, -a + Math.PI / 2, 0)), sc.set(s * rand(1.1, 1.5), s * 0.9, s)));
    }
    mesh.frustumCulled = false; clouds.add(mesh);
  }

  /* ---------- the sun's shine: a soft glare and a few lens rings when you look towards it ---------- */
  const radial = (size, stops) => {
    const [c, x] = cnv(size, size), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, s]) => g.addColorStop(o, s)); x.fillStyle = g; x.fillRect(0, 0, size, size); return tex(c);
  };
  const glare = radial(256, [[0, 'rgba(255,252,240,1)'], [0.12, 'rgba(255,240,200,.85)'], [0.4, 'rgba(255,214,140,.22)'], [1, 'rgba(255,200,120,0)']]);
  // A glowing sprite out at the sun. Depth-tested, so a mountain or tree in front hides it.
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glare, color: 0xfff6e2, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  flare.scale.setScalar(62); flare.renderOrder = 2; group.add(flare);

  /* ---------- birds: small flocks crossing the sky ---------- */
  const birdGeo = new THREE.BufferGeometry();
  {
    // a gull: a slim body and two bent wings (raised at the elbow, swept back at the tip)
    const A = [0, 0, -0.1], B = [0, 0, 0.12], Cc = [0.36, 0.08, -0.05], D = [0.36, 0.08, 0.06], E = [0.84, -0.02, 0.18];
    const m = (v) => [-v[0], v[1], v[2]];
    const tri = [A, B, D, A, D, Cc, Cc, D, E].flat(), triL = [A, D, B, A, Cc, D, Cc, E, D].map(m).flat();
    const body = [0, 0, -0.32, -0.045, 0.01, 0, 0, 0, 0.3, 0, 0, -0.32, 0, 0, 0.3, 0.045, 0.01, 0];
    birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([...tri, ...triL, ...body], 3));
  }
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x38424f, side: THREE.DoubleSide });
  birdMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uTime;\nvoid main() {').replace('#include <begin_vertex>', `#include <begin_vertex>
  float ph = float(gl_InstanceID) * 1.37;
  float glide = smoothstep(-0.35, 0.5, sin(uTime * 0.6 + ph * 0.5)); // flap, then glide
  transformed.y += sin(uTime * 9.0 + ph) * abs(position.x) * 0.7 * glide;`);
  };
  const FLOCKS = n(4, 3), PER = n(7, 5);
  // Gulls circling over the meadow, in front of the hills, where the main view always sees them.
  const GULLS = [[-17, -26, 9, 9.5, 0.23], [-11, -34, 7, 11.5, -0.3], [19, -30, 10, 10.5, 0.2], [24, -44, 8, 13, -0.26], [4, -48, 12, 14, 0.18]].slice(0, n(5, 3));
  const birds = new THREE.InstancedMesh(birdGeo, birdMat, FLOCKS * PER + GULLS.length);
  birds.frustumCulled = false; group.add(birds);
  const flocks = Array.from({ length: FLOCKS }, (_, i) => ({ on: false, t: 0, dur: 1, wait: 2 + i * 6, a: new V3(), b: new V3(), dir: new V3() }));
  const fly = new V3(), side = new V3(), up = new V3(0, 1, 0), look = new THREE.Matrix4();
  function launch(f) {
    // Mostly across the view behind the plaza (where the visitor is looking), sometimes elsewhere.
    const back = Math.random() < 0.7;
    const ang = back ? (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.5 : Math.random() * Math.PI * 2;
    f.dir.set(Math.cos(ang), 0, Math.sin(ang));
    side.set(-f.dir.z, 0, f.dir.x);
    const pass = back ? -(30 + Math.random() * 70) : 25 + Math.random() * 50; // nearest distance to the plaza
    const across = back ? side.set(0, 0, 1) : side;
    const h = back ? 10 + Math.random() * 9 : 14 + Math.random() * 12;
    f.a.copy(across).multiplyScalar(pass).addScaledVector(f.dir, -150).setY(h);
    f.b.copy(across).multiplyScalar(pass).addScaledVector(f.dir, 150).setY(h + (Math.random() - 0.5) * 8);
    f.dur = 300 / (9 + Math.random() * 5); f.t = 0; f.on = true;
    if (onFlock) onFlock();
  }
  let onFlock = null;
  function updateBirds(dt) {
    flocks.forEach((f, fi) => {
      if (!f.on) { f.wait -= dt; if (f.wait <= 0) launch(f); }
      else { f.t += dt / f.dur; if (f.t >= 1) { f.on = false; f.wait = 2 + Math.random() * 7; } }
      for (let k = 0; k < PER; k++) {
        const i = fi * PER + k;
        if (!f.on) { birds.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; }
        const row = Math.ceil(k / 2), sgn = k % 2 ? 1 : -1;
        side.set(-f.dir.z, 0, f.dir.x);
        fly.copy(f.a).lerp(f.b, f.t)
          .addScaledVector(f.dir, -row * 2.2).addScaledVector(side, sgn * row * 1.9)
          .add(pos.set(Math.sin(time.value * 0.9 + i) * 0.6, Math.sin(time.value * 1.3 + i * 2) * 0.5, 0));
        look.lookAt(fly, pos.copy(fly).add(f.dir), up); // the head (-z) points where it flies
        q.setFromRotationMatrix(look);
        birds.setMatrixAt(i, m4.compose(fly, q, sc.setScalar(1.8)));
      }
    });
    GULLS.forEach(([cx, cz, r, h, w], g) => { // slow circles, rising and falling a little
      const a = time.value * w + g * 2.3, i = FLOCKS * PER + g;
      fly.set(cx + Math.cos(a) * r, h + Math.sin(time.value * 0.5 + g) * 1.2, cz + Math.sin(a) * r * 0.6);
      pos.set(-Math.sin(a) * Math.sign(w), 0, Math.cos(a) * 0.6 * Math.sign(w)).normalize(); // heading
      look.lookAt(fly, side.copy(fly).add(pos), up); q.setFromRotationMatrix(look);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), -0.35 * Math.sign(w))); // banked into the turn
      birds.setMatrixAt(i, m4.compose(fly, q, sc.setScalar(1.9)));
    });
    birds.instanceMatrix.needsUpdate = true;
  }

  /* ---------- butterflies around the plaza ---------- */
  const bfly = new THREE.BufferGeometry();
  bfly.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -0.13, 0, -0.1, -0.12, 0, 0.03, 0, 0, 0, -0.12, 0, 0.03, -0.07, 0, 0.12, // left wings
    0, 0, 0, 0.12, 0, 0.03, 0.13, 0, -0.1, 0, 0, 0, 0.07, 0, 0.12, 0.12, 0, 0.03,     // right wings
  ], 3));
  const bflyMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  bflyMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uTime;\nvoid main() {').replace('#include <begin_vertex>', `#include <begin_vertex>
  float fa = sin(uTime * 24.0 + float(gl_InstanceID) * 2.1) * 1.1;
  transformed.y = abs(position.x) * sin(fa); transformed.x = position.x * cos(fa);`);
  };
  const BF = n(8, 5);
  const butterflies = new THREE.InstancedMesh(bfly, bflyMat, BF);
  const bfCol = [0xff9a3c, 0xffe14d, 0xffffff, 0x6fc3ff, 0xff7ab8, 0xffe14d, 0xff9a3c, 0xb592ff];
  // Each flutters round its own spot: in front of the plaza, by the flowers, one beside the board.
  const bfSpots = [[-3.6, 1.2, 1.4], [-8, 6, 3], [8, 7, 3], [-13, -2, 3.5], [13, 0, 3.5], [3, 11, 4], [-4, 13, 3], [10, -9, 4]];
  const bfState = bfSpots.slice(0, BF).map(([x, z, r], i) => ({ x, z, r, p: i * 1.9, prev: new V3() }));
  bfState.forEach((b, i) => butterflies.setColorAt(i, col.setHex(bfCol[i])));
  butterflies.frustumCulled = false; group.add(butterflies);
  const bp = new V3(), bv = new V3();
  function updateButterflies() {
    const t = time.value;
    bfState.forEach((b, i) => {
      bp.set(b.x + Math.sin(t * 0.37 + b.p) * b.r + Math.sin(t * 1.3 + b.p * 2) * 0.5,
        0.9 + Math.sin(t * 0.8 + b.p) * 0.45 + Math.abs(Math.sin(t * 3.1 + b.p)) * 0.25,
        b.z + Math.sin(t * 0.29 + b.p * 1.7) * b.r * 0.7 + Math.cos(t * 1.1 + b.p) * 0.5);
      bv.subVectors(bp, b.prev); b.prev.copy(bp);
      e.set(0, Math.atan2(bv.x, bv.z) + Math.PI, 0); q.setFromEuler(e);
      butterflies.setMatrixAt(i, m4.compose(bp, q, sc.setScalar(1.5)));
    });
    butterflies.instanceMatrix.needsUpdate = true;
  }

  return {
    group, sky,
    // t: 0 night … 1 day. The sky blends in from the start; the scenery appears halfway, while
    // the passing mist (see mood.js) hides the distance, and the clouds fade in after it.
    setDay(t) {
      skyU.uDay.value = t;
      sky.visible = t > 0.001;
      cloudMat.opacity = THREE.MathUtils.smoothstep(t, 0.5, 1);
      group.visible = t >= 0.5;
    },
    set onFlock(fn) { onFlock = fn; },
    update(dt, camera) {
      if (sky.visible) sky.position.copy(camera.position);
      if (!group.visible) return;
      flare.position.copy(camera.position).addScaledVector(SUN_DIR, 300);
      time.value += dt;
      clouds.rotation.y += dt * 0.004;
      flowTex.offset.y -= dt * 0.32;
      updateBirds(dt);
      updateButterflies();
    },
  };
}
