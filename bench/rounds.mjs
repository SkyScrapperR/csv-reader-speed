// run() over all practice cases (latin1 view) for several rounds in one process: shows JIT warm-up vs steady state.
import { readFileSync } from 'node:fs';
import { setFlagsFromString } from 'node:v8';
setFlagsFromString('--no-incremental-marking');
for (const f of (process.env.RTFLAGS ?? '').split(' ').filter(Boolean)) setFlagsFromString(f);
const { run } = await import(new URL('../solve.js', import.meta.url).href);
const cases = JSON.parse(readFileSync('C:/lomba/csv-reader-speed-01-run-20261121-kit/practice/input/cases.json', 'latin1'));
const out = [];
for (let r = 0; r < Number(process.argv[2] ?? 4); r++) {
  const keep = []; const t = performance.now(); const c0 = process.cpuUsage();
  for (const c of cases) { const t1 = performance.now(); keep.push(run(c.input)); if (r === 0) out.push((performance.now() - t1).toFixed(0)); }
  const c1 = process.cpuUsage(c0);
  console.log('round', r, (performance.now() - t).toFixed(0), 'ms cpu', ((c1.user + c1.system) / 1000).toFixed(0), r === 0 ? 'per case ' + out.join(' ') : '');
}
