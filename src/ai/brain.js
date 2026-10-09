// The in-browser assistant: loads the embedding model in a worker, loads the pre-computed
// example vectors (src/data/qa-vectors.json), and answers questions with src/ai/match.js.
// Until the model is ready (or if it can't load), answers come from the keyword matcher.
import { decide, decodeIndex, examples, hashExamples, MODEL } from './match.js';

let worker = null, index = null, ready = false, loading = null, seq = 0;
const pending = new Map();

function embed(texts) {
  return new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject });
    worker.postMessage({ id, texts });
  });
}

// Call when the chat opens: downloads the model in the background.
export function warmUp() {
  if (loading) return loading;
  loading = (async () => {
    worker = new Worker(new URL('./embed.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id); if (!p) return; pending.delete(data.id);
      if (data.error) p.reject(new Error(data.error)); else p.resolve(data.vecs);
    };
    const file = (await import('../data/qa-vectors.json')).default;
    if (file.model === MODEL && file.hash === hashExamples()) index = decodeIndex(file);
    else { // vectors out of date (run `npm run embed`): build them here instead
      const ex = examples();
      index = { ids: ex.map((e) => e.id), vecs: (await embed(ex.map((e) => e.q))).map((v) => Float32Array.from(v)) };
    }
    await embed(['warm up']); // first call also loads the model
    ready = true;
  })().catch((e) => { console.warn('Ask Hirantha: model unavailable, using keywords', e); });
  return loading;
}

const timeout = (ms) => new Promise((r) => setTimeout(r, ms));

// Returns { id, text, how, score }; how is 'semantic', 'name', 'keyword' or 'unknown'.
export async function answer(question) {
  if (!ready && loading) await Promise.race([loading, timeout(6000)]); // give a loading model a moment
  if (!ready) return decide(question, null, null);
  try {
    const [vec] = await embed([question]);
    return decide(question, Float32Array.from(vec), index);
  } catch (e) {
    return decide(question, null, null);
  }
}

export const isReady = () => ready;
