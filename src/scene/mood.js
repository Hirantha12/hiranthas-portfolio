// Two moods for the same plaza: the rainy neon night and a sunny mountain valley.
// One number, t (0 = night, 1 = day), drives every light, colour, the fog, the bloom, the rain
// and the valley scenery, so a switch is a smooth blend: a mist rolls through (hiding the far
// scenery while it swaps), the rain fades, the sky brightens, and then the birds arrive.
// Every light stays in the scene in both moods, so switching never recompiles a shader.
import * as THREE from 'three';
import gsap from 'gsap';
import { P } from './world.js';

const I = (v) => v * Math.PI;
const KEY = 'hg-mood';
export const MOODS = ['night', 'day'];
export function storedMood() {
  try { const q = new URLSearchParams(location.search).get('mood'); if (MOODS.includes(q)) return q; } catch (e) { /* ignore */ }
  try { const m = localStorage.getItem(KEY); if (MOODS.includes(m)) return m; } catch (e) { /* storage blocked */ }
  return 'night';
}
function remember(m) { try { localStorage.setItem(KEY, m); } catch (e) { /* storage blocked */ } }

const HAZE = 0xaed8f3; // the sky at the horizon, and the fog colour by day
const FOG = { night: 0.026, day: 0.0032, mist: 0.045 };

