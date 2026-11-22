// End-to-end: runs `node main.ts` of each bot dir on an input dir, N times interleaved; reports the whole process's
// CPU (all threads) and wall in ms. PIN=1 pins each run to one CPU (Windows: start /affinity 1), like a 1-CPU box.
// usage: node bench/e2e.mjs <runs> <inputDir> <botDir>...
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const [runs, input, ...bots] = process.argv.slice(2);
const hook = new URL('./cpu-hook.mjs', import.meta.url).href;
const out = mkdtempSync(join(tmpdir(), 'e2e-'));
const res = bots.map(() => ({ cpu: [], wall: [] }));
const pin = process.env.PIN === '1' && process.platform === 'win32';
for (let r = 0; r < Number(runs); r++) {
  bots.forEach((b, i) => {
    const args = ['--import', hook, resolve(b, 'main.ts')];
    const env = { ...process.env, MAKEFUN_INPUT_DIR: input, MAKEFUN_OUTPUT_DIR: out };
    const p = pin
      ? spawnSync('cmd.exe', ['/c', 'start', '""', '/b', '/wait', '/affinity', '1', process.execPath, ...args], { env, encoding: 'utf8' })
      : spawnSync(process.execPath, args, { env, encoding: 'utf8' });
    if (p.status !== 0) throw new Error(b + ': ' + p.stderr);
    const m = JSON.parse(p.stderr.trim().split('\n').pop());
    res[i].cpu.push(m.cpu); res[i].wall.push(m.wall);
  });
}
const st = (xs) => { const s = [...xs].sort((a, b) => a - b); const q = (f) => s[Math.round(f * (s.length - 1))]; const mean = s.reduce((a, b) => a + b, 0) / s.length; return `med ${q(0.5).toFixed(0)} mean ${mean.toFixed(0)} [p10 ${q(0.1).toFixed(0)}, p90 ${q(0.9).toFixed(0)}]`; };
bots.forEach((b, i) => console.log(b.slice(-28).padEnd(28), 'cpu', st(res[i].cpu), ' wall', st(res[i].wall)));
