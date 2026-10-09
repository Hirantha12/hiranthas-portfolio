// npm run eval: accuracy test for the "Ask Hirantha" assistant.
// Each test question is worded differently from the examples in src/data/assistant.js, so this
// measures whether the assistant understands meaning, not whether it memorised the examples.
// `want` lists the acceptable answers; 'unknown' means it should say it doesn't know.
import { pipeline } from '@huggingface/transformers';
import { readFileSync } from 'node:fs';
import { MODEL, decide, decodeIndex, hashExamples } from '../src/ai/match.js';

const TESTS = [
  ['Which uni did you attend?', ['education']], ['Are you a graduate?', ['education']], ['What qualification do you hold', ['education']],
  ['Did you go to college', ['education']], ['Where are you from?', ['location']], ['Which part of the world are you in', ['location']],
  ['Are you in Sri Lanka', ['location']], ['Who employs you right now', ['current']], ['What are you doing these days at work', ['current']],
  ['Tell me about Softvil', ['current']], ['How much experience have you got', ['experience']], ['Walk me through your career', ['experience']],
  ['What jobs have you had', ['experience']], ['Which languages and frameworks do you use', ['skills', 'frontend', 'backend']],
  ['Are you good with TypeScript', ['skills', 'frontend']], ['Can you build REST APIs', ['backend']], ['Have you used Express', ['backend']],
  ['Postgres or Mongo?', ['databases']], ['Do you know cloud platforms', ['cloud']], ['Experience with containers?', ['cloud']],
  ['Have you done anything with artificial intelligence', ['ai']], ['Is this bot using AI', ['ai', 'site']], ['Have you done UX work', ['design']],
  ['Do you follow agile', ['team']], ['Are you a team player', ['team']], ['What have you made', ['projects']],
  ['Show me something you shipped', ['projects']], ['What is TuitionLanka', ['project:TuitionLanka']], ['Explain Exploreture', ['project:Exploreture']],
  ['What did you do for Watawala', ['project:Watawala Tea']], ['tell me about the softmatter site', ['project:Softmatter by MAS']],
  ['Are you into chess?', ['chess']], ['What sports do you play', ['chess']], ['What do you enjoy outside of coding', ['chess']],
  ['How do I reach you', ['contact']], ['Can I hire you', ['contact']], ['Email address please', ['contact']],
  ['Give me your number', ['private']], ['Where exactly do you live, your street?', ['private', 'location']], ['What is your date of birth', ['private']],
  ['How much salary do you expect', ['private']], ['How was this site built', ['site']], ['What did you build this portfolio with', ['site']],
  ['Hey!', ['greet']], ['Thanks!', ['thanks']], ['Who am I talking to', ['intro']], ['Describe yourself briefly', ['intro']],
  ["What's the weather in Colombo today", ['unknown', 'location']], ['Write me a poem about cats', ['unknown']], ['What is 17 times 23', ['unknown']],
  ['Who won the cricket world cup', ['unknown', 'chess']], ['Recommend a good movie', ['unknown']],
];

// Held-out set: written before any tuning and never used to choose examples, so its score
// shows how the assistant handles questions nobody planned for.
const HELDOUT = [
  ['Did you study software engineering', ['education']], ['Which time zone are you in', ['location']], ['Is Colombo your home', ['location']],
  ['What company are you at', ['current']], ['How long have you been coding professionally', ['experience']], ['Have you built a recruitment platform', ['project:Exploreture', 'current']],
  ['Do you know Next.js', ['frontend', 'skills']], ['Can you work with NestJS', ['backend']], ['Have you used MySQL', ['databases']],
  ['Have you deployed to Azure', ['cloud']], ['Do you have experience with GPT style models', ['ai']], ['Have you done any wireframing', ['design']],
  ['Do you review other peoples code', ['team']], ['What is VivoAssist', ['project:VivoAssist']], ['Tell me about the concert website', ['project:Kataka Live In Concert']],
  ['Any chess titles?', ['chess']], ['Where can I find your GitHub', ['contact']], ['What is your home address', ['private']],
  ['What tools did you use for this 3D site', ['site']], ['Whats the capital of France', ['unknown']],
];

const file = JSON.parse(readFileSync(new URL('../src/data/qa-vectors.json', import.meta.url)));
if (file.hash !== hashExamples()) { console.error('qa-vectors.json is out of date. Run `npm run embed` first.'); process.exit(1); }
const index = decodeIndex(file);
const extract = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
async function run(name, tests) {
  const vecs = (await extract(tests.map(([q]) => q), { pooling: 'mean', normalize: true })).tolist();
  let pass = 0; const fails = [];
  tests.forEach(([q, want], i) => {
    const r = decide(q, Float32Array.from(vecs[i]), index);
    if (want.includes(r.id)) pass++;
    else fails.push(`  ✗ "${q}" → ${r.id} (${r.how} ${r.score.toFixed(2)}), wanted ${want.join(' or ')}`);
  });
  console.log(`${name}: ${pass}/${tests.length} correct (${Math.round((pass / tests.length) * 100)}%)`);
  if (fails.length) console.log(fails.join('\n'));
  return pass / tests.length;
}
const dev = await run('Dev set (used for tuning)', TESTS);
const held = await run('Held-out set (never tuned on)', HELDOUT);
process.exitCode = dev >= 0.9 && held >= 0.85 ? 0 : 1;
