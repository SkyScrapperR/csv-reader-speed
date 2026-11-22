// Phase split of the byte pipeline in one process: read, answers, write (ms wall / CPU). RTFLAGS: V8 flags to set.
import { readFileSync, writeFileSync } from 'node:fs';
import { setFlagsFromString } from 'node:v8';
for (const f of (process.env.RTFLAGS ?? '--no-incremental-marking').split(' ').filter(Boolean)) setFlagsFromString(f);
const { answers } = (await import(new URL('../fast.cjs', import.meta.url).href)).default;
const answerFile = (buf) => answers(buf);
const t = []; const mark = (n) => { const u = process.cpuUsage(); t.push([n, performance.now(), (u.user + u.system) / 1000]); };
mark('s');
const buf = readFileSync(process.argv[2] ?? 'C:/lomba/csv-reader-speed-01-run-20261121-kit/practice/input/cases.json'); mark('read');
const out = answerFile(buf); mark('answers');
writeFileSync(process.env.TEMP + '/ans-b.json', out); mark('write');
console.log(t.slice(1).map((x, i) => `${x[0]} ${(x[1] - t[i][1]).toFixed(0)}/${(x[2] - t[i][2]).toFixed(0)}`).join('  '));
