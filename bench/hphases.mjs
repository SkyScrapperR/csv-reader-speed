// Phase split of the hybrid path in one process (ms wall): split, decode (per-case JSON.parse), run, serialize.
// RTFLAGS: V8 flags to set first. usage: node bench/hphases.mjs [cases.json]
import { readFileSync } from 'node:fs';
import { setFlagsFromString } from 'node:v8';
for (const f of (process.env.RTFLAGS ?? '').split(' ').filter(Boolean)) setFlagsFromString(f);
const io = (await import(new URL('../io.cjs', import.meta.url).href)).default;
const { run } = await import(new URL('../solve.js', import.meta.url).href);
const buf = readFileSync(process.argv[2] ?? 'C:/lomba/csv-reader-speed-01-run-20261121-kit/practice/input/cases.json');
let tDec = 0, tRun = 0;
const t0 = performance.now();
let n = 0;
// time each case's decode and run by wrapping run
const out = io.answersWith((input) => { const a = performance.now(); const r = run(input); tRun += performance.now() - a; n++; return r; }, buf);
const total = performance.now() - t0;
console.log(`total ${total.toFixed(0)}  run ${tRun.toFixed(0)}  rest (split+decode+serialize) ${(total - tRun).toFixed(0)}  cases ${n}  out ${out && out.length}`);
