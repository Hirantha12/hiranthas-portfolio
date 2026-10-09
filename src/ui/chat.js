// "Ask Hirantha": the chat panel. Questions go to the AI endpoint (/api/ask); if that is not
// available (no API key yet, local dev, rate limit, network) the offline assistant answers from
// the same facts. Answers are read aloud with the browser's speech synthesis while the avatar's
// mouth moves.
import { INTRO, SUGGESTIONS } from '../data/assistant.js';
import { Snd } from '../audio/sound.js';

const TIMEOUT_MS = 15000;
let llm; // undefined: not tried yet, true/false: the optional /api/ask LLM is (not) available

// The in-browser assistant and its model load only when someone opens the chat.
let brainP = null;
const brain = () => (brainP ??= import('../ai/brain.js').then((m) => { m.warmUp(); return m; }));

/* ---------- voice ---------- */
const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
let voice = null;
function pickVoice() {
  if (!synth) return;
  const vs = synth.getVoices();
  voice = vs.find((v) => /en-IN/i.test(v.lang))
    || vs.find((v) => /^en/i.test(v.lang) && /male|david|daniel|guy|ravi/i.test(v.name) && !/female/i.test(v.name))
    || vs.find((v) => /^en/i.test(v.lang)) || null;
}
if (synth) { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }

export function createChat({ panel, onTalk }) {
  let body = null, history = [], busy = false, speakId = 0, open = false;

  // Reads text aloud one sentence at a time (long single utterances get cut off in Chrome).
  // onTalk(true/false) drives the avatar's mouth; with sound off or no speech support, the
  // mouth still moves for roughly as long as the text would take to say.
  function speak(text) {
    stopSpeaking();
    const id = ++speakId;
    const done = () => { if (id === speakId) onTalk(false); };
    onTalk(true);
    if (!synth || Snd.muted) { setTimeout(done, Math.min(9000, 600 + text.length * 45)); return; }
    const parts = text.replace(/https?:\/\/\S+/g, '').match(/[^.!?]+[.!?]*/g) || [text];
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p.trim());
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.rate = 1; u.pitch = 0.95;
      if (i === parts.length - 1) { u.onend = done; u.onerror = done; }
      synth.speak(u);
    });
  }
  function stopSpeaking() { speakId++; if (synth) synth.cancel(); onTalk(false); }

  function add(role, text, note) {
    const list = body.querySelector('#cMsgs');
    const el = document.createElement('div');
    el.className = `cmsg ${role === 'user' ? 'me' : 'him'}`;
    const p = document.createElement('p'); p.textContent = text; el.append(p);
    if (note) { const s = document.createElement('span'); s.className = 'cnote'; s.textContent = note; el.append(s); }
    list.append(el); list.scrollTop = list.scrollHeight;
    return el;
  }

  async function ask(question) {
    const q = question.trim().slice(0, 500);
    if (!q || busy) return;
    busy = true;
    body.querySelector('#cSugg').classList.add('used');
    add('user', q);
    history.push({ role: 'user', content: q });
    const typing = add('him', '…'); typing.classList.add('typing');
    const form = body.querySelector('#cForm'); form.classList.add('busy');

    let text = null, note = '';
    // Optional LLM layer (api/ask.js): used only once an API key is configured on the server.
    // The first "not configured" reply switches it off for the rest of the visit.
    if (llm !== false) {
      try {
        const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        const r = await fetch('/api/ask', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }), signal: ctrl.signal,
        });
        clearTimeout(timer);
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.answer) { text = data.answer; note = 'answered by Claude'; llm = true; }
        else if (r.status === 404 || r.status === 503) llm = false;
      } catch (e) { /* network or timeout: use the in-browser assistant */ }
    }
    // Free, in-browser assistant: semantic search over the CV answers.
    if (!text) {
      const r = await (await brain()).answer(q);
      text = r.text;
      note = r.how === 'semantic' ? `in-browser AI · ${Math.round(r.score * 100)}% match` : r.how === 'keyword' ? 'keyword match' : '';
    }

    if (!open) { busy = false; return; } // chat was closed while waiting
    typing.remove();
    add('him', text, note);
    history.push({ role: 'assistant', content: text });
    history = history.slice(-12);
    form.classList.remove('busy'); busy = false;
    speak(text);
  }

  function openChat() {
    open = true; history = [];
    // start downloading the model while he introduces himself, and show its progress
    brain().then((m) => m.warmUp().then(() => m)).then((m) => {
      const st = body && body.querySelector('#cStat'); if (!st) return;
      if (m.isReady()) { st.textContent = 'In-browser AI ready: answers are matched by meaning, privately on your device.'; st.classList.add('ok'); }
      else st.textContent = 'The AI model could not load, so I am answering by keywords.';
    });
    body = panel.openCustom({
      glyph: '♔', eyebrow: 'AI version of Hirantha · answers from his CV', title: 'Ask Hirantha', color: '#3ef2ff',
      html: `
        <div class="chat">
          <div class="cmsgs" id="cMsgs" aria-live="polite"></div>
          <div class="csugg" id="cSugg">${SUGGESTIONS.map((s) => `<button type="button" class="cq" data-q="${s}">${s}</button>`).join('')}</div>
          <form class="cform" id="cForm" autocomplete="off">
            <label for="cIn" class="sr">Your question</label>
            <input id="cIn" maxlength="500" placeholder="Ask about my work, skills, projects…">
            <button class="btn" type="submit">Ask</button>
          </form>
          <p class="cstat" id="cStat">AI model loading in your browser (one-time download, about 25 MB). I can already answer simple questions.</p>
          <p class="cfoot">I'm an AI version of Hirantha and I only know what's in his CV. Voice follows the Sound button. Please don't share personal information here.</p>
        </div>`,
    });
    body.querySelector('#cForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = body.querySelector('#cIn'); const q = input.value; input.value = '';
      ask(q);
    });
    body.querySelector('#cSugg').addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) ask(b.dataset.q); });
    add('him', INTRO);
    history.push({ role: 'user', content: 'Please introduce yourself.' }, { role: 'assistant', content: INTRO });
    setTimeout(() => { if (open) speak(INTRO); }, 900); // after he waves
  }

  function closeChat() { open = false; busy = false; stopSpeaking(); }

  return { open: openChat, close: closeChat, get isOpen() { return open; } };
}
