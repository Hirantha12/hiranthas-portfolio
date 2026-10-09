// Answer selection for "Ask Hirantha", shared by the browser (src/ai/brain.js) and the
// eval/index scripts. Pure functions: no model loading here.
//
// How a question is answered:
//  1. A full project name in the question goes straight to that project.
//  2. Semantic match: the question's embedding is compared (cosine similarity) with every
//     example question; each answer scores its best example.
//  3. Confident semantic match (>= HIGH) wins. A borderline one (>= LOW) wins only if the
//     keyword matcher agrees. Otherwise a strong keyword match is used, and if nothing is
//     convincing the assistant says it doesn't know rather than guessing.
import { QA, UNKNOWN, keywordMatch } from '../data/assistant.js';

export const MODEL = 'Xenova/all-MiniLM-L6-v2';
export const HIGH = 0.55, LOW = 0.4;

export const examples = () => QA.flatMap((it) => it.q.map((q) => ({ id: it.id, q })));
const byId = new Map(QA.map((it) => [it.id, it]));

// Changes whenever the examples or the model change, so a stale vector file is detected.
export function hashExamples() {
  const s = MODEL + '|' + examples().map((e) => `${e.id}:${e.q}`).join('\n');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

// Vectors are stored as int8 (value x 127) to keep the file small.
export function encodeIndex(ids, vecs) {
  const bytes = new Int8Array(vecs.length * vecs[0].length);
  vecs.forEach((v, i) => v.forEach((x, j) => { bytes[i * v.length + j] = Math.max(-127, Math.min(127, Math.round(x * 127))); }));
  const bin = Buffer.from(bytes.buffer).toString('base64');
  return { model: MODEL, hash: hashExamples(), dims: vecs[0].length, ids, data: bin };
}
export function decodeIndex(file) {
  const raw = typeof atob === 'function' ? Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0)) : new Uint8Array(Buffer.from(file.data, 'base64'));
  const bytes = new Int8Array(raw.buffer);
  const vecs = file.ids.map((_, i) => Float32Array.from(bytes.subarray(i * file.dims, (i + 1) * file.dims), (b) => b / 127));
  return { ids: file.ids, vecs };
}

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// Best answer by meaning: [{ id, score }] sorted, one entry per answer.
export function rankSemantic(qvec, index) {
  const best = new Map();
  index.ids.forEach((id, i) => { const s = dot(qvec, index.vecs[i]); if (s > (best.get(id) ?? -1)) best.set(id, s); });
  return [...best].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}

// Returns { id, text, how, score }. qvec/index may be null (model not ready): keywords only.
export function decide(question, qvec, index) {
  const kw = keywordMatch(question);
  const named = QA.find((it) => it.id.startsWith('project:') && ` ${question.toLowerCase()} `.includes(it.id.slice(8).toLowerCase()));
  if (named) return { id: named.id, text: named.a, how: 'name', score: 1 };
  if (qvec && index) {
    const [top] = rankSemantic(qvec, index);
    if (top && (top.score >= HIGH || (top.score >= LOW && kw.item && kw.item.id === top.id))) {
      return { id: top.id, text: byId.get(top.id).a, how: 'semantic', score: top.score };
    }
  }
  if (kw.item && kw.score >= (qvec ? 2 : 1)) return { id: kw.item.id, text: kw.item.a, how: 'keyword', score: kw.score };
  return { id: 'unknown', text: UNKNOWN, how: 'unknown', score: 0 };
}
