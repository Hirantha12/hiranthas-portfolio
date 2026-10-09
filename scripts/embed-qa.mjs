// npm run embed: turns every example question in src/data/assistant.js into a vector with the
// same model the browser uses, and saves them to src/data/qa-vectors.json. Run it after
// editing the knowledge base ("training" the assistant), then run `npm run eval`.
import { writeFileSync } from 'node:fs';
import { pipeline } from '@huggingface/transformers';
import { MODEL, examples, encodeIndex } from '../src/ai/match.js';

const ex = examples();
const extract = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
const out = await extract(ex.map((e) => e.q), { pooling: 'mean', normalize: true });
const file = encodeIndex(ex.map((e) => e.id), out.tolist());
writeFileSync(new URL('../src/data/qa-vectors.json', import.meta.url), JSON.stringify(file));
console.log(`Embedded ${ex.length} example questions for ${new Set(file.ids).size} answers (${file.dims} dims, hash ${file.hash}).`);
