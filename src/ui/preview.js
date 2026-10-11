// Live project previews: the real website, scaled down inside the project card, scrollable with
// the mouse wheel or a finger. "Desktop" renders the site at laptop width, "Mobile" at phone
// width (so visitors also see the responsive version). "Expand" opens it large in a window.
//
// Only sites that allow being shown inside another page work here. All the public project
// sites did when this was written (no X-Frame-Options or CSP frame-ancestors header). If one
// changes that later, the card offers "Open the live site" after a few seconds instead.
//
// Speed:
//  - preconnect(): when Projects opens, the browser connects to every project site early.
//  - warm(url): on hover (or, in the game, while the player presses the clock) the site starts
//    loading out of sight, so it is often ready by the time the card opens.
//  - A loaded site is kept (up to POOL_MAX of them) when the card closes, so going back to it
//    is instant. Moving a live iframe without reloading it needs Element.moveBefore (Chrome and
//    Edge 133+, Firefox 144+). In other browsers previews still work, just without the pool,
//    so nothing is downloaded twice.

const DEVICE = { desktop: 1280, mobile: 390 };
const MOBILE_H = 800;    // the phone screen height we fit into the box
const WAKING_MS = 5000;  // "the site is waking up" message
const SLOW_MS = 12000;   // offer the direct link
// Loaded sites kept in memory: 3 on computers, 1 on phones and tablets (less memory to spare).
const POOL_MAX = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 1 : 3;
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';

const host = (u) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');
const narrow = () => innerWidth <= 860;
const CAN_MOVE = typeof Element !== 'undefined' && 'moveBefore' in Element.prototype;
// Don't pre-load whole websites for visitors on slow or metered connections.
const LIGHT = (() => { const c = navigator.connection; return !!(c && (c.saveData || /(^|-)2g|3g/.test(c.effectiveType || ''))); })();

/* ---------- the pool of site iframes ---------- */
const pool = new Map(); // url -> { iframe, loaded, used, live }
let park = null;        // an off-screen holder where warm and parked iframes live

function parkEl() {
  if (!park) {
    park = document.createElement('div');
    park.setAttribute('aria-hidden', 'true');
    park.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:800px;overflow:hidden;pointer-events:none;';
    document.body.append(park);
  }
  return park;
}

// Moves an element keeping its state (no reload) where the browser supports it.
function moveInto(parent, el) {
  if (el.parentNode === parent) return;
  if (CAN_MOVE && el.isConnected) parent.moveBefore(el, null); else parent.append(el);
}

function entryFor(url, name) {
  let e = pool.get(url);
  if (!e) {
    const iframe = document.createElement('iframe');
    iframe.title = `Live preview of ${name || host(url)}`;
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('sandbox', SANDBOX);
    e = { iframe, loaded: false, used: 0, live: null };
    iframe.addEventListener('load', () => { e.loaded = true; if (e.live) markLoaded(e.live); });
    iframe.src = url;
    pool.set(url, e);
  }
  e.used = performance.now();
  return e;
}

// Drops the least recently used sites that aren't on screen.
function trim() {
  const idle = [...pool.entries()].filter(([, e]) => !e.live || !e.live.isConnected).sort((a, b) => a[1].used - b[1].used);
  while (pool.size > POOL_MAX && idle.length) { const [url, e] = idle.shift(); e.iframe.remove(); pool.delete(url); }
}

const origins = new Set();
// Opens connections to the project sites ahead of time (cheap: no page is downloaded).
export function preconnect(urls) {
  urls.filter(Boolean).forEach((u) => {
    const o = new URL(u).origin; if (origins.has(o)) return; origins.add(o);
    const l = document.createElement('link'); l.rel = 'preconnect'; l.href = o; document.head.append(l);
  });
}

// Starts loading a site out of sight, so its card opens fast.
export function warm(url, name) {
  if (!url || !CAN_MOVE || LIGHT || pool.has(url)) return;
  const e = entryFor(url, name);
  e.iframe.style.width = '1280px'; e.iframe.style.height = '800px'; // lay it out at desktop size
  moveInto(parkEl(), e.iframe);
  trim();
}

// Call before replacing panel content: keeps loaded sites alive instead of throwing them away.
export function parkPreviews(root) {
  root.querySelectorAll('.pv-live').forEach((live) => {
    const e = pool.get(live.dataset.url); if (!e || e.live !== live) return;
    e.live = null;
    if (CAN_MOVE) moveInto(parkEl(), e.iframe); else { e.iframe.remove(); pool.delete(live.dataset.url); }
  });
  trim();
}

/* ---------- markup ---------- */
const loaderHTML = (url) => `
      <div class="pv-load" role="status"><span class="pv-sweep"></span>
        <span class="pv-chip"><i class="pv-spin" aria-hidden="true"></i><span class="pv-ltxt">Loading ${host(url)}…</span></span></div>
      <div class="pv-msg"><span>Taking longer than usual.</span><a href="${url}" target="_blank" rel="noopener">Open the live site ↗</a></div>`;

const toolsHTML = (mode) => `
      <div class="pv-tools" role="group" aria-label="Preview size">
        <button type="button" data-pv="desktop" aria-pressed="${mode === 'desktop'}">Desktop</button>
        <button type="button" data-pv="mobile" aria-pressed="${mode === 'mobile'}">Mobile</button>
      </div>`;

