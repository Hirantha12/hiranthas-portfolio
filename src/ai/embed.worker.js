// Runs the embedding model in a Web Worker so the 3D scene keeps its frame rate.
// The model (~23 MB, quantized) is downloaded from Hugging Face on first use and then cached
// by the browser.
import { pipeline, env } from '@huggingface/transformers';
import { MODEL } from './match.js';

env.allowLocalModels = false;
const ready = pipeline('feature-extraction', MODEL, { dtype: 'q8' });

self.onmessage = async ({ data }) => {
  try {
    const extract = await ready;
    const out = await extract(data.texts, { pooling: 'mean', normalize: true });
    self.postMessage({ id: data.id, vecs: out.tolist() });
  } catch (e) {
    self.postMessage({ id: data.id, error: String(e && e.message || e) });
  }
};
