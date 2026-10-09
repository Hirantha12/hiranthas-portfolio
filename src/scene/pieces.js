// Procedural chess pieces: LatheGeometry profiles, plus an extruded head for the knight.
// Later you can swap these for Blender models loaded with GLTFLoader.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Height of each piece at scale 1 (used to place labels and frame the camera).
export const HEIGHT = { king: 1.06, queen: 0.98, bishop: 0.92, rook: 0.8, pawn: 0.74, knight: 0.9 };

const BASE = [[0, 0], [0.4, 0], [0.4, 0.05], [0.36, 0.08], [0.36, 0.11], [0.3, 0.14], [0.26, 0.17]];
const PROFILES = {
  king:   [...BASE, [0.2, 0.3], [0.15, 0.5], [0.13, 0.62], [0.22, 0.65], [0.22, 0.68], [0.15, 0.7], [0.18, 0.78], [0.23, 0.86], [0.21, 0.88], [0.1, 0.88], [0, 0.89]],
  queen:  [...BASE, [0.2, 0.3], [0.14, 0.5], [0.12, 0.6], [0.21, 0.63], [0.21, 0.66], [0.13, 0.68], [0.17, 0.76], [0.25, 0.86], [0.23, 0.87], [0.12, 0.84], [0, 0.84]],
  bishop: [...BASE, [0.19, 0.28], [0.12, 0.45], [0.11, 0.52], [0.19, 0.55], [0.19, 0.58], [0.1, 0.6], [0.14, 0.65], [0.16, 0.71], [0.13, 0.78], [0.07, 0.82], [0, 0.84]],
  rook:   [...BASE, [0.27, 0.2], [0.24, 0.3], [0.21, 0.55], [0.25, 0.58], [0.28, 0.62], [0.28, 0.72], [0.2, 0.72], [0.2, 0.68], [0, 0.68]],
  pawn:   [...BASE, [0.21, 0.24], [0.13, 0.38], [0.11, 0.44], [0.18, 0.46], [0.18, 0.49], [0.1, 0.51], [0, 0.52]],
  knight: [...BASE, [0.27, 0.2], [0.25, 0.24], [0, 0.25]],
};

const templates = {};

// Each piece is built from several parts (a queen has 10), then merged into one geometry
// so the GPU draws it in a single call. The shape is identical to drawing the parts separately.
function buildTemplate(type) {
  const parts = [];
  const add = (geo, x = 0, y = 0, z = 0, ry = 0) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    const g = geo.index ? geo.toNonIndexed() : geo; // parts must all be non-indexed to merge
    g.applyMatrix4(m); g.clearGroups(); parts.push(g);
  };
  add(new THREE.LatheGeometry(PROFILES[type].map(([r, y]) => new THREE.Vector2(r, y)), 40));

  if (type === 'king') { add(new THREE.BoxGeometry(0.05, 0.17, 0.05), 0, 0.965); add(new THREE.BoxGeometry(0.15, 0.05, 0.05), 0, 0.99); }
  if (type === 'queen') {
    add(new THREE.SphereGeometry(0.065, 20, 14), 0, 0.91);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; add(new THREE.SphereGeometry(0.036, 12, 10), Math.cos(a) * 0.235, 0.875, Math.sin(a) * 0.235); }
  }
  if (type === 'bishop') add(new THREE.SphereGeometry(0.045, 16, 12), 0, 0.875);
  if (type === 'pawn') add(new THREE.SphereGeometry(0.125, 24, 18), 0, 0.615);
  if (type === 'rook') {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(new THREE.BoxGeometry(0.1, 0.08, 0.09), Math.cos(a) * 0.24, 0.76, Math.sin(a) * 0.24, -a); }
  }
  if (type === 'knight') {
    const s = new THREE.Shape();
    s.moveTo(-0.2, 0.24); s.lineTo(0.18, 0.24);
    s.quadraticCurveTo(0.2, 0.34, 0.1, 0.44);
    s.quadraticCurveTo(0.22, 0.46, 0.3, 0.52);
    s.quadraticCurveTo(0.34, 0.58, 0.27, 0.63);
    s.quadraticCurveTo(0.16, 0.7, 0.1, 0.76);
    s.lineTo(0.08, 0.86); s.lineTo(0, 0.79);
    s.quadraticCurveTo(-0.16, 0.76, -0.22, 0.58);
    s.quadraticCurveTo(-0.26, 0.4, -0.2, 0.24);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 3, curveSegments: 12 });
    geo.translate(-0.03, 0, -0.08);
    add(geo);
  }
  return mergeGeometries(parts);
}

// Returns a new piece group that shares geometry with every other piece of the same type.
export function makePiece(type, material) {
  const geo = templates[type] || (templates[type] = buildTemplate(type));
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true; m.receiveShadow = true;
  const p = new THREE.Group(); p.add(m);
  return p;
}
