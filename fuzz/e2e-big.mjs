// Big end-to-end check of the byte path: whole case sets drawn by the kit's own generator on random seeds (6 cases
// of 1.4-2.0 M chars each, as the contest draws them), written as cases.json bytes, answered by fast.cjs, and compared
// case by case with csv-reader 1.0.0 as JSON values. usage: node fuzz/e2e-big.mjs [sets=5] [kit dir]
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import fast from '../fast.cjs';

const S = Number(process.argv[2] ?? 5);
const kit = process.argv[3] ?? 'C:/lomba/csv-reader-speed-01-run-20261121-kit';
const u = (p) => new URL('file:///' + kit + p).href;
const { readCsv } = await import(u('/baselines/csv-reader/vendor/csv-reader/index.js'));
const { generate } = await import(u('/program/generator/subject/csv-cases.mjs'));
const { streamFor } = await import(u('/program/generator/rng.ts'));

let bad = 0;
let total = 0;
for (let s = 0; s < S; s++) {
  const seed = createHash('sha256').update('e2e-big-' + s).digest('hex');
  const cases = [];
  for (let i = 0; i < 6; i++) cases.push({ id: `g-000${i + 1}`, input: generate(streamFor(seed, 'case', i), i) });
  const json = JSON.stringify(cases);
  const out = fast.answers(Buffer.from(json, 'utf8'));
  if (out === null) {
    bad++;
    console.log('set', s, 'did not take the byte path');
    continue;
  }
  const got = JSON.parse(out.toString('utf8'));
  const handed = JSON.parse(json);
  for (let i = 0; i < 6; i++) {
    total++;
    if (!isDeepStrictEqual(got[i], JSON.parse(JSON.stringify(readCsv(handed[i].input))))) {
      bad++;
      console.log('MISMATCH set', s, 'case', i);
    }
  }
}
console.log(`e2e big: ${total} generator cases, ${bad} mismatches`);
process.exit(bad ? 1 : 0);
