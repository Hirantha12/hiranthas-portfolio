import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import gsap from 'gsap';

import './style.css';
import { SECTIONS, PROJECTS, GLYPH } from './data/content.js';
import { Snd } from './audio/sound.js';
import { setMaxAnisotropy } from './scene/canvas.js';
import { buildWorld, P } from './scene/world.js';
import { createPanel } from './ui/panel.js';

// Colour setup: this matches the look of the original r128 prototype (linear, no colour
// conversion). When you move to baked Blender textures, switch to the modern pipeline:
// ColorManagement on, renderer.outputColorSpace = SRGBColorSpace, texture.colorSpace = SRGBColorSpace.
THREE.ColorManagement.enabled = false;
if (import.meta.env.DEV) window.gsap = gsap; // handy for debugging in the console

const $ = (s) => document.querySelector(s);
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(pointer: coarse)').matches;
const V3 = THREE.Vector3, UP = new V3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const I = (v) => v * Math.PI; // light units, see world.js
const stLoad = $('#stLoad');

const fontsReady = Promise.race([
  Promise.all(['400 64px Monoton', '700 64px "Chakra Petch"', '600 26px "JetBrains Mono"', '400 15px "JetBrains Mono"'].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 3500)),
]).catch(() => {});

fontsReady.then(start);

