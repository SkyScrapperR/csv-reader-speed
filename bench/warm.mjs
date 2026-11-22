// Warm, in-process timing of fast.js-style answers() on one input: min and median ms over N calls after warm-up.
// usage: node bench/warm.mjs <fast.js path> [N] [cases.json]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { answers } = await import(pathToFileURL(process.argv[2]).href);
const N = Number(process.argv[3] ?? 15);
const buf = readFileSync(process.argv[4] ?? 'C:/lomba/csv-reader-speed-01-run-20261121-kit/practice/input/cases.json');
const ts = [];
for (let i = 0; i < N + 3; i++) { const t = performance.now(); answers(buf); if (i >= 3) ts.push(performance.now() - t); }
ts.sort((a, b) => a - b);
console.log(process.argv[2].split(/[\/]/).slice(-2).join('/'), 'min', ts[0].toFixed(1), 'med', ts[ts.length >> 1].toFixed(1));
