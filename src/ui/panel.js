// The side panel ("scoresheet") that opens for each section.
import gsap from 'gsap';
import { SECTIONS, PROJECTS, MOVES, SKILLS, GLYPH, PIECE_NAME, PROFILE } from '../data/content.js';

const host = (u) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');
const isDesktop = () => innerWidth > 860;

function aboutHTML() {
  return `
  <p class="lead">I build production web apps end to end: React and Next.js front ends, Node.js, Express and NestJS services, SQL and NoSQL data, deployed on AWS and Azure.</p>
  <div class="stats">
    <div><b>4+</b><span>years shipping production web apps</span></div>
    <div><b>10+</b><span>projects delivered for clients</span></div>
    <div><b>2nd</b><span>runner-up, All-Island chess</span></div>
  </div>
  <h3>How I work</h3>
  <p>Agile and Scrum teams, code reviews, and close work with designers, since I started out in UI/UX. Lately I've been putting AI features inside products: natural-language document search with citations, and CV screening that scores resumes against job descriptions.</p>
  <h3>Education</h3>
  <ul class="kv">
    <li><span class="k">2019–2025</span><div><b>Bachelor of Software Engineering (Hons)</b><em>The Open University of Sri Lanka</em></div></li>
    <li><span class="k">2019–2023</span><div><b>Higher National Diploma, Software Engineering</b><em>The Open University of Sri Lanka</em></div></li>
  </ul>
  <h3>Off the board</h3>
  <ul class="kv">
    <li><span class="k">Chess</span><div><b>All-Island 2nd Runner-up</b><em>Provincial Champion · District Champion</em></div></li>
    <li><span class="k">Football</span><div><b>Provincial 1st Runner-up</b><em>District Champion</em></div></li>
    <li><span class="k">Cricket</span><div><b>School and district level</b></div></li>
  </ul>`;
}

function experienceHTML() {
  return `
  <p class="lead">My career as a scoresheet: six moves from intern to full stack engineer.</p>
  <ol class="moves">${MOVES.map((m) => `
    <li><div class="mv-n">${m.n}.<small>${m.ann || ''}</small></div><div>
      <div class="mv-top"><b>${m.role}</b><span class="tag${m.now ? ' now' : ''}">${m.now ? 'To move · now' : m.phase}</span></div>
      <div class="mv-org">${m.org} · <span>${m.when}</span></div>
      <p>${m.note}</p></div></li>`).join('')}
  </ol>`;
}

function skillsHTML() {
  return `
  <p class="lead">The pieces I play with every day, from the database up to the pixels.</p>
  ${SKILLS.map(([g, list, hot]) => `<h3>${g}</h3><div class="chips${hot ? ' hot' : ''}">${list.map((s) => `<span>${s}</span>`).join('')}</div>`).join('')}
  <h3>AI in products</h3>
  <p class="note">Built AI-powered CV screening that compares resumes with job descriptions and returns match scores, and a natural-language query dashboard with citation links for document search.</p>`;
}

function contactHTML() {
  return `
  <p class="lead">Have a project, a role, or a game of chess in mind? Email is the fastest way to reach me.</p>
  <div class="crow"><span class="k">Email</span><span class="v" id="emailVal">${PROFILE.email}</span><button class="btn-sm" data-copy>Copy</button></div>
  <div class="crow"><span class="k">GitHub</span><a href="${PROFILE.github}" target="_blank" rel="noopener">${host(PROFILE.github)} ↗</a><span></span></div>
  <div class="crow"><span class="k">LinkedIn</span><a href="${PROFILE.linkedin}" target="_blank" rel="noopener">in/hirantha-rathnayaka ↗</a><span></span></div>
  <div class="crow"><span class="k">Based in</span><span class="v" style="user-select:text">${PROFILE.location}</span><span></span></div>`;
}

