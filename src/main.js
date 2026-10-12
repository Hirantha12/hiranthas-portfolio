import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import gsap from 'gsap';

// Fonts are bundled with the site (same files Google Fonts serves), so they load from our own
// domain instead of waiting on two extra Google connections.
import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/monoton/400.css';
import './style.css';
import { SECTIONS, PROJECTS, GLYPH, PROFILE } from './data/content.js';
import { Snd } from './audio/sound.js';
import { setMaxAnisotropy } from './scene/canvas.js';
import { buildWorld } from './scene/world.js';
import { createGame } from './scene/game.js';
import { createJourney } from './scene/journey.js';
import { createMood, storedMood } from './scene/mood.js';
import { createPanel } from './ui/panel.js';
import { createChat } from './ui/chat.js';
import { warm } from './ui/preview.js';

// Colour setup: this matches the look of the original r128 prototype (linear, no colour
// conversion). When you move to baked Blender textures, switch to the modern pipeline:
// ColorManagement on, renderer.outputColorSpace = SRGBColorSpace, texture.colorSpace = SRGBColorSpace.
THREE.ColorManagement.enabled = false;
if (import.meta.env.DEV) window.gsap = gsap; // handy for debugging in the console

const $ = (s) => document.querySelector(s);
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(pointer: coarse)').matches;
const DEBUG = new URLSearchParams(location.search).has('debug'); // ?debug shows FPS and draw calls
const V3 = THREE.Vector3, UP = new V3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const I = (v) => v * Math.PI; // light units, see world.js
const stLoad = $('#stLoad');

const fontsReady = Promise.race([
  Promise.all(['400 64px Monoton', '700 64px "Chakra Petch"', '600 26px "JetBrains Mono"', '400 15px "JetBrains Mono"'].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 3500)),
]).catch(() => {});

// Shown inside another page (for example as the live preview in its own Projects panel): wait
// for START before building the 3D board, so the preview costs almost nothing until asked.
const EMBEDDED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
if (EMBEDDED) {
  const btn = $('#startBtn');
  document.body.classList.add('embedded');
  btn.disabled = false;
  stLoad.innerHTML = '<b>Live preview.</b> Press START to load the 3D board';
  btn.addEventListener('click', () => {
    btn.disabled = true; stLoad.textContent = 'Setting up the board…';
    fontsReady.then(() => start(true));
  }, { once: true });
} else fontsReady.then(() => start(false));