function start() {
  const canvas = $('#c');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { stLoad.textContent = 'WebGL is not available in this browser, so the 3D board cannot load. Use Quick view instead.'; return; }

  const DPR = Math.min(window.devicePixelRatio || 1, TOUCH ? 1.5 : 1.75);
  renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = !TOUCH;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060c);
  scene.fog = new THREE.FogExp2(0x0b0815, 0.026);
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 260);

  /* ---------- bloom ---------- */
  let composer = null;
  try {
    const rt = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.UnsignedByteType, samples: TOUCH ? 0 : 4 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(DPR);
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.5, 0.72));
  } catch (e) { composer = null; }

  const W = buildWorld(scene, { touch: TOUCH, reduce: REDUCE });
  if (import.meta.env.DEV) window.__dbg = { scene, camera, renderer, get composer() { return composer; }, set composer(v) { composer = v; }, W };
  const { giants, giantMeshes, sqPos, decor, projPieces, projMeshes, hl, sheet, sheetMeshes, signMat, signLight, flash, PIECE_SCALE } = W;

  /* =========================================================
     CAMERA + VIEWS
     ========================================================= */
  const cam = { px: 0, py: 28, pz: 46, tx: 0, ty: 0, tz: -2 };
  let yaw = 0, yawTarget = 0, yawVel = 0, pitch = 0, pitchTarget = 0, zoom = 1, zoomTarget = 1;
  const sph = new THREE.Spherical();
  const par = { x: 0, y: 0 }, mouse = { x: 0, y: 0 };
  // Narrow screens (phones, half-width windows): widen the lens up to 58° first, then pull the
  // camera back by at most 1.6x. Thin the fog and enlarge the labels to match, so the plaza
  // stays bright and readable instead of shrinking into the fog.
  const BASE_HALF_W = Math.tan(THREE.MathUtils.degToRad(20)) * 1.78; // the desktop's horizontal view
  for (const key in giants) giants[key].baseLw = giants[key].lw;
  let K = 1;
  function applyLens() {
    const a = innerWidth / innerHeight;
    const fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(BASE_HALF_W / a)), 40, 58);
    K = clamp(BASE_HALF_W / (Math.tan(THREE.MathUtils.degToRad(fov / 2)) * a), 1, 1.6);
    camera.fov = fov; camera.aspect = a; camera.updateProjectionMatrix();
    scene.fog.density = 0.026 / Math.pow(K, 1.4);
    const ls = (1 + (K - 1) * 0.9) * (innerWidth < 700 ? 1.15 : 1);
    for (const key in giants) { const g = giants[key]; g.lw = g.baseLw * ls; g.label.scale.set(g.lw, (g.lw * 200) / 640, 1); }
  }
  const hintText = () => (innerWidth < 700
    ? (TOUCH ? 'Tap a piece · drag to orbit' : 'Click a piece · drag to orbit')
    : (TOUCH ? 'Tap a giant piece · drag to orbit 360°' : 'Click a giant piece · drag to orbit 360° · scroll to zoom · double-click to reset'));
  const portraitK = () => K;
  applyLens();
  const isDesktop = () => innerWidth > 860;

  function homeView() { const k = portraitK(); return { pos: new V3(0, 6.4 + (k - 1) * 1.5, 17.5 * k), tgt: new V3(0, 2.1 - (k - 1) * 0.8, -1.5) }; }
  function sectionView(key) {
    const k = Math.min(portraitK(), 2.2);
    if (key === 'projects') { const t = new V3(0, 1.1, 0.45); return { pos: t.clone().add(new V3(0, 4.4, 5.4).multiplyScalar(k)), tgt: t }; }
    if (key === 'about') { const t = new V3(0, 4.9, -9.6); return { pos: t.clone().add(new V3(4.2, 3.3, 14.1).multiplyScalar(k)), tgt: t }; }
    const g = giants[key], P = g.holder.position.clone(), H = g.H;
    const dir = new V3(-P.x, 0, 16 - P.z).normalize();
    const tgt = P.clone().add(new V3(0, H * 0.5, 0));
    const off = dir.multiplyScalar(H * 1.3 + 3.2).add(new V3(0, H * 0.2, 0)).multiplyScalar(k);
    return { pos: tgt.clone().add(off), tgt };
  }
  // Shifts the view so the subject sits beside the panel instead of under it.
  function framed(v) {
    const pos = v.pos.clone(), tgt = v.tgt.clone();
    const fwd = tgt.clone().sub(pos); const dist = fwd.length(); fwd.normalize();
    const right = new V3().crossVectors(fwd, UP).normalize();
    const up = new V3().crossVectors(right, fwd).normalize();
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), halfW = halfH * camera.aspect;
    const off = new V3();
    if (isDesktop()) { const f = Math.min(460, innerWidth * 0.42) / innerWidth; off.addScaledVector(right, (f + 0.02) * halfW); }
    else off.addScaledVector(up, -0.5 * halfH);
    return { pos: pos.add(off), tgt: tgt.add(off) };
  }
  const viewFor = (m) => (m === 'home' ? homeView() : framed(sectionView(m)));
  function flyTo(v, dur, ease) {
    gsap.to(cam, { px: v.pos.x, py: v.pos.y, pz: v.pos.z, tx: v.tgt.x, ty: v.tgt.y, tz: v.tgt.z, duration: REDUCE ? Math.min(dur, 0.8) : dur, ease: ease || 'power3.inOut', overwrite: true });
  }

  /* =========================================================
     PANEL + PROJECT BOARD
     ========================================================= */
  let mode = 'intro', activeProject = -1;
  const panel = createPanel({ onSelectProject: (i) => selectProject(i), getActiveProject: () => activeProject });

  function boardToProjects() {
    decor.forEach((p, i) => {
      gsap.to(p.position, { y: -0.3, duration: 0.45, delay: 0.2 + i * 0.02, ease: 'power2.in', overwrite: true });
      gsap.to(p.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.45, delay: 0.2 + i * 0.02, ease: 'power2.in', overwrite: true, onComplete: () => { p.visible = false; } });
    });
    projPieces.forEach((pp, i) => {
      pp.holder.visible = true;
      gsap.to(pp.holder.position, { y: 0, duration: 0.7, delay: 1 + i * 0.09, ease: 'back.out(1.7)', overwrite: true, onStart: () => Snd.clack(1 + i * 0.05, 0.3) });
      gsap.to(pp.holder.scale, { x: PIECE_SCALE, y: PIECE_SCALE, z: PIECE_SCALE, duration: 0.6, delay: 1 + i * 0.09, ease: 'back.out(1.7)', overwrite: true });
    });
  }
  function boardToDecor() {
    setActive(-1);
    projPieces.forEach((pp, i) => {
      gsap.to(pp.holder.position, { y: -0.4, duration: 0.4, delay: i * 0.03, ease: 'power2.in', overwrite: true });
      gsap.to(pp.holder.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.4, delay: i * 0.03, overwrite: true, onComplete: () => { pp.holder.visible = false; } });
    });
    decor.forEach((p, i) => {
      p.visible = true;
      gsap.to(p.position, { y: 0, duration: 0.5, delay: 0.4 + i * 0.02, ease: 'back.out(1.5)', overwrite: true });
      gsap.to(p.scale, { x: 0.5, y: 0.5, z: 0.5, duration: 0.5, delay: 0.4 + i * 0.02, ease: 'back.out(1.5)', overwrite: true });
    });
  }
  function setActive(i) {
    activeProject = i;
    projPieces.forEach((pp, j) => {
      gsap.to(pp.inner.position, { y: j === i ? 0.3 : 0, duration: 0.5, ease: 'power3.out' });
      gsap.to(pp.mat, { emissiveIntensity: j === i ? 0.9 : 0.18, duration: 0.4 });
    });
    if (i >= 0) {
      const pp = projPieces[i];
      gsap.fromTo(pp.inner.rotation, { y: pp.baseRot }, { y: pp.baseRot + Math.PI * 2, duration: REDUCE ? 0 : 1.1, ease: 'power2.out' });
      const p = sqPos(i, 0); hl.position.x = p.x; hl.position.z = p.z;
      hl.material.color.set(PROJECTS[i].color); hl.visible = true;
    } else hl.visible = false;
  }
  function selectProject(i) {
    if (mode !== 'projects') return;
    setActive(i);
    if (i >= 0) Snd.clack(1.2, 0.4); else Snd.tick();
    panel.refreshProjects();
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */
  const dockBtns = [...document.querySelectorAll('#dock button')];
  function updateDock() {
    dockBtns.forEach((b) => b.setAttribute('aria-current', b.dataset.go === mode ? 'true' : 'false'));
    document.body.classList.toggle('home', mode === 'home');
  }
  function resetOrbit() { yawVel = 0; yawTarget = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2; pitchTarget = 0; zoomTarget = 1; }
  function goTo(key) {
    if (mode === 'intro' || key === mode) return;
    const prev = mode; mode = key;
    Snd.tick(); resetOrbit(); clearHover(); updateDock();
    if (prev === 'projects') boardToDecor();
    if (key === 'home') { panel.close(); flyTo(homeView(), 1.9); history.replaceState(null, '', location.pathname); return; }
    activeProject = -1;
    flyTo(framed(sectionView(key)), 2.1);
    panel.open(key);
    if (key === 'projects') boardToProjects();
    history.replaceState(null, '', '#' + key);
  }
  dockBtns.forEach((b) => b.addEventListener('click', () => goTo(b.dataset.go)));
  $('#pClose').addEventListener('click', () => goTo('home'));
  addEventListener('keydown', (e) => {
    if (mode === 'intro') return;
    if (e.key === 'Escape') { if (mode === 'projects' && activeProject >= 0) selectProject(-1); else goTo('home'); }
    if (mode === 'projects' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const d = e.key === 'ArrowRight' ? 1 : -1, n = PROJECTS.length;
      selectProject(activeProject < 0 ? (d > 0 ? 0 : n - 1) : (activeProject + d + n) % n);
    }
  });

  /* ---------- sound toggle ---------- */
  const sndBtn = $('#snd');
  const syncSnd = () => { sndBtn.setAttribute('aria-pressed', Snd.muted ? 'false' : 'true'); $('#sndLabel').textContent = Snd.muted ? 'Sound off' : 'Sound on'; };
  sndBtn.addEventListener('click', () => { Snd.init(); Snd.setMuted(!Snd.muted); syncSnd(); });
  syncSnd();

  /* =========================================================
     PICKING, HOVER, 360° ORBIT
     ========================================================= */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(9, 9), tip = $('#tip');
  let ptrMoved = false, down = null, dragging = false, lastX = 0, lastY = 0, hoverId = null;

  function pick() {
    if (mode === 'intro') return null;
    ray.setFromCamera(ndc, camera);
    const list = mode === 'projects' ? projMeshes : mode === 'home' ? giantMeshes.concat(sheetMeshes) : giantMeshes;
    const hit = ray.intersectObjects(list, false)[0];
    return hit ? hit.object.userData : null;
  }
  const showTip = (text, color) => { tip.textContent = text; tip.style.setProperty('--c', color); tip.classList.add('on'); };
  const hideTip = () => tip.classList.remove('on');
  const clearHover = () => setHover(null);

  function setHover(h) {
    const id = h ? (h.kind === 'section' ? 's:' + h.key : h.kind === 'sheet' ? 'sheet' : 'p:' + h.i) : null;
    if (id === hoverId) return;
    if (hoverId) {
      if (hoverId === 'sheet') gsap.to(sheet.tilt.position, { y: 0.95, duration: 0.3 });
      else if (hoverId[0] === 's') {
        const g = giants[hoverId.slice(2)];
        gsap.to(g.mat, { emissiveIntensity: g.baseEI, duration: 0.3 });
        gsap.to(g.label.scale, { x: g.lw, y: (g.lw * 200) / 640, duration: 0.3 });
      } else {
        const i = +hoverId.slice(2);
        if (projPieces[i]) gsap.to(projPieces[i].inner.position, { y: i === activeProject ? 0.3 : 0, duration: 0.3 });
      }
    }
    hoverId = id;
    canvas.style.cursor = id ? 'pointer' : mode === 'home' ? 'grab' : 'default';
    if (!id) { hideTip(); return; }
    Snd.tick();
    if (h.kind === 'sheet') { gsap.to(sheet.tilt.position, { y: 1.1, duration: 0.3 }); showTip('♞ Scoresheet · read my story', '#ffb547'); }
    else if (h.kind === 'section') {
      const g = giants[h.key];
      gsap.to(g.mat, { emissiveIntensity: 0.5, duration: 0.3 });
      gsap.to(g.label.scale, { x: g.lw * 1.12, y: (g.lw * 1.12 * 200) / 640, duration: 0.3 });
      if (mode !== h.key) showTip(`${GLYPH[g.s.piece]} ${h.key === 'about' ? 'About me' : g.s.title} · open`, g.s.color);
    } else {
      if (h.i !== activeProject) gsap.to(projPieces[h.i].inner.position, { y: 0.1, duration: 0.3 });
      showTip(`${PROJECTS[h.i].sq} · ${PROJECTS[h.i].name}`, PROJECTS[h.i].color);
    }
  }

  const setNdc = (e) => { ndc.x = (e.clientX / innerWidth) * 2 - 1; ndc.y = -(e.clientY / innerHeight) * 2 + 1; };
  canvas.addEventListener('pointermove', (e) => {
    setNdc(e); ptrMoved = true; mouse.x = ndc.x; mouse.y = ndc.y;
    tip.style.transform = `translate(${Math.min(e.clientX + 16, innerWidth - tip.offsetWidth - 8)}px, ${e.clientY + 18}px)`;
    if (down) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
      if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 7) { if (!dragging) hideTip(); dragging = true; }
      if (dragging && mode === 'home') {
        yawVel = -dx * 0.006; yawTarget += yawVel;
        pitchTarget = clamp(pitchTarget - dy * 0.004, -0.75, 0.5);
        canvas.style.cursor = 'grabbing';
      }
    }
  });
  canvas.addEventListener('pointerdown', (e) => {
    setNdc(e); down = { x: e.clientX, y: e.clientY }; lastX = e.clientX; lastY = e.clientY; dragging = false; yawVel = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (down && !dragging) {
      setNdc(e); const h = pick();
      if (h) { if (h.kind === 'section') goTo(h.key); else if (h.kind === 'sheet') goTo('about'); else selectProject(h.i); }
    }
    down = null; dragging = false;
    if (mode === 'home' && !hoverId) canvas.style.cursor = 'grab';
  });
  canvas.addEventListener('wheel', (e) => {
    if (mode !== 'home') return;
    e.preventDefault();
    zoomTarget = clamp(zoomTarget * (1 + clamp(e.deltaY, -100, 100) * 0.0012), 0.5, 1.45);
  }, { passive: false });
  canvas.addEventListener('dblclick', () => { if (mode === 'home') resetOrbit(); });
  canvas.addEventListener('pointerleave', () => { ndc.set(9, 9); ptrMoved = true; mouse.x = mouse.y = 0; });

  /* =========================================================
     LIGHTNING
     ========================================================= */
  function lightning() {
    if (import.meta.env.DEV && window.__noLightning) return;
    const tl = gsap.timeline();
    if (REDUCE) tl.to(flash, { intensity: I(1.2), duration: 0.15 }).to(flash, { intensity: 0, duration: 0.8 });
    else tl.to(flash, { intensity: I(4), duration: 0.05 }).to(flash, { intensity: I(0.3), duration: 0.08 }).to(flash, { intensity: I(3), duration: 0.05 }).to(flash, { intensity: 0, duration: 0.7 });
    setTimeout(() => Snd.thunder(), 450 + Math.random() * 1100);
  }
  const scheduleLightning = () => setTimeout(() => { lightning(); scheduleLightning(); }, 15000 + Math.random() * 17000);

  /* =========================================================
     INTRO
     ========================================================= */
  let signOn = false;
  function runIntro(deepLink) {
    flyTo(homeView(), 3.4, 'power2.inOut');
    ['experience', 'projects', 'about', 'contact', 'skills'].forEach((k, i) => {
      const g = giants[k], d = REDUCE ? 0.2 + i * 0.1 : 0.9 + i * 0.28;
      gsap.to(g.piece.position, {
        y: 0, duration: REDUCE ? 0.01 : 0.75, delay: d, ease: 'power3.in',
        onComplete: () => {
          Snd.clack(0.42, 0.9);
          gsap.fromTo(g.ring.scale, { x: 2.4, y: 2.4 }, { x: 1, y: 1, duration: 0.8, ease: 'power3.out' });
          gsap.fromTo(g.disk.material, { opacity: 0.55 }, { opacity: 0.07, duration: 1 });
          if (!REDUCE) gsap.fromTo(g.piece.scale, { y: g.s.scale * 0.86 }, { y: g.s.scale, duration: 0.6, ease: 'elastic.out(1,.4)' });
        },
      });
      gsap.to(g.label.material, { opacity: 1, delay: d + 0.9, duration: 0.6 });
    });
    const ft = gsap.timeline({ delay: REDUCE ? 0.6 : 2.3, onComplete: () => { signOn = true; } });
    if (!REDUCE) [0.9, 0.1, 0.7, 0.05, 1, 0.3, 1].forEach((o, i) => ft.to(signMat, { opacity: o, duration: 0.06 + i * 0.01 }));
    ft.to(signMat, { opacity: 1, duration: 0.2 }).to(signLight, { intensity: P(1.4), duration: 0.4 }, '<');
    setTimeout(() => {
      mode = 'home'; updateDock();
      $('#hint').textContent = hintText();
      document.body.classList.add('ready');
      if (deepLink && SECTIONS[deepLink]) goTo(deepLink);
      setTimeout(lightning, 4000); scheduleLightning();
    }, REDUCE ? 1200 : 3600);
  }

  const startBtn = $('#startBtn');
  startBtn.disabled = false;
  stLoad.innerHTML = '<b>Ready.</b> 64 squares, 8 projects, 1 rainy night';
  startBtn.focus({ preventScroll: true });
  startBtn.addEventListener('click', () => {
    startBtn.disabled = true;
    Snd.init(); syncSnd();
    gsap.to('#start', { opacity: 0, duration: 0.9, ease: 'power2.out', onComplete: () => { $('#start').hidden = true; } });
    runIntro(location.hash.slice(1));
  }, { once: true });

  /* =========================================================
     LOOP + RESIZE
     ========================================================= */
  const off = new V3();
  let last = performance.now(), elapsed = 0, codeT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05); last = now; elapsed += dt;
    W.updateRain(dt);
    for (const k in giants) { const g = giants[k]; g.label.position.y = g.ly + Math.sin(elapsed * 1.3 + g.phase) * 0.12; }
    if (signOn && !REDUCE && Math.random() < 0.004) { signMat.opacity = 0.35; setTimeout(() => { signMat.opacity = 1; }, 60 + Math.random() * 100); }
    if (hl.visible) hl.material.opacity = 0.35 + Math.sin(elapsed * 4) * 0.15;
    codeT += dt; if (codeT > 0.07) { W.drawCode(codeT); codeT = 0; }
    if (ptrMoved && !TOUCH && !down) { ptrMoved = false; setHover(pick()); }

    if (!down && mode === 'home' && Math.abs(yawVel) > 0.0002) { yawTarget += yawVel; yawVel *= Math.pow(0.93, dt * 60); }
    const lerp = Math.min(1, dt * 6);
    yaw += (yawTarget - yaw) * lerp; pitch += (pitchTarget - pitch) * lerp; zoom += (zoomTarget - zoom) * Math.min(1, dt * 5);
    const s = Math.min(1, dt * 2.5);
    par.x += ((TOUCH || REDUCE ? 0 : mouse.x) - par.x) * s; par.y += ((TOUCH || REDUCE ? 0 : mouse.y) - par.y) * s;
    const pk = mode === 'home' ? 0.9 : 0.18;
    off.set(cam.px - cam.tx, cam.py - cam.ty, cam.pz - cam.tz).applyAxisAngle(UP, yaw);
    if (Math.abs(pitch) > 0.0005 || Math.abs(zoom - 1) > 0.0005) { sph.setFromVector3(off); sph.phi = clamp(sph.phi + pitch, 0.18, 1.42); sph.radius *= zoom; off.setFromSpherical(sph); }
    camera.position.set(cam.tx + off.x + par.x * pk, cam.ty + off.y + par.y * pk * 0.6, cam.tz + off.z);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    if (composer) composer.render(); else renderer.render(scene, camera);
  }
  camera.position.set(cam.px, cam.py, cam.pz); camera.lookAt(0, 0, -2);
  requestAnimationFrame(frame);

  addEventListener('resize', () => {
    applyLens();
    if (document.body.classList.contains('ready')) $('#hint').textContent = hintText();
    renderer.setSize(innerWidth, innerHeight);
    if (composer) composer.setSize(innerWidth, innerHeight);
    if (mode !== 'intro') {
      const v = viewFor(mode); gsap.killTweensOf(cam);
      Object.assign(cam, { px: v.pos.x, py: v.pos.y, pz: v.pos.z, tx: v.tgt.x, ty: v.tgt.y, tz: v.tgt.z });
    }
  });
}