function projectsListHTML() {
  return `
  <button class="playcard" data-game="play">
    <span class="pc-k">♚ Play for them</span>
    <b>Beat me in 8 moves</b>
    <em>Sit at the board as Black. Every move you make unlocks a project, and move 8 is checkmate.</em>
  </button>
  <p class="lead">Eight projects, set up on the first rank. Pick a piece on the board or a project below.</p>
  <ol class="plist">${PROJECTS.map((p, i) => `
    <li><button class="pitem" data-i="${i}" style="--pc:${p.color}"><span class="sq">${p.sq}</span><span class="pg">${GLYPH[p.piece]}</span><span class="pt"><b>${p.name}</b><em>${p.kind}</em></span><span class="ar">→</span></button></li>`).join('')}
  </ol>`;
}

function projectHTML(i) {
  const p = PROJECTS[i], n = PROJECTS.length;
  const prev = PROJECTS[(i + n - 1) % n], next = PROJECTS[(i + 1) % n];
  return `
  <button class="back" data-list>← All projects</button>
  ${projectCore(i)}
  <div class="pager">
    <button data-step="-1"><small>← ${prev.sq}</small><span>${prev.name}</span></button>
    <button data-step="1"><small>${next.sq} →</small><span>${next.name}</span></button>
  </div>`;
}

// The project itself, shared by the list view and the game.
function projectCore(i) {
  const p = PROJECTS[i];
  const stage = p.image
    ? `<div class="pv-stage has-img"><img src="${p.image}" alt="Screenshot of ${p.name}"></div>`
    : `<div class="pv-stage"><span class="sqb">${p.sq}</span><span class="big">${GLYPH[p.piece]}</span><span class="nm">${p.name}</span></div>`;
  return `
  <div class="preview" style="--pc:${p.color}">
    <div class="pv-bar"><i></i><i></i><i></i><span>${p.url ? host(p.url) : 'private platform'}</span></div>
    ${stage}
  </div>
  <p class="ctx">${p.kind} · ${p.ctx}</p>
  <p>${p.desc}</p>
  <h3>Built with</h3>
  <div class="chips">${p.stack.map((s) => `<span>${s}</span>`).join('')}</div>
  <div class="actions">${p.url ? `<a class="btn" href="${p.url}" target="_blank" rel="noopener">Visit live site ↗</a>` : '<span class="muted">Private client platform, so there is no public link.</span>'}</div>`;
}

/* ---------- "Play for them" game panel ---------- */
const dots = (unlocked) => `<span class="gdots">${PROJECTS.map((p, i) => `<i style="--pc:${p.color}"${i < unlocked ? ' class="on"' : ''}></i>`).join('')}</span>`;

function gameStatus(info) {
  const n = PROJECTS.length;
  switch (info.phase) {
    case 'start': return `<b>You play Black.</b> Press <em>your</em> side of the clock (on the right of the board) to start the game.`;
    case 'thinking': return `<span class="gk">Move ${info.k + 1} / ${n}</span> Hirantha is thinking…`;
    case 'move': return `<span class="gk">Move ${info.k + 1} / ${n}</span> ${info.say} Play <b>${info.san}</b>: tap the glowing piece, then its square.`;
    case 'press': return `<span class="gk">Move ${info.k + 1} / ${n}</span> Good move. Now <b>press your clock</b> to reveal project ${info.k + 1}.`;
    case 'mate': return `<b>Checkmate!</b> You beat Hirantha in ${n} moves.`;
    default: return '';
  }
}

const gameIntroHTML = () => `
  <p class="lead">Eight moves, eight projects.</p>
  <ol class="ghow">
    <li>Hirantha (White) moves and presses his clock.</li>
    <li>Follow the arrow: tap the piece, then the square.</li>
    <li>Press your clock to reveal the next project.</li>
  </ol>
  <p class="muted">Move 8 is checkmate. Prefer to just read? Exit any time.</p>`;

const winHTML = () => `
  <div class="gwin">
    <b>You found the mate.</b>
    <p>That was the Englund Gambit trap: 8…Qc1#. If you play this sharp at work too, let's talk.</p>
    <div class="actions"><button class="btn" data-game="contact">Contact me</button><button class="btn ghost" data-game="replay">Play again</button></div>
  </div>`;