export function createMood({ scene, renderer, camera, W, bloom, touch, reduce, lensK, onChange }) {
  const R = W.moodRefs;
  const st = { t: 0, target: storedMood(), signOn: false, valley: null, loading: null, tween: null };
  const lerp = THREE.MathUtils.lerp;

  // [object, property, night value, day value]
  const nums = [
    [R.hemi, 'intensity', I(0.55), I(0.5)],
    [R.moon, 'intensity', I(0.55), 0],
    [R.fill, 'intensity', I(0.4), I(0.14)],
    [R.sun, 'intensity', 0, I(0.78)],
    [R.boardSpot, 'intensity', P(1.0), P(0.2)],
    [R.kingSpot, 'intensity', P(1.5), 0],
    [R.warm, 'intensity', P(0.9), P(0.45)],
    [R.sheet.light, 'intensity', P(0.6), 0],
    [R.rainMat, 'opacity', 0.3, 0],
    [R.rippleMat, 'opacity', 1, 0],
    [R.city.material, 'opacity', 1, 0],
    [R.floorDay.uDay, 'value', 0, 1],
  ];
  if (bloom) nums.push([bloom, 'strength', 0.75, 0.28], [bloom, 'threshold', 0.72, 0.94]);
  R.glowLights.forEach((L) => nums.push([L, 'intensity', L.intensity, 0]));
  R.lamps.forEach((l) => nums.push([l.light, 'intensity', l.light.intensity, 0]));
  // [colour to set, night, day]
  const C = (a, b) => [new THREE.Color(a), new THREE.Color(b)];
  const cols = [
    [R.hemi.color, ...C(0x5a4a9a, 0xcfe7ff)],
    [R.sun.color, ...C(0xfff0d6, 0xffe7c0)],
    [R.hemi.groundColor, ...C(0x120a1c, 0x7b9a4c)],
    [R.fill.color, ...C(0x5f5596, 0xe2ebff)],
    [R.wall.color, ...C(0x251a35, 0x7d5d45)],
    [R.roof.color, ...C(0x1b1328, 0x9a4630)],
    [R.sheet.paperMat.color, ...C(0xb4ac9e, 0xf4efe4)],
    [R.boardFrame.color, ...C(0x16101f, 0x4a2e1a)],     // the chess table: dark lacquer at night, walnut by day
    [R.wood.color, ...C(0x5b3826, 0x8c5c36)],            // counter, table and stools: warmer wood in the sun
    [R.darkWood.color, ...C(0x2a1b22, 0x5e3d26)],
    [R.ebonyS.color, ...C(0x231b33, 0x2a211c)],          // black pieces lose their purple tint in daylight
    [scene.background, ...C(0x07060c, HAZE)],
    [scene.fog.color, ...C(0x0b0815, HAZE)],
    ...R.lamps.map((l) => [l.globe.material.color, ...C(0xffe2f2, 0xeef3f6)]),
  ];

  let mist = 0; // extra fog while switching
  const fogDensity = () => lerp(FOG.night, FOG.day, Math.pow(st.t, 0.6)) + mist;

  function apply() {
    const t = st.t;
    for (const [o, k, a, b] of nums) o[k] = lerp(a, b, t);
    for (const [c, a, b] of cols) c.copy(a).lerp(b, t);
    R.signLight.intensity = st.signOn ? P(1.4) * (1 - t) : 0;
    scene.fog.density = fogDensity() / Math.pow(lensK(), 1.4);
    R.rain.visible = R.rippleMesh.visible = t < 0.999;
    R.city.visible = t < 0.999;
    R.sun.shadow.autoUpdate = t > 0.001;
    const day = t >= 0.5;
    const bt = R.getBoardTop(), bm = R.boardTex[day ? 'day' : 'night']; if (bt.material.map !== bm) bt.material.map = bm;
    for (const k in W.giants) { const l = W.giants[k].label; const m = l.userData.tex[day ? 'day' : 'night']; if (l.material.map !== m) l.material.map = m; }
    if (st.valley) { st.valley.sky.material.uniforms.uNight.value.copy(scene.fog.color); st.valley.setDay(t); } // the sky fades in from the mist colour
  }

  // Loads and builds the valley the first time the sunny mood is needed.
  function ensureValley() {
    if (st.valley) return Promise.resolve(st.valley);
    if (!st.loading) {
      st.loading = import('./valley.js').then(async ({ buildValley }) => {
        const v = buildValley({ touch, reduce });
        // compile its shaders before it's shown, so the switch doesn't stutter
        v.group.visible = true; v.sky.visible = true;
        try { await renderer.compileAsync(v.group, camera, scene); await renderer.compileAsync(v.sky, camera, scene); } catch (e) { /* compiled on first use instead */ }
        scene.add(v.sky, v.group);
        v.group.visible = false; v.sky.visible = false;
        st.valley = v; apply();
        if (onChange) onChange('valley', v);
        return v;
      });
      st.loading.catch(() => { st.loading = null; });
    }
    return st.loading;
  }

  // Switch mood. `instant` for the START screen (nothing is drawn yet).
  async function set(m, { instant = false } = {}) {
    if (!MOODS.includes(m)) return;
    st.target = m; remember(m);
    document.body.classList.toggle('day', m === 'day');
    if (onChange) onChange('mood', m);
    if (m === 'day') { try { await ensureValley(); } catch (e) { return; } if (st.target !== m) return; }
    const to = m === 'day' ? 1 : 0;
    if (st.tween) st.tween.kill();
    if (instant || reduce) { mist = 0; st.t = to; apply(); return; }
    const from = st.t, k = { v: 0 };
    st.tween = gsap.to(k, {
      v: 1, duration: 3.2, ease: 'sine.inOut',
      onUpdate: () => { st.t = lerp(from, to, k.v); mist = FOG.mist * Math.pow(Math.sin(Math.PI * k.v), 2) * Math.abs(to - from); apply(); },
      onComplete: () => { mist = 0; st.t = to; apply(); st.tween = null; },
    });
  }

  // Start in the stored mood: the valley loads while the START screen is up.
  // The scene is always built in night colours first and switched to day a moment later
  // (after the page has finished setting up), so anything that remembers "the starting sky",
  // like the lightning, always remembers the night one. This is what caused the white night.
  apply();
  if (st.target === 'day') {
    document.body.classList.add('day'); ensureValley().catch(() => {});
    queueMicrotask(() => { if (st.target === 'day' && !st.tween) { st.t = 1; apply(); } });
  }

  return {
    set, apply, ensureValley, fogDensity,
    get mood() { return st.target; },
    get t() { return st.t; },
    // Rain, lightning and neon flicker only in the full night.
    get stormy() { return st.target === 'night' && st.t < 0.01; },
    ready: () => (st.target === 'day' ? ensureValley() : Promise.resolve()),
    signOn() { st.signOn = true; apply(); },
    update(dt) { if (st.valley) st.valley.update(dt, camera); },
    // for tests: freeze the night→day blend at progress v (0…1)
    preview(v) { if (st.tween) st.tween.kill(); st.t = v; mist = FOG.mist * Math.pow(Math.sin(Math.PI * v), 2); apply(); },
  };
}
