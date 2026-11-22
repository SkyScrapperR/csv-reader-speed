// Reads "<variant> <cpu_us> <wall_us>" lines on stdin; prints median, trimmed mean and spread per variant, net of null.
import { readFileSync } from 'node:fs';
const m = new Map();
for (const l of readFileSync(0, 'utf8').split('\n')) { const [v, c, w] = l.trim().split(' '); if (!w || isNaN(+c)) continue; if (!m.has(v)) m.set(v, { c: [], w: [] }); m.get(v).c.push(+c / 1000); m.get(v).w.push(+w / 1000); }
const med = (x) => { const s = [...x].sort((a, b) => a - b); return s[s.length >> 1]; };
const tm = (x) => { const s = [...x].sort((a, b) => a - b).slice(2, -2); return s.reduce((a, b) => a + b, 0) / s.length; };
const nul = m.has('null') ? med(m.get('null').c) : 0;
for (const [v, { c, w }] of m) console.log(v.padEnd(8), 'cpu med', med(c).toFixed(1).padStart(7), 'trim', tm(c).toFixed(1).padStart(7), 'net', (tm(c) - nul).toFixed(1).padStart(7), 'min', Math.min(...c).toFixed(1).padStart(7), 'max', Math.max(...c).toFixed(1).padStart(7), ' wall med', med(w).toFixed(1).padStart(7));