function start(autoStart) {
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
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 400);

  /* ---------- bloom ---------- */
  let composer = null, bloom = null;
  try {
    const rt = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.UnsignedByteType, samples: TOUCH ? 0 : 4 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(DPR);
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.5, 0.72);
    composer.addPass(bloom);
  } catch (e) { composer = null; bloom = null; }

  const W = buildWorld(scene, { touch: TOUCH, reduce: REDUCE });
  if (import.meta.env.DEV) window.__dbg = { scene, camera, renderer, get composer() { return composer; }, set composer(v) { composer = v; }, W };
  const { giants, giantMeshes, sqPos, decor, projPieces, projMeshes, hl, sheet, sheetMeshes, signMat, flash, PIECE_SCALE } = W;

  /* =========================================================
     CAMERA + VIEWS
     ========================================================= */
  const cam = { px: 0, py: 28, pz: 46, tx: 0, ty: 0, tz: -2 };
  if (import.meta.env.DEV) window.__dbg.cam = cam;
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
    scene.fog.density = mood.fogDensity() / Math.pow(K, 1.4);
    const ls = (1 + (K - 1) * 0.9) * (innerWidth < 700 ? 1.15 : 1);
    for (const key in giants) { const g = giants[key]; g.lw = g.baseLw * ls; g.label.scale.set(g.lw, (g.lw * 200) / 640, 1); }
    // Phones (tall screens): the scoresheet stands nearer the front, so it (and its My story / CV
    // tag) is in view. It sits between the Knight's tour squares, clear of his landing spots.
    const tall = a < 0.75;
    sheet.g.position.set(tall ? 3.0 : 6.6, 0.02, tall ? 9.0 : 7.2); sheet.g.rotation.y = tall ? -0.1 : -0.32;
  }
  // The help line above the menu: what you can do on the board, each action in bold.
  const hintText = () => {
    const tips = TOUCH
      ? [['Tap', 'a giant piece to open it'], ['Drag', 'to look around'], ['Pinch', 'to zoom'], ['Double-tap', 'to reset']]
      : [['Click', 'a giant piece to open it'], ['Drag', 'to look around 360°'], ['Scroll', 'to zoom'], ['Double-click', 'to reset']];
    return tips.slice(0, innerWidth < 520 ? 3 : 4).map(([k, v]) => `<span><b>${k}</b> ${v}</span>`).join('<i aria-hidden="true">·</i>');
  };
  const portraitK = () => K;
  // Rainy night or sunny day (see scene/mood.js). Chosen on the START screen or with the ☾/☀ switch.
  const mood = createMood({
    scene, renderer, camera, W, bloom, touch: TOUCH, reduce: REDUCE, lensK: () => K,
    onChange: (what, v) => {
      if (what === 'mood') { stopStorm(); syncMood(v); game.setDay(v === 'day'); if (mode === 'home' && started) flyTo(homeView(), 2.8, 'sine.inOut'); }
      if (what === 'valley') v.onFlock = () => setTimeout(() => Snd.bird(), 600 + Math.random() * 1500);
    },
  });
  if (import.meta.env.DEV) window.__dbg.mood = mood;
  applyLens();
  const isDesktop = () => innerWidth > 860;

  function homeView() {
    const k = portraitK(), sky = mood.mood === 'day' ? 1 : 0; // by day the view tilts up a little to show the sky and the sun
    return { pos: new V3(0, 6.4 + (k - 1) * 1.5 + sky * 0.3, 17.5 * k), tgt: new V3(0, 2.1 - (k - 1) * 0.8 + sky * 1.5, -1.5) };
  }
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
  // "Play for them": the visitor sits on the plaza side as Black, facing Hirantha and his kiosk.
  // The camera backs off just enough for the board and the clock (on the right) to fit the part
  // of the screen the panel leaves free; tall phones look down more steeply.
  const portrait = () => camera.aspect < 1;
  function gameView() {
    const a = camera.aspect, tall = portrait();
    // tall: Hirantha at the top, the board, then the clock in front of it
    const tgt = tall ? new V3(0.5, 1.65, 0.0) : new V3(0.45, 1.4, 0.1);
    const free = isDesktop() ? (innerWidth - Math.min(460, innerWidth * 0.42) - 32) / innerWidth : 1;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfW = Math.atan(tanV * a * free);
    // Back off far enough for the width (board + clock) and, on wide screens, the height too
    // (from Hirantha's head down to the near edge of the board).
    const dist = Math.max((tall ? 3.3 : 3.25) / Math.tan(halfW), tall ? 0 : 2.45 / tanV), el = THREE.MathUtils.degToRad(tall ? 52 : 34);
    return { pos: new V3(tgt.x, tgt.y + dist * Math.sin(el), tgt.z + dist * Math.cos(el)), tgt };
  }
  const viewFor = (m) => (m === 'home' ? homeView() : m === 'talk' ? framed(talkView()) : m === 'projects' && game.active ? framed(gameView())
    : m === 'experience' && journey.active ? framed(journey.view()) : framed(sectionView(m)));
  function flyTo(v, dur, ease) {
    gsap.to(cam, { px: v.pos.x, py: v.pos.y, pz: v.pos.z, tx: v.tgt.x, ty: v.tgt.y, tz: v.tgt.z, duration: REDUCE ? Math.min(dur, 0.8) : dur, ease: ease || 'power3.inOut', overwrite: true });
  }

  /* =========================================================
     PANEL + PROJECT BOARD
     ========================================================= */
  let mode = 'intro', activeProject = -1;
  const game = createGame({
    scene, camera, board: W.board, boardTop: W.boardTop, sqPos, ivory: W.ivoryS, ebony: W.ebonyS, reduce: REDUCE,
    onChange: (info) => panel.gameUpdate(info),
  });
  game.setDay(mood.mood === 'day');
  const panel = createPanel({
    onSelectProject: (i) => selectProject(i), getActiveProject: () => activeProject,
    onGame: (action) => {
      if (action === 'journey') startJourney();
      else if (action.startsWith('j-')) journey.action(action);
      else if (action === 'play' || action === 'replay') startGame();
      else if (action === 'exit') exitGame();
      else if (action === 'contact') goTo('contact');
      else if (action === 'shake') game.shake();
      else if (action.startsWith('g-')) game.action(action);
    },
  });

  // Hirantha (4 KB) is downloaded after START, so he isn't on the critical path of the first load;
  // he then sits in the kiosk coding until a game starts. If he fails to load, the game still works.
  let avatarLoading = false, hirantha = null;
  function loadAvatar() {
    if (avatarLoading) return;
    avatarLoading = true;
    import('./scene/avatar.js')
      .then(({ createAvatar }) => { hirantha = createAvatar({ scene, position: new V3(0, 0, -2.72) }); game.setAvatar(hirantha); })
      .catch(() => {});
  }

  // "Ask Hirantha": click him in the kiosk to talk (see src/ui/chat.js and api/ask.js).
  const chat = createChat({ panel, onTalk: (on) => hirantha && hirantha.talk(on) });

  // "Knight's tour" (Experience): Hirantha jumps across the plaza floor, one role per knight move.
  const journey = createJourney({
    scene, panel, reduce: REDUCE, getAvatar: () => hirantha,
    scale: () => Math.min(portraitK(), 1.6),
    onCamera: (v, dur) => flyTo(framed(v), dur),
    onExit: () => { if (mode !== 'experience') return; resetOrbit(); panel.open('experience'); flyTo(framed(sectionView('experience')), 1.6); },
  });
  function startJourney() {
    if (mode !== 'experience') return;
    loadAvatar(); resetOrbit(); clearHover();
    // he arrives with a lazy import a moment after START; wait for him briefly if needed
    let tries = 0;
    const go = () => { if (hirantha || tries++ > 15) journey.start(); else setTimeout(go, 200); };
    go();
  }
  // His name tag: a page element pinned to a point above his head, so it stays readable from
  // the main view. Shown only on the board view while he's coding and the shop faces the camera.
  // It scales with the scene (full size when the kiosk looks as big as on a large monitor) and
  // switches to a small one-line tag on tablets and phones, so it never covers the shop's sign.
  // The scoresheet gets the same kind of tag ("My story"), so visitors can tell it opens too.
  const hTag = $('#hTag'), sTag = $('#sTag'), tagPos = new V3(), tagTop = new V3(), kioskAt = new V3(0.5, 2.1, -4.1);
  const TAG_FULL_PPM = 56; // pixels per metre at the kiosk on a 1845px-wide screen
  hTag.addEventListener('click', () => goTo('talk'));
  sTag.querySelector('.st-story').addEventListener('click', () => goTo('about'));
  sTag.querySelector('.st-cv').addEventListener('click', () => takeCopy());

  // "Take a copy of my scoresheet": a carbon copy of the scoresheet peels off the clipboard,
  // flies up to the visitor, then the CV downloads (and the copy flies off to the browser's
  // downloads, top right). The About and Contact panels have a plain download button too.
  const CV_NAME = 'Hirantha_Rathnayaka_CV.pdf';
  function downloadCV() {
    const a = document.createElement('a'); a.href = PROFILE.cv; a.download = CV_NAME;
    document.body.append(a); a.click(); a.remove();
  }
  let toastT = 0;
  function cvToast() {
    const t = $('#cvToast');
    t.innerHTML = `<i aria-hidden="true">⬇</i><span><b>${CV_NAME}</b><small>Your copy of my scoresheet is downloading</small></span>`;
    t.hidden = false; requestAnimationFrame(() => t.classList.add('on'));
    clearTimeout(toastT); toastT = setTimeout(() => { t.classList.remove('on'); setTimeout(() => { t.hidden = true; }, 400); }, 3800);
  }
  let copying = false;
  function takeCopy() {
    if (copying) return;
    Snd.tick();
    if (REDUCE) { downloadCV(); cvToast(); return; }
    copying = true;
    // it starts from the paper on the clipboard
    sheetMeshes[2].getWorldPosition(tagPos).project(camera);
    const sx = ((tagPos.x + 1) / 2) * innerWidth, sy = ((1 - tagPos.y) / 2) * innerHeight;
    const el = document.createElement('div'); el.className = 'cvfly'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="cvp-head">♞ OFFICIAL SCORESHEET</div><div class="cvp-name">${PROFILE.name.toUpperCase()}</div>
      <div class="cvp-role">${PROFILE.role}</div><div class="cvp-lines">${'<i></i>'.repeat(9)}</div><div class="cvp-stamp">COPY</div>`;
    document.body.append(el);
    gsap.set(el, { x: sx, y: sy, xPercent: -50, yPercent: -50, scale: 0.2, rotation: -16, opacity: 0 });
    gsap.timeline({ onComplete: () => { el.remove(); copying = false; } })
      .to(sheet.tilt.position, { y: 1.1, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' })
      .to(el, { opacity: 1, duration: 0.15 }, 0.1)
      .to(el, { x: innerWidth / 2, y: innerHeight * 0.46, scale: 1, rotation: -3, duration: 0.75, ease: 'power3.out' }, 0.1)
      .add(() => { Snd.clack(1.8, 0.25); downloadCV(); cvToast(); }, '+=0.35')
      .to(el, { x: innerWidth - 70, y: 24, scale: 0.08, rotation: 14, opacity: 0.2, duration: 0.6, ease: 'power2.in' }, '+=0.25');
  }
  let sheetBobbed = false;
  // Pins a tag to a world point. `anchor` is the CSS offset of the tag from that point.
  function pinTag(el, at, anchor, size) {
    tagPos.copy(at).project(camera);
    if (tagPos.z > 1 || Math.abs(tagPos.x) > 1.05 || Math.abs(tagPos.y) > 1.05) { el.hidden = true; return; }
    el.classList.toggle('compact', size.compact);
    el.hidden = false;
    // keep the whole tag on screen (a centred tag needs half its width of room on each side)
    const half = anchor.includes('-50%') ? (el.offsetWidth * size.scale) / 2 : 0;
    const x = Math.min(innerWidth - 8 - half, Math.max(8 + half, ((tagPos.x + 1) / 2) * innerWidth));
    el.style.transform = `translate(${x}px, ${((1 - tagPos.y) / 2) * innerHeight}px) ${anchor} scale(${size.scale.toFixed(3)})`;
    el.hidden = false;
  }
  function placeNameTag() {
    const board = mode === 'home' && document.body.classList.contains('ready');
    if (!board) { hTag.hidden = sTag.hidden = true; return; }
    // Size from how big the kiosk looks: full size on large screens, a one-line tag on tablets/phones.
    tagPos.copy(kioskAt).project(camera);
    const k = (Math.abs(tagTop.copy(kioskAt).setY(kioskAt.y + 1).project(camera).y - tagPos.y) * innerHeight / 2) / TAG_FULL_PPM;
    const size = { compact: k < 0.7, scale: k < 0.7 ? 1 : Math.min(1, k) };

    const at = hirantha ? hirantha.nameTag() : null;
    if (at && camera.position.z > at.z + 1) pinTag(hTag, at, 'translate(-100%, -50%)', size); // left of him
    else hTag.hidden = true;

    // top edge of the clipboard; hidden when orbiting round to its back
    // top edge of the clipboard; hidden when orbiting round to its back
    sheetMeshes[1].getWorldPosition(tagTop).y += 0.25;
    if (camera.position.z > tagTop.z - 1) {
      pinTag(sTag, tagTop, 'translate(-50%, -100%)', size);
      if (!sheetBobbed && !sTag.hidden) { // one gentle bob the first time, to draw the eye
        sheetBobbed = true;
        gsap.to(sheet.tilt.position, { y: 1.12, duration: 0.45, delay: 0.6, yoyo: true, repeat: 1, ease: 'sine.inOut' });
      }
    } else sTag.hidden = true;
  }
  // Camera in front of the counter, looking at him at his laptop.
  // (on tall phones it comes in closer, over the counter, so the chessboard isn't in the way)
  const talkView = () => { const tgt = new V3(1.3, 2.0, -4.25); return { pos: tgt.clone().add(camera.aspect < 1 ? new V3(-0.3, 0.95, 3.1) : new V3(-0.7, 0.75, 5.4)), tgt }; };

  function startGame() {
    if (mode !== 'projects') return;
    loadAvatar();
    if (!game.active) { // swap the project pieces for a full set
      setActive(-1);
      projPieces.forEach((pp, i) => {
        gsap.to(pp.holder.position, { y: -0.4, duration: 0.35, delay: i * 0.03, ease: 'power2.in', overwrite: true });
        gsap.to(pp.holder.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.35, delay: i * 0.03, overwrite: true, onComplete: () => { pp.holder.visible = false; } });
      });
    }
    clearHover(); resetOrbit();
    panel.startGame(); // before game.enter(), which posts the first status line
    game.enter(portrait());
    document.body.classList.add('in-game');
    flyTo(framed(gameView()), 2.0);
  }
  function exitGame() {
    if (!game.active) return;
    game.exit();
    document.body.classList.remove('in-game');
    if (mode !== 'projects') return;
    resetOrbit();
    boardToProjects();
    panel.refreshProjects();
    flyTo(framed(sectionView('projects')), 1.8);
  }

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
      gsap.to(pp.inner.position, { y: j === i ? 0.2 : 0, duration: 0.5, ease: 'power3.out' });
      gsap.to(pp.mat, { emissiveIntensity: j === i ? 0.1 : 0.05, duration: 0.4 }); // a soft tint, never a glare
      gsap.to(pp.ring.material, { opacity: j === i ? 1 : 0, duration: 0.3 });
    });
    if (i >= 0) {
      const pp = projPieces[i];
      gsap.fromTo(pp.inner.rotation, { y: pp.baseRot }, { y: pp.baseRot + Math.PI * 2, duration: REDUCE ? 0 : 1.1, ease: 'power2.out' });
      const sq = PROJECTS[i].sq, p = sqPos('abcdefgh'.indexOf(sq[0]), +sq[1] - 1); hl.position.x = p.x; hl.position.z = p.z;
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
  // Drag to orbit, scroll or pinch to zoom: on the board and in Projects (including the game).
  const canOrbit = () => mode === 'home' || mode === 'projects' || (mode === 'experience' && journey.active);
  function resetOrbit() { yawVel = 0; yawTarget = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2; pitchTarget = 0; zoomTarget = 1; }
  function goTo(key) {
    if (mode === 'intro' || key === mode) return;
    const prev = mode; mode = key;
    Snd.tick(); resetOrbit(); clearHover(); updateDock();
    if (prev === 'projects') { if (game.active) { game.exit(); document.body.classList.remove('in-game'); } boardToDecor(); }
    if (prev === 'talk') { chat.close(); if (hirantha) hirantha.chatMode(false); }
    if (prev === 'experience' && journey.active) journey.exit(false);
    if (key === 'talk') {
      flyTo(framed(talkView()), 1.8);
      chat.open(); hirantha.chatMode(true);
      history.replaceState(null, '', '#talk');
      return;
    }
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
    if (e.key === 'Escape') { if (journey.active) journey.exit(true); else if (game.active) exitGame(); else if (mode === 'projects' && activeProject >= 0) selectProject(-1); else goTo('home'); }
    if (mode === 'projects' && !game.active && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
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

  function pickAll() {
    if (mode === 'intro') return [];
    ray.setFromCamera(ndc, camera);
    const list = mode === 'experience' && journey.active ? journey.pickList() : mode === 'projects' ? (game.active ? game.pickList() : projMeshes) : mode === 'home' ? giantMeshes.concat(sheetMeshes, hirantha ? hirantha.pickMeshes : []) : giantMeshes;
    return ray.intersectObjects(list, false);
  }
  function pick() { const hit = pickAll()[0]; return hit ? hit.object.userData : null; }
  const showTip = (text, color) => { tip.textContent = text; tip.style.setProperty('--c', color); tip.classList.add('on'); };
  const hideTip = () => tip.classList.remove('on');
  const clearHover = () => setHover(null);

  function setHover(h) {
    const id = h ? (h.kind === 'section' ? 's:' + h.key : h.kind === 'sheet' ? 'sheet' : h.kind === 'hirantha' ? 'h' : 'p:' + h.i) : null;
    if (id === hoverId) return;
    if (hoverId) {
      if (hoverId === 'sheet') gsap.to(sheet.tilt.position, { y: 0.95, duration: 0.3 });
      else if (hoverId === 'h') { /* the avatar has no hover animation */ }
      else if (hoverId[0] === 's') {
        const g = giants[hoverId.slice(2)];
        gsap.to(g.mat, { emissiveIntensity: g.baseEI, duration: 0.3 });
        gsap.to(g.label.scale, { x: g.lw, y: (g.lw * 200) / 640, duration: 0.3 });
      } else {
        const i = +hoverId.slice(2);
        if (projPieces[i]) {
          gsap.to(projPieces[i].inner.position, { y: i === activeProject ? 0.2 : 0, duration: 0.3 });
          gsap.to(projPieces[i].ring.material, { opacity: i === activeProject ? 1 : 0, duration: 0.3 });
        }
      }
    }
    hoverId = id;
    canvas.style.cursor = id ? 'pointer' : mode === 'home' ? 'grab' : 'default';
    if (!id) { hideTip(); return; }
    Snd.tick();
    if (h.kind === 'hirantha') showTip('💬 Hirantha · ask me anything', '#3ef2ff');
    else if (h.kind === 'sheet') { gsap.to(sheet.tilt.position, { y: 1.1, duration: 0.3 }); showTip('♞ Scoresheet · read my story', '#ffb547'); }
    else if (h.kind === 'section') {
      const g = giants[h.key];
      gsap.to(g.mat, { emissiveIntensity: 0.5, duration: 0.3 });
      gsap.to(g.label.scale, { x: g.lw * 1.12, y: (g.lw * 1.12 * 200) / 640, duration: 0.3 });
      if (mode !== h.key) showTip(`${GLYPH[g.s.piece]} ${h.key === 'about' ? 'About me' : g.s.title} · open`, g.s.color);
    } else {
      if (h.i !== activeProject) {
        gsap.to(projPieces[h.i].inner.position, { y: 0.1, duration: 0.3 });
        gsap.to(projPieces[h.i].ring.material, { opacity: 0.55, duration: 0.2 });
      }
      warm(PROJECTS[h.i].url, PROJECTS[h.i].name); // start loading its site before the click
      showTip(`${PROJECTS[h.i].sq} · ${PROJECTS[h.i].name}`, PROJECTS[h.i].color);
    }
  }

  const setNdc = (e) => { ndc.x = (e.clientX / innerWidth) * 2 - 1; ndc.y = -(e.clientY / innerHeight) * 2 + 1; };
  // Touch: every finger is tracked so two fingers pinch-zoom instead of being read as a drag.
  // A pinch locks out orbiting and tapping until all fingers are lifted.
  const pointers = new Map();
  let pinching = false, pinchDist = 0, pinchZoom = 1, lastTap = { t: 0, x: 0, y: 0 };
  const fingerGap = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinching) {
      if (pointers.size >= 2 && canOrbit()) zoomTarget = clamp(pinchZoom * (pinchDist / fingerGap()), 0.5, 1.45);
      return;
    }
    setNdc(e); ptrMoved = true; mouse.x = ndc.x; mouse.y = ndc.y;
    tip.style.transform = `translate(${Math.min(e.clientX + 16, innerWidth - tip.offsetWidth - 8)}px, ${e.clientY + 18}px)`;
    if (down) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
      if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 7) { if (!dragging) hideTip(); dragging = true; }
      if (dragging && canOrbit()) {
        yawVel = -dx * 0.006; yawTarget += yawVel;
        pitchTarget = clamp(pitchTarget - dy * 0.004, -0.75, 0.5);
        canvas.style.cursor = 'grabbing';
      }
    }
  });
  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (pointers.size === 2) { pinching = true; down = null; dragging = false; yawVel = 0; pinchDist = fingerGap(); pinchZoom = zoomTarget; hideTip(); return; }
    if (pinching) return;
    setNdc(e); down = { x: e.clientX, y: e.clientY }; lastX = e.clientX; lastY = e.clientY; dragging = false; yawVel = 0;
  });
  function endPointer(e, cancelled) {
    pointers.delete(e.pointerId);
    if (pinching) { if (pointers.size === 0) pinching = false; return; }
    // Double-tap on empty space resets the view, like double-click on desktop.
    const doubleTap = () => {
      if (e.pointerType !== 'touch' || !canOrbit()) return;
      const now = performance.now();
      if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) { resetOrbit(); lastTap.t = 0; }
      else lastTap = { t: now, x: e.clientX, y: e.clientY };
    };
    if (down && !dragging && !cancelled && journey.active && mode === 'experience') {
      setNdc(e); const hits = pickAll();
      if (hits.length) journey.tap(hits); else doubleTap();
    } else if (down && !dragging && !cancelled && game.active && mode === 'projects') {
      setNdc(e); const hits = pickAll();
      if (hits.length) game.tap(hits); else doubleTap();
    } else if (down && !dragging && !cancelled) {
      setNdc(e); const h = pick();
      if (h) { if (h.kind === 'hirantha') goTo('talk'); else if (h.kind === 'section') goTo(h.key); else if (h.kind === 'sheet') goTo('about'); else selectProject(h.i); }
      else doubleTap();
    }
    down = null; dragging = false;
    if (mode === 'home' && !hoverId) canvas.style.cursor = 'grab';
  }
  canvas.addEventListener('pointerup', (e) => endPointer(e, false));
  canvas.addEventListener('pointercancel', (e) => endPointer(e, true));
  canvas.addEventListener('wheel', (e) => {
    if (!canOrbit()) return;
    e.preventDefault();
    zoomTarget = clamp(zoomTarget * (1 + clamp(e.deltaY, -100, 100) * 0.0012), 0.5, 1.45);
  }, { passive: false });
  canvas.addEventListener('dblclick', () => { if (canOrbit()) resetOrbit(); });
  canvas.addEventListener('pointerleave', () => { ndc.set(9, 9); ptrMoved = true; mouse.x = mouse.y = 0; });

  /* =========================================================
     LIGHTNING
     ========================================================= */
  // Like a real storm: the strike is somewhere out beyond the city. The sky lights up in a few
  // quick flickers (the plaza only gently, from that direction), sometimes you see the bolt
  // itself, and the thunder arrives later the further away it was: a close one cracks, a far
  // one only rumbles.
  // The night sky and fog colours (fixed: the page may have started in the sunny mood, so don't copy the current ones).
  const skyBase = new THREE.Color(0x07060c), fogBase = new THREE.Color(0x0b0815), skyLit = new THREE.Color(0x2c3156);
  const boltMat = new THREE.LineBasicMaterial({ color: 0xe6ebff, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const bolt = new THREE.LineSegments(new THREE.BufferGeometry(), boltMat);
  bolt.frustumCulled = false; bolt.visible = false; scene.add(bolt);
  // A jagged bolt from the clouds down to the skyline, with a couple of short branches.
  function makeBolt(x, z) {
    const pts = [], side = new V3(-z, 0, x).normalize();
    const path = (p, steps, drift, out) => {
      for (let i = 0; i < steps && p.y > 4; i++) {
        const q = p.clone().add(side.clone().multiplyScalar((Math.random() - 0.5) * 5 + drift)).add(new V3(0, -(3 + Math.random() * 4), 0));
        q.x += (Math.random() - 0.5) * 1.5; q.z += (Math.random() - 0.5) * 1.5;
        pts.push(p.x, p.y, p.z, q.x, q.y, q.z); out && out.push(q); p = q;
      }
    };
    const trunk = [];
    path(new V3(x, 78, z), 30, 0, trunk);
    for (let b = 0; b < 2 + Math.floor(Math.random() * 2); b++) { // branches
      const from = trunk[Math.floor(Math.random() * trunk.length * 0.6)];
      if (from) path(from.clone(), 4 + Math.floor(Math.random() * 5), (Math.random() < 0.5 ? -1 : 1) * 2.2, null);
    }
    const n = pts.length; for (let i = 0; i < n; i += 3) pts.push(pts[i] + 0.25, pts[i + 1], pts[i + 2]); // a little thicker
    bolt.geometry.dispose();
    bolt.geometry = new THREE.BufferGeometry(); bolt.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  }
  const L = { v: 0 }; let strength = 1, boltOn = false;
  function applyFlash() {
    const v = Math.min(1, L.v * strength);
    // Close up (board, chat) the bright board would glare, so the plaza light stays subtler there;
    // the sky still lights up fully.
    flash.intensity = I(mode === 'home' ? 0.5 : 0.1) * v;
    scene.background.lerpColors(skyBase, skyLit, v);
    scene.fog.color.lerpColors(fogBase, skyLit, v * 0.75);
    boltMat.opacity = boltOn ? Math.min(1, L.v * 1.5) : 0;
  }
  function lightning() {
    if (import.meta.env.DEV && window.__noLightning) return;
    if (!mood.stormy) return; // no storms on a sunny day
    const near = Math.random();                       // 0: far away … 1: close
    const a = (Math.random() * 2 - 1) * 1.05;         // direction, out beyond the kiosk
    const R = 112 - near * 22, bx = Math.sin(a) * R, bz = -Math.cos(a) * R;
    strength = 0.45 + near * 0.55;
    flash.position.set(bx * 0.4, 50, bz * 0.4);       // from the strike's side of the sky, not the camera
    makeBolt(bx, bz); bolt.visible = !REDUCE; boltOn = !REDUCE;
    gsap.killTweensOf(L); L.v = 0;
    const tl = gsap.timeline({ onUpdate: applyFlash, onComplete: () => { bolt.visible = false; boltOn = false; L.v = 0; applyFlash(); } });
    if (REDUCE) tl.to(L, { v: 0.45, duration: 0.3 }).to(L, { v: 0, duration: 1.4 });
    else {
      const pulses = 1 + Math.floor(Math.random() * 3);   // real strikes flicker 1-3 times
      for (let i = 0; i < pulses; i++) tl.to(L, { v: 1 - i * 0.18, duration: 0.03 }).to(L, { v: 0.1, duration: 0.05 + Math.random() * 0.09 });
      tl.add(() => { boltOn = false; }).to(L, { v: 0.3, duration: 0.05 }).to(L, { v: 0, duration: 0.7 + near * 0.5, ease: 'power2.out' });
    }
    // sound travels about 3 s per km: a close strike is heard almost at once, a far one later
    setTimeout(() => Snd.thunder(near, Math.sin(a)), 450 + (1 - near) * 4200);
  }
  if (import.meta.env.DEV) Object.assign(window.__dbg, { lightning, flashAt: (v) => { L.v = v; boltOn = v > 0; bolt.visible = v > 0; applyFlash(); }, makeBolt });
  const scheduleLightning = () => setTimeout(() => { lightning(); scheduleLightning(); }, 15000 + Math.random() * 17000);
  // Switching to day in the middle of a flash: end it at once (the mood now owns the sky colour).
  function stopStorm() {
    gsap.killTweensOf(L); L.v = 0; boltOn = false; bolt.visible = false; boltMat.opacity = 0; flash.intensity = 0;
  }

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
    ft.to(signMat, { opacity: 1, duration: 0.2 }).add(() => mood.signOn(), '<');
    setTimeout(() => {
      mode = 'home'; updateDock();
      $('#hint').innerHTML = hintText();
      document.body.classList.add('ready');
      if (deepLink && SECTIONS[deepLink]) goTo(deepLink);
      setTimeout(lightning, 4000); scheduleLightning();
    }, REDUCE ? 1200 : 3600);
  }

  const startBtn = $('#startBtn');
  let isReady = false;
  // Compile every shader before START, including pieces that only appear later, so the intro
  // and the first visit to Projects don't stutter. compileAsync doesn't block the page.
  function ready() {
    startBtn.disabled = false;
    isReady = true; syncMood(mood.mood);
    startBtn.focus({ preventScroll: true });
    if (autoStart) startBtn.click(); // embedded: START was already pressed
  }
  const hidden = projPieces.map((p) => p.holder); // still shrunk under the board, so nothing shows
  hidden.forEach((o) => { o.visible = true; });
  Promise.resolve(renderer.compileAsync(scene, camera)).catch(() => {}).finally(() => {
    hidden.forEach((o) => { o.visible = false; });
    mood.ready().catch(() => {}).finally(ready); // a sunny-day visitor's valley is built by now too
  });
  let started = false; // nothing is drawn behind the START screen
  startBtn.addEventListener('click', () => {
    startBtn.disabled = true;
    Snd.mood = mood.mood; Snd.init(); syncSnd();
    const go = () => {
      started = true;
      gsap.to('#start', { opacity: 0, duration: 0.9, ease: 'power2.out', onComplete: () => { $('#start').hidden = true; } });
      runIntro(location.hash.slice(1));
      loadAvatar();
    };
    // picked "Sunny day" just before pressing START: wait for the valley (usually a moment)
    if (mood.mood === 'day') { stLoad.textContent = 'Growing the valley…'; mood.ready().catch(() => mood.set('night', { instant: true })).finally(go); } else go();
  }, { once: true });

  /* ---------- mood switch: START screen choice and the ☾/☀ buttons in the corner ---------- */
  const moodBtns = [...document.querySelectorAll('[data-mood]')];
  const MOOD_TEXT = {
    night: { foot: 'Best with sound on · rain, thunder and wooden pieces', ready: 'rainy night', color: '#07060c' },
    day: { foot: 'Best with sound on · birdsong, a stream and wooden pieces', ready: 'sunny day', color: '#aed8f3' },
  };
  function syncMood(m) {
    moodBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mood === m)));
    $('#stFoot').textContent = MOOD_TEXT[m].foot;
    if (isReady && !started) stLoad.innerHTML = `<b>Ready.</b> 64 squares, ${PROJECTS.length} projects, 1 ${MOOD_TEXT[m].ready}`;
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = MOOD_TEXT[m].color;
  }
  moodBtns.forEach((b) => b.addEventListener('click', () => {
    const m = b.dataset.mood; if (m === mood.mood) return;
    Snd.setMood(m); Snd.tick();
    mood.set(m, { instant: !started }); // behind the START screen nothing is drawn, so no blend
  }));
  syncMood(mood.mood);

  /* =========================================================
     LOOP + RESIZE
     ========================================================= */
  const off = new V3();
  let last = performance.now(), elapsed = 0, codeT = 0;

  // ?debug: frame rate and draw calls per frame (bloom adds about a dozen of its own).
  let stats = null, statFrames = 0, statTime = 0;
  if (DEBUG) {
    stats = document.createElement('div'); stats.id = 'dbg';
    stats.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99;padding:6px 9px;border-radius:6px;background:rgba(0,0,0,.75);color:#57ffb0;font:600 12px/1.4 ui-monospace,monospace;white-space:pre;pointer-events:none';
    document.body.append(stats);
    renderer.info.autoReset = false;
  }
  function updateStats(rawDt) {
    statFrames++; statTime += rawDt;
    if (statTime < 0.5) return;
    const r = renderer.info.render;
    stats.textContent = `${Math.round(statFrames / statTime)} fps\n${Math.round(r.calls / statFrames)} draw calls\n${Math.round(r.triangles / statFrames / 1000)}k triangles\nDPR ${renderer.getPixelRatio()}`;
    statFrames = 0; statTime = 0; renderer.info.reset();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!started) { last = now; return; } // the START screen covers the canvas: skip the work
    const rawDt = (now - last) / 1000;
    const dt = Math.min(rawDt, 0.05); last = now; elapsed += dt;
    if (mood.t < 0.999) W.updateRain(dt);
    mood.update(dt);
    for (const k in giants) { const g = giants[k]; g.label.position.y = g.ly + Math.sin(elapsed * 1.3 + g.phase) * 0.12; }
    if (signOn && mood.stormy && !REDUCE && Math.random() < 0.004) { signMat.opacity = 0.35; setTimeout(() => { signMat.opacity = 1; }, 60 + Math.random() * 100); }
    if (hl.visible) hl.material.opacity = 0.35 + Math.sin(elapsed * 4) * 0.15;
    codeT += dt; if (codeT > 0.07) { W.drawCode(codeT); codeT = 0; }
    if (ptrMoved && !TOUCH && !down) {
      ptrMoved = false;
      if ((game.active && mode === 'projects') || (journey.active && mode === 'experience')) canvas.style.cursor = pick() ? 'pointer' : 'default';
      else setHover(pick());
    }
    game.update(dt);
    journey.update(dt);
    placeNameTag();
    W.stringLights.visible = !game.active && mode !== 'talk'; // from the visitor's seat they'd hang right over his face

    if (!down && canOrbit() && Math.abs(yawVel) > 0.0002) { yawTarget += yawVel; yawVel *= Math.pow(0.93, dt * 60); }
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
    if (stats) updateStats(rawDt);
  }
  camera.position.set(cam.px, cam.py, cam.pz); camera.lookAt(0, 0, -2);
  requestAnimationFrame(frame);

  addEventListener('resize', () => {
    applyLens();
    if (game.active) game.layout(portrait()); // phone rotated: move the clock
    if (document.body.classList.contains('ready')) $('#hint').innerHTML = hintText();
    renderer.setSize(innerWidth, innerHeight);
    if (composer) composer.setSize(innerWidth, innerHeight);
    if (mode !== 'intro') {
      const v = viewFor(mode); gsap.killTweensOf(cam);
      Object.assign(cam, { px: v.pos.x, py: v.pos.y, pz: v.pos.z, tx: v.tgt.x, ty: v.tgt.y, tz: v.tgt.z });
    }
  });
}
