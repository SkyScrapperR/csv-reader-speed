// Phase breakdown of the main.ts path in one process: read, parse, run, stringify, write (ms wall and CPU).
import { readFileSync, writeFileSync } from 'node:fs';
import { setFlagsFromString } from 'node:v8';
setFlagsFromString('--no-incremental-marking');
for (const f of (process.env.RTFLAGS ?? '').split(' ').filter(Boolean)) setFlagsFromString(f);
const mod = await import(new URL(process.argv[3] ?? '../solve.js', import.meta.url).href);
const dir = process.argv[2] ?? 'C:/lomba/csv-reader-speed-01-run-20261121-kit/practice/input';
const t = [];
const mark = (name) => { const u = process.cpuUsage(); t.push([name, performance.now(), (u.user + u.system) / 1000]); };
mark('start');
const raw = readFileSync(dir + '/cases.json', 'utf8'); mark('read');
const cases = JSON.parse(raw); mark('parse');
const answers = []; for (const c of cases) answers.push(mod.run(c.input)); mark('run');
const s = JSON.stringify(answers); mark('stringify');
writeFileSync(process.env.TEMP + '/ans.json', s); mark('write');
for (let i = 1; i < t.length; i++) console.log(t[i][0].padEnd(10), 'wall', (t[i][1] - t[i - 1][1]).toFixed(1).padStart(7), 'cpu', (t[i][2] - t[i - 1][2]).toFixed(1).padStart(7));