export function createPanel({ onSelectProject, getActiveProject, onGame }) {
  const panel = document.querySelector('#panel');
  const body = document.querySelector('#pBody');

  function render(key) {
    const s = SECTIONS[key], active = getActiveProject();
    panel.style.setProperty('--sec', s.color);
    document.querySelector('#pGlyph').textContent = GLYPH[s.piece];
    document.querySelector('#pEyebrow').textContent = `${PIECE_NAME[s.piece]} · ${s.sq} — ${key === 'about' ? 'About me' : s.title}`;
    document.querySelector('#pTitle').textContent = key === 'projects' && active >= 0 ? PROJECTS[active].name : s.title;
    body.innerHTML =
      key === 'about' ? aboutHTML()
      : key === 'experience' ? experienceHTML()
      : key === 'skills' ? skillsHTML()
      : key === 'contact' ? contactHTML()
      : active >= 0 ? projectHTML(active) : projectsListHTML();
    body.scrollTop = 0;
  }

  function open(key) {
    render(key);
    gsap.killTweensOf(panel);
    const wasHidden = panel.hidden;
    panel.hidden = false;
    document.body.classList.add('panel-open');
    if (wasHidden) gsap.fromTo(panel, isDesktop() ? { x: 60, opacity: 0 } : { y: 80, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 0.6, delay: 0.3, ease: 'power3.out' });
    else gsap.fromTo(body, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  }

  function close() {
    document.body.classList.remove('panel-open');
    if (panel.hidden) return;
    gsap.killTweensOf(panel);
    gsap.to(panel, {
      opacity: 0, x: isDesktop() ? 40 : 0, y: isDesktop() ? 0 : 60, duration: 0.35, ease: 'power2.in',
      onComplete: () => { panel.hidden = true; gsap.set(panel, { clearProps: 'transform,opacity' }); },
    });
  }

  function refreshProjects() {
    render('projects');
    gsap.fromTo(body, { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 0.35 });
  }

  // Game view: a status line on top, then the intro, the last unlocked project, or the win screen.
  let unlocked = 0;
  function startGame() {
    unlocked = 0;
    document.querySelector('#pEyebrow').textContent = 'Projects — playing Black';
    document.querySelector('#pTitle').textContent = 'Beat me in 8 moves';
    body.innerHTML = `
      <div class="gstat"><div class="gtop">${dots(0)}<button class="btn-sm" data-game="exit">Exit game</button></div><p id="gStat"></p></div>
      <div id="gCard">${gameIntroHTML()}</div>`;
    body.scrollTop = 0;
    gsap.fromTo(body, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  }
  function gameUpdate(info) {
    const stat = body.querySelector('#gStat'), card = body.querySelector('#gCard');
    if (!stat) return;
    stat.innerHTML = gameStatus(info);
    if (info.phase === 'project' || info.phase === 'mate') {
      unlocked = info.k + 1;
      body.querySelector('.gdots').outerHTML = dots(unlocked);
      document.querySelector('#pTitle').textContent = PROJECTS[info.k].name;
      card.innerHTML = (info.phase === 'mate' ? winHTML() : '') + `<p class="gnew">Project ${unlocked} of ${PROJECTS.length} unlocked</p>` + projectCore(info.k);
      body.scrollTop = 0;
      gsap.fromTo(card, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 });
    }
    if (info.phase === 'project') stat.innerHTML = `<span class="gk">Project ${unlocked} / ${PROJECTS.length}</span> Read on, or wait for Hirantha's next move.`;
  }

  body.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const n = PROJECTS.length;
    if (t.dataset.game) onGame(t.dataset.game);
    else if (t.dataset.i !== undefined) onSelectProject(+t.dataset.i);
    else if (t.hasAttribute('data-list')) onSelectProject(-1);
    else if (t.dataset.step) onSelectProject((getActiveProject() + +t.dataset.step + n) % n);
    else if (t.hasAttribute('data-copy')) {
      const done = () => { t.textContent = 'Copied'; setTimeout(() => (t.textContent = 'Copy'), 1600); };
      const fallback = () => {
        const r = document.createRange(); r.selectNodeContents(document.querySelector('#emailVal'));
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        t.textContent = 'Selected'; setTimeout(() => (t.textContent = 'Copy'), 1600);
      };
      try { navigator.clipboard.writeText(PROFILE.email).then(done, fallback); } catch (err) { fallback(); }
    }
  });

  return { open, close, render, refreshProjects, startGame, gameUpdate };
}
