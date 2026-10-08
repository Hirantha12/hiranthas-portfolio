// Helpers for drawing textures (signs, labels, the board, the scoresheet) on 2D canvases.
import * as THREE from 'three';

let maxAniso = 1;
export function setMaxAnisotropy(n) { maxAniso = n; }

export function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function tex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = maxAniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}

export function rrect(x, X, Y, W, H, R) {
  x.beginPath();
  x.moveTo(X + R, Y); x.lineTo(X + W - R, Y); x.quadraticCurveTo(X + W, Y, X + W, Y + R);
  x.lineTo(X + W, Y + H - R); x.quadraticCurveTo(X + W, Y + H, X + W - R, Y + H);
  x.lineTo(X + R, Y + H); x.quadraticCurveTo(X, Y + H, X, Y + H - R);
  x.lineTo(X, Y + R); x.quadraticCurveTo(X, Y, X + R, Y);
  x.closePath();
}

// Shrinks the font until the text fits maxW.
export function fitFont(x, text, weight, family, size, maxW) {
  let s = size;
  do { x.font = `${weight} ${s}px ${family}`; s -= 2; } while (x.measureText(text).width > maxW && s > 10);
}

// Neon-style text: coloured glow plus a pale core.
export function neon(x, text, X, Y, color, blur) {
  x.shadowColor = color; x.fillStyle = color;
  x.shadowBlur = blur; x.fillText(text, X, Y);
  x.shadowBlur = blur / 3; x.fillText(text, X, Y);
  x.shadowBlur = 0; x.globalAlpha = 0.45; x.fillStyle = '#fff'; x.fillText(text, X, Y);
  x.globalAlpha = 1;
}
