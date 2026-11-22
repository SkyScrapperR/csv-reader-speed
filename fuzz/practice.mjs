// Checks solve.js against the kit's practice expected answers and the reference on the practice inputs.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { run } from '../solve.js';
const kit = process.argv[2] ?? 'C:/lomba/csv-reader-speed-01-run-20261121-kit';
const { readCsv } = await import(new URL('file:///' + kit + '/baselines/csv-reader/vendor/csv-reader/index.js').href);
const cases = JSON.parse(readFileSync(kit + '/practice/input/cases.json', 'utf8'));
const exp = JSON.parse(readFileSync(kit + '/practice/reference/expected.json', 'utf8'));
let bad = 0;
for (let i = 0; i < cases.length; i++) {
  const mine = JSON.parse(JSON.stringify(run(cases[i].input)));
  const ok1 = isDeepStrictEqual(mine, exp.cases[i].output);
  const ok2 = isDeepStrictEqual(mine, JSON.parse(JSON.stringify(readCsv(cases[i].input))));
  if (!ok1 || !ok2) bad++;
  console.log(cases[i].id, ok1 && ok2 ? 'ok' : 'MISMATCH');
}
process.exit(bad ? 1 : 0);