// The markup for one preview. `stageHTML` is what shows while the site loads (or if it can't).
export function previewHTML(p, stageHTML) {
  if (!p.url) { // private project: no live site to show
    return `
  <div class="preview" style="--pc:${p.color}">
    <div class="pv-bar"><i></i><i></i><i></i><span>${p.url ? host(p.url) : 'private platform'}</span></div>
    ${stageHTML}
  </div>`;
  }
  const mode = narrow() ? 'mobile' : 'desktop';
  return `
  <div class="preview" style="--pc:${p.color}">
    <div class="pv-bar"><i></i><i></i><i></i><span>${host(p.url)}</span>${toolsHTML(mode)}</div>
    <div class="pv-live" data-url="${p.url}" data-name="${p.name}" data-mode="${mode}">
      ${stageHTML}
      <div class="pv-frame"></div>${loaderHTML(p.url)}
      <button type="button" class="pv-expand" data-pv="expand" aria-label="Open a large preview of ${p.name}">⤢ Expand</button>
    </div>
  </div>
  ${p.liveNote ? `<p class="pv-note">${p.liveNote}</p>` : ''}`;
}

/* ---------- sizing ---------- */
// Scales the iframe so the whole site width fits the box (never above 100%).
function fit(live) {
  const ifr = live.querySelector('.pv-frame iframe'); if (!ifr) return;
  const frame = live.querySelector('.pv-frame');
  const mobile = live.dataset.mode === 'mobile';
  const W = live.clientWidth, H = live.clientHeight; if (!W || !H) return;
  const dw = DEVICE[mobile ? 'mobile' : 'desktop'];
  const s = Math.min(1, mobile ? Math.min(H / MOBILE_H, (W - 16) / dw) : W / dw);
  const h = mobile ? Math.min(H - 16, MOBILE_H * s) : H;
  ifr.style.width = `${dw}px`; ifr.style.height = `${h / s}px`; ifr.style.transform = `scale(${s})`;
  frame.style.width = `${dw * s}px`; frame.style.height = `${h}px`;
}
const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((es) => es.forEach((e) => fit(e.target))) : null;

function markLoaded(live) {
  clearTimeout(live._t1); clearTimeout(live._t2);
  live.classList.remove('waking', 'slow'); live.classList.add('loaded');
}

// Puts a site into a preview box (card or large window), loading it if needed.
function attach(live) {
  const e = entryFor(live.dataset.url, live.dataset.name);
  if (e.live && e.live !== live) e.live.classList.remove('loaded'); // shown elsewhere: take it over
  e.live = live;
  const frame = live.querySelector('.pv-frame');
  if (!CAN_MOVE && e.iframe.isConnected && e.iframe.parentNode !== frame) e.loaded = false; // moving reloads it
  moveInto(frame, e.iframe);
  fit(live);
  clearTimeout(live._t1); clearTimeout(live._t2);
  live.classList.remove('loaded', 'waking', 'slow');
  if (e.loaded) markLoaded(live);
  else {
    const txt = live.querySelector('.pv-ltxt');
    if (txt) txt.textContent = `Loading ${host(live.dataset.url)}…`;
    live._t1 = setTimeout(() => { live.classList.add('waking'); if (txt) txt.textContent = 'Still loading, the site is waking up…'; }, WAKING_MS);
    live._t2 = setTimeout(() => live.classList.add('slow'), SLOW_MS);
  }
}

// Call after inserting preview markup into the page: puts each site into its card.
export function mountPreviews(root) {
  root.querySelectorAll('.pv-live').forEach((live) => {
    if (live._mounted) return; live._mounted = true;
    attach(live);
    if (ro) ro.observe(live); else addEventListener('resize', () => fit(live));
  });
  trim();
}

function setMode(scope, mode) {
  const live = scope.querySelector('.pv-live'); if (!live) return;
  live.dataset.mode = mode;
  scope.querySelectorAll('[data-pv="desktop"],[data-pv="mobile"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pv === mode)));
  fit(live);
}

/* ---------- the large preview window ---------- */
// It borrows the same iframe from the card (no second download) and gives it back on close.
let modal = null, cardLive = null;
function closeModal() {
  if (!modal || modal.hidden) return;
  const body = modal.querySelector('.pvm-body');
  if (cardLive && cardLive.isConnected) { // hand the site back to its card
    attach(cardLive);
  } else parkPreviews(body);
  modal.hidden = true; body.innerHTML = ''; cardLive = null;
}
function openModal(live) {
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'pv-modal'; modal.hidden = true;
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<div class="pvm-win"><div class="pvm-body"></div></div>';
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-pvm="close"]')) closeModal();
      const b = e.target.closest('[data-pv="desktop"],[data-pv="mobile"]'); if (b) setMode(modal, b.dataset.pv);
    });
    // Esc closes this window first (capture phase, so the 3D page doesn't also go back).
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal && !modal.hidden) { e.stopPropagation(); closeModal(); } }, true);
    document.body.append(modal);
  }
  const { url, name, mode } = live.dataset;
  cardLive = live;
  modal.style.setProperty('--pc', getComputedStyle(live).getPropertyValue('--pc'));
  modal.querySelector('.pvm-body').innerHTML = `
    <div class="pv-bar"><i></i><i></i><i></i><span>${host(url)}</span>${toolsHTML(mode)}
      <a class="pvm-open" href="${url}" target="_blank" rel="noopener">Open ↗</a>
      <button type="button" class="pvm-close" data-pvm="close" aria-label="Close preview">✕</button>
    </div>
    <div class="pv-live big" data-url="${url}" data-name="${name}" data-mode="${mode}">
      <div class="pv-frame"></div>${loaderHTML(url)}
    </div>`;
  modal.hidden = false;
  mountPreviews(modal);
  modal.querySelector('.pvm-close').focus({ preventScroll: true });
}

// Handles clicks on the preview buttons inside the panel. Returns true if it was one of them.
export function previewClick(t) {
  const action = t.dataset.pv; if (!action) return false;
  const preview = t.closest('.preview'); if (!preview) return true;
  if (action === 'expand') openModal(preview.querySelector('.pv-live'));
  else setMode(preview, action);
  return true;
}
