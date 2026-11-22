// Big inputs: the kit's own case generator on random seeds, plus long fields and many tiny records.
// usage: node fuzz/big.mjs [seeds=20] [kit dir]
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { run } from '../solve.js';
const S = Number(process.argv[2] ?? 20);
const kit = process.argv[3] ?? 'C:/lomba/csv-reader-speed-01-run-20261121-kit';
const u = (p) => new URL('file:///' + kit + p).href;
const { readCsv } = await import(u('/baselines/csv-reader/vendor/csv-reader/index.js'));
const { generate } = await import(u('/program/generator/subject/csv-cases.mjs'));
const { streamFor } = await import(u('/program/generator/rng.ts'));
const norm = (v) => JSON.parse(JSON.stringify(v));
let bad = 0, total = 0;
const check = (input, tag) => {
  total++;
  const ok = isDeepStrictEqual(norm(run(input)), norm(readCsv(input)));
  if (!ok) { bad++; console.log('MISMATCH', tag); }
};
for (let s = 0; s < S; s++) {
  const seed = createHash('sha256').update('fuzz-big-' + s).digest('hex');
  for (let i = 0; i < 3; i++) check(generate(streamFor(seed, 'case', i), s * 3 + i), `gen seed ${s} case ${i}`);
}
// long fields, many tiny records, astral chars
const long = 'x'.repeat(300000);
check({ text: `"${long}""${long}",${long}\n"${long}\r\n${long}"z,b\n`, header: false }, 'long fields');
check({ text: `a\n`.repeat(200000) + 'b,c\n'.repeat(1000) + '\r'.repeat(500), header: true }, 'tiny records');
check({ text: ('😀,"😀""\r😀",é\r\n').repeat(50000), header: true }, 'astral');
check({ text: '"' + 'a,b\n'.repeat(100000), header: false }, 'unterminated at start');
check({ text: 'h1,h2\n' + 'a,b\n'.repeat(100000) + '"tail', header: true }, 'unterminated at EOF');
console.log(`big: ${total} inputs, ${bad} mismatches`);
process.exit(bad ? 1 : 0);
